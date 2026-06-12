import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { billingPeriods, billingRuns, billingLineItems, contracts, contractLineItems, users } from "@/db/schema";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { sendApprovalRequestEmail, sendApprovalDecisionEmail } from "@/lib/notifications";
import { writeAuditLog } from "@/lib/audit";

export const billingRouter = router({
  // ── Billing Periods ──────────────────────────────────────────────────────

  listPeriods: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.billingPeriods.findMany({
      where: eq(billingPeriods.tenantId, ctx.tenant.id),
      orderBy: [desc(billingPeriods.periodStart)],
    });
  }),

  getPeriodById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const period = await ctx.db.query.billingPeriods.findFirst({
        where: and(eq(billingPeriods.id, input.id), eq(billingPeriods.tenantId, ctx.tenant.id)),
      });
      if (!period) throw new TRPCError({ code: "NOT_FOUND" });
      return period;
    }),

  createPeriod: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        periodStart: z.string(),
        periodEnd: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [period] = await ctx.db
        .insert(billingPeriods)
        .values({ ...input, tenantId: ctx.tenant.id, status: "open" })
        .returning();
      return period;
    }),

  lockPeriod: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Ensure all runs in this period are approved before locking
      const pendingRuns = await ctx.db.query.billingRuns.findMany({
        where: and(
          eq(billingRuns.billingPeriodId, input.id),
          eq(billingRuns.tenantId, ctx.tenant.id)
        ),
      });
      const hasUnfinished = pendingRuns.some(
        (r) => !["approved", "invoiced", "voided"].includes(r.status)
      );
      if (hasUnfinished) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "All billing runs must be approved before locking the period.",
        });
      }
      const [updated] = await ctx.db
        .update(billingPeriods)
        .set({ status: "locked", lockedAt: new Date(), lockedBy: ctx.user.id })
        .where(and(eq(billingPeriods.id, input.id), eq(billingPeriods.tenantId, ctx.tenant.id)))
        .returning();
      return updated;
    }),

  closePeriod: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(billingPeriods)
        .set({ status: "closed", updatedAt: new Date() })
        .where(and(eq(billingPeriods.id, input.id), eq(billingPeriods.tenantId, ctx.tenant.id)))
        .returning();
      return updated;
    }),

  // ── Billing Runs ─────────────────────────────────────────────────────────

  listRuns: protectedProcedure
    .input(
      z.object({
        billingPeriodId: z.string().uuid().optional(),
        customerId: z.string().uuid().optional(),
        status: z
          .enum(["draft", "pending_approval", "approved", "invoiced", "disputed", "voided", "all"])
          .default("all"),
        limit: z.number().default(25),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const results = await ctx.db.query.billingRuns.findMany({
        where: and(
          eq(billingRuns.tenantId, ctx.tenant.id),
          input.billingPeriodId ? eq(billingRuns.billingPeriodId, input.billingPeriodId) : undefined,
          input.customerId ? eq(billingRuns.customerId, input.customerId) : undefined,
          input.status !== "all" ? eq(billingRuns.status, input.status) : undefined
        ),
        orderBy: [desc(billingRuns.createdAt)],
        limit: input.limit,
        offset: input.offset,
        with: { customer: true, billingPeriod: true, lineItems: true },
      });
      return results;
    }),

  getRunById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const run = await ctx.db.query.billingRuns.findFirst({
        where: and(eq(billingRuns.id, input.id), eq(billingRuns.tenantId, ctx.tenant.id)),
        with: {
          customer: true,
          billingPeriod: true,
          contract: { with: { lineItems: { orderBy: (li, { asc }) => [asc(li.sortOrder)], with: { service: true } } } },
          lineItems: {
            where: eq(billingLineItems.isVoided, false),
            orderBy: [billingLineItems.createdAt],
            with: { service: true },
          },
        },
      });
      if (!run) throw new TRPCError({ code: "NOT_FOUND" });
      return run;
    }),

  // ── Auto-generate from contract (fixed billing) ──────────────────────────

  generateFromContract: protectedProcedure
    .input(
      z.object({
        contractId: z.string().uuid(),
        billingPeriodId: z.string().uuid(),
        currency: z.string().default("USD"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const contract = await ctx.db.query.contracts.findFirst({
        where: and(
          eq(contracts.id, input.contractId),
          eq(contracts.tenantId, ctx.tenant.id),
          isNull(contracts.deletedAt)
        ),
        with: { lineItems: { with: { service: true } }, customer: true },
      });

      if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "Contract not found" });
      if (contract.status !== "active") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Contract must be active to generate billing" });
      }

      // Check for duplicate run for this period + contract
      const existing = await ctx.db.query.billingRuns.findFirst({
        where: and(
          eq(billingRuns.contractId, input.contractId),
          eq(billingRuns.billingPeriodId, input.billingPeriodId),
          eq(billingRuns.tenantId, ctx.tenant.id)
        ),
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "A billing run already exists for this contract and period" });
      }

      // Only include monthly/applicable line items for this period
      const applicableLineItems = contract.lineItems.filter(
        (li) => li.billingFrequency === "monthly" || li.billingFrequency === "one_time"
      );

      const totalAmount = applicableLineItems
        .reduce((sum, li) => sum + parseFloat(li.unitPrice), 0)
        .toFixed(2);

      const [run] = await ctx.db
        .insert(billingRuns)
        .values({
          tenantId: ctx.tenant.id,
          billingPeriodId: input.billingPeriodId,
          customerId: contract.customerId,
          contractId: input.contractId,
          currency: input.currency,
          totalAmount,
          status: "draft",
          generatedBy: ctx.user.id,
        })
        .returning();

      if (applicableLineItems.length > 0) {
        await ctx.db.insert(billingLineItems).values(
          applicableLineItems.map((li) => ({
            billingRunId: run.id,
            contractLineItemId: li.id,
            serviceId: li.serviceId,
            description: li.description,
            quantity: "1",
            unitPrice: li.unitPrice,
            amount: li.unitPrice,
            sourceData: { generatedFrom: "contract", contractLineItemId: li.id },
          }))
        );
      }

      return run;
    }),

  // ── Line Item CRUD ────────────────────────────────────────────────────────

  addLineItem: protectedProcedure
    .input(
      z.object({
        billingRunId: z.string().uuid(),
        serviceId: z.string().uuid().optional(),
        description: z.string().min(1),
        quantity: z.string().default("1"),
        unitPrice: z.string(),
        lineType: z.enum(["variable", "fixed", "adjustment"]).default("variable"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.db.query.billingRuns.findFirst({
        where: and(eq(billingRuns.id, input.billingRunId), eq(billingRuns.tenantId, ctx.tenant.id)),
      });
      if (!run) throw new TRPCError({ code: "NOT_FOUND" });
      if (!["draft"].includes(run.status)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cannot edit a submitted billing run" });
      }

      const qty = parseFloat(input.quantity);
      const price = parseFloat(input.unitPrice);
      const amount = (qty * price).toFixed(2);

      const [lineItem] = await ctx.db
        .insert(billingLineItems)
        .values({
          billingRunId: input.billingRunId,
          serviceId: input.serviceId ?? null,
          description: input.description,
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          amount,
          sourceData: { lineType: input.lineType, notes: input.notes ?? null },
        })
        .returning();

      // Recalculate run total
      await recalculateRunTotal(ctx.db, input.billingRunId);

      return lineItem;
    }),

  updateLineItem: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        billingRunId: z.string().uuid(),
        quantity: z.string().optional(),
        unitPrice: z.string().optional(),
        description: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.db.query.billingRuns.findFirst({
        where: and(eq(billingRuns.id, input.billingRunId), eq(billingRuns.tenantId, ctx.tenant.id)),
      });
      if (!run) throw new TRPCError({ code: "NOT_FOUND" });
      if (!["draft"].includes(run.status)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cannot edit a submitted billing run" });
      }

      const existing = await ctx.db.query.billingLineItems.findFirst({
        where: eq(billingLineItems.id, input.id),
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const qty = parseFloat(input.quantity ?? existing.quantity);
      const price = parseFloat(input.unitPrice ?? existing.unitPrice);
      const amount = (qty * price).toFixed(2);

      const existingSource = (existing.sourceData ?? {}) as Record<string, unknown>;
      const [updated] = await ctx.db
        .update(billingLineItems)
        .set({
          quantity: input.quantity ?? existing.quantity,
          unitPrice: input.unitPrice ?? existing.unitPrice,
          description: input.description ?? existing.description,
          amount,
          sourceData: { ...existingSource, notes: input.notes ?? existingSource.notes },
        })
        .where(eq(billingLineItems.id, input.id))
        .returning();

      await recalculateRunTotal(ctx.db, input.billingRunId);

      return updated;
    }),

  voidLineItem: protectedProcedure
    .input(z.object({ id: z.string().uuid(), billingRunId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.db.query.billingRuns.findFirst({
        where: and(eq(billingRuns.id, input.billingRunId), eq(billingRuns.tenantId, ctx.tenant.id)),
      });
      if (!run) throw new TRPCError({ code: "NOT_FOUND" });
      if (!["draft"].includes(run.status)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cannot void a line item in a submitted run" });
      }

      await ctx.db
        .update(billingLineItems)
        .set({ isVoided: true })
        .where(eq(billingLineItems.id, input.id));

      await recalculateRunTotal(ctx.db, input.billingRunId);

      return { success: true };
    }),

  addAdjustment: protectedProcedure
    .input(
      z.object({
        billingRunId: z.string().uuid(),
        description: z.string().min(1),
        amount: z.string(),
        type: z.enum(["credit", "debit"]),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.db.query.billingRuns.findFirst({
        where: and(eq(billingRuns.id, input.billingRunId), eq(billingRuns.tenantId, ctx.tenant.id)),
      });
      if (!run) throw new TRPCError({ code: "NOT_FOUND" });
      if (!["draft"].includes(run.status)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cannot adjust a submitted billing run" });
      }

      // Credits are stored as negative amounts
      const signedAmount = input.type === "credit"
        ? (-Math.abs(parseFloat(input.amount))).toFixed(2)
        : Math.abs(parseFloat(input.amount)).toFixed(2);

      const [adjustment] = await ctx.db
        .insert(billingLineItems)
        .values({
          billingRunId: input.billingRunId,
          description: input.description,
          quantity: "1",
          unitPrice: signedAmount,
          amount: signedAmount,
          sourceData: { lineType: "adjustment", adjustmentType: input.type, reason: input.reason ?? null },
        })
        .returning();

      await recalculateRunTotal(ctx.db, input.billingRunId);

      return adjustment;
    }),

  createRun: protectedProcedure
    .input(
      z.object({
        billingPeriodId: z.string().uuid(),
        customerId: z.string().uuid(),
        contractId: z.string().uuid().optional(),
        currency: z.string().default("USD"),
        notes: z.string().optional(),
        lineItems: z.array(
          z.object({
            contractLineItemId: z.string().uuid().optional(),
            serviceId: z.string().uuid().optional(),
            description: z.string(),
            quantity: z.string().default("1"),
            unitPrice: z.string(),
            amount: z.string(),
            sourceData: z.record(z.string(), z.unknown()).default({}),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { lineItems, ...runData } = input;
      const totalAmount = lineItems
        .reduce((sum, li) => sum + parseFloat(li.amount), 0)
        .toFixed(2);

      const [run] = await ctx.db
        .insert(billingRuns)
        .values({
          ...runData,
          tenantId: ctx.tenant.id,
          totalAmount,
          status: "draft",
          generatedBy: ctx.user.id,
          contractId: runData.contractId ?? null,
        })
        .returning();

      if (lineItems.length > 0) {
        await ctx.db.insert(billingLineItems).values(
          lineItems.map((li) => ({
            ...li,
            billingRunId: run.id,
            contractLineItemId: li.contractLineItemId ?? null,
            serviceId: li.serviceId ?? null,
          }))
        );
      }

      return run;
    }),

  updateNotes: protectedProcedure
    .input(z.object({ id: z.string().uuid(), notes: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(billingRuns)
        .set({ notes: input.notes, updatedAt: new Date() })
        .where(and(eq(billingRuns.id, input.id), eq(billingRuns.tenantId, ctx.tenant.id)))
        .returning();
      return updated;
    }),

  submitForApproval: protectedProcedure
    .input(z.object({ id: z.string().uuid(), approverEmail: z.string().email().optional() }))
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.db.query.billingRuns.findFirst({
        where: and(eq(billingRuns.id, input.id), eq(billingRuns.tenantId, ctx.tenant.id)),
        with: { customer: true },
      });
      if (!run) throw new TRPCError({ code: "NOT_FOUND" });

      const [updated] = await ctx.db
        .update(billingRuns)
        .set({ status: "pending_approval", updatedAt: new Date() })
        .where(and(eq(billingRuns.id, input.id), eq(billingRuns.tenantId, ctx.tenant.id)))
        .returning();

      // Send notification email to approver if provided
      if (input.approverEmail) {
        await sendApprovalRequestEmail({
          to: input.approverEmail,
          approverName: "Approver",
          requesterName: ctx.user.name,
          entityType: "billing_run",
          entityLabel: `${run.customer.legalName} — ${run.id.slice(0, 8).toUpperCase()}`,
          amount: parseFloat(run.totalAmount),
          currency: run.currency,
          approvalUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/approvals`,
        }).catch(console.error);
      }

      return updated;
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.string().uuid(), comments: z.string().optional(), requesterEmail: z.string().email().optional() }))
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.db.query.billingRuns.findFirst({
        where: and(eq(billingRuns.id, input.id), eq(billingRuns.tenantId, ctx.tenant.id)),
        with: { customer: true },
      });
      if (!run) throw new TRPCError({ code: "NOT_FOUND" });

      const [updated] = await ctx.db
        .update(billingRuns)
        .set({ status: "approved", approvedBy: ctx.user.id, approvedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(billingRuns.id, input.id), eq(billingRuns.tenantId, ctx.tenant.id)))
        .returning();

      if (input.requesterEmail) {
        await sendApprovalDecisionEmail({
          to: input.requesterEmail,
          requesterName: "Team",
          approverName: ctx.user.name,
          decision: "approved",
          entityLabel: `${run.customer.legalName} — ${run.id.slice(0, 8).toUpperCase()}`,
          comments: input.comments,
        }).catch(console.error);
      }

      await writeAuditLog({
        tenantId: ctx.tenant.id,
        userId: ctx.user.id,
        action: "approve",
        entityType: "billing_run",
        entityId: input.id,
        before: { status: run.status },
        after: { status: "approved", approvedBy: ctx.user.id },
      });

      return updated;
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.string().uuid(), comments: z.string().min(1, "Comments required when rejecting") }))
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.db.query.billingRuns.findFirst({
        where: and(eq(billingRuns.id, input.id), eq(billingRuns.tenantId, ctx.tenant.id)),
      });

      const [updated] = await ctx.db
        .update(billingRuns)
        .set({ status: "draft", updatedAt: new Date(), notes: input.comments })
        .where(and(eq(billingRuns.id, input.id), eq(billingRuns.tenantId, ctx.tenant.id)))
        .returning();

      await writeAuditLog({
        tenantId: ctx.tenant.id,
        userId: ctx.user.id,
        action: "reject",
        entityType: "billing_run",
        entityId: input.id,
        before: { status: run?.status },
        after: { status: "draft", comments: input.comments },
      });

      return updated;
    }),

  voidRun: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(billingRuns)
        .set({ status: "voided", updatedAt: new Date() })
        .where(and(eq(billingRuns.id, input.id), eq(billingRuns.tenantId, ctx.tenant.id)))
        .returning();
      return updated;
    }),

  getSummaryStats: protectedProcedure.query(async ({ ctx }) => {
    const runs = await ctx.db.query.billingRuns.findMany({
      where: eq(billingRuns.tenantId, ctx.tenant.id),
    });

    const pendingApproval = runs.filter((r) => r.status === "pending_approval").length;
    const totalBilled = runs
      .filter((r) => ["approved", "invoiced"].includes(r.status))
      .reduce((sum, r) => sum + parseFloat(r.totalAmount), 0);

    const currentMonth = new Date();
    currentMonth.setDate(1);
    const monthlyBilled = runs
      .filter(
        (r) => ["approved", "invoiced"].includes(r.status) && new Date(r.createdAt) >= currentMonth
      )
      .reduce((sum, r) => sum + parseFloat(r.totalAmount), 0);

    return { totalBilled, monthlyBilled, pendingApproval, totalRuns: runs.length };
  }),
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function recalculateRunTotal(db: typeof import("@/db").db, runId: string) {
  const activeItems = await db.query.billingLineItems.findMany({
    where: and(eq(billingLineItems.billingRunId, runId), eq(billingLineItems.isVoided, false)),
  });
  const total = activeItems.reduce((sum, li) => sum + parseFloat(li.amount), 0).toFixed(2);
  await db
    .update(billingRuns)
    .set({ totalAmount: total, updatedAt: new Date() })
    .where(eq(billingRuns.id, runId));
}
