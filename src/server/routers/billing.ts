import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { billingPeriods, billingRuns, billingLineItems } from "@/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const billingRouter = router({
  // ── Billing Periods ──────────────────────────────────────────────────────

  listPeriods: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.billingPeriods.findMany({
      where: eq(billingPeriods.tenantId, ctx.tenant.id),
      orderBy: [desc(billingPeriods.periodStart)],
    });
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
      const [updated] = await ctx.db
        .update(billingPeriods)
        .set({ status: "locked", lockedAt: new Date(), lockedBy: ctx.user.id })
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
          input.billingPeriodId
            ? eq(billingRuns.billingPeriodId, input.billingPeriodId)
            : undefined,
          input.customerId ? eq(billingRuns.customerId, input.customerId) : undefined,
          input.status !== "all" ? eq(billingRuns.status, input.status) : undefined
        ),
        orderBy: [desc(billingRuns.createdAt)],
        limit: input.limit,
        offset: input.offset,
        with: {
          customer: true,
          billingPeriod: true,
          lineItems: true,
        },
      });
      return results;
    }),

  getRunById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const run = await ctx.db.query.billingRuns.findFirst({
        where: and(
          eq(billingRuns.id, input.id),
          eq(billingRuns.tenantId, ctx.tenant.id)
        ),
        with: {
          customer: true,
          billingPeriod: true,
          contract: { with: { lineItems: { with: { service: true } } } },
          lineItems: { with: { service: true } },
        },
      });

      if (!run) throw new TRPCError({ code: "NOT_FOUND" });
      return run;
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

  submitForApproval: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(billingRuns)
        .set({ status: "pending_approval", updatedAt: new Date() })
        .where(and(eq(billingRuns.id, input.id), eq(billingRuns.tenantId, ctx.tenant.id)))
        .returning();
      return updated;
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(billingRuns)
        .set({
          status: "approved",
          approvedBy: ctx.user.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(billingRuns.id, input.id), eq(billingRuns.tenantId, ctx.tenant.id)))
        .returning();
      return updated;
    }),

  // ── Summary stats for dashboard ──────────────────────────────────────────

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
        (r) =>
          ["approved", "invoiced"].includes(r.status) &&
          new Date(r.createdAt) >= currentMonth
      )
      .reduce((sum, r) => sum + parseFloat(r.totalAmount), 0);

    return {
      totalBilled,
      monthlyBilled,
      pendingApproval,
      totalRuns: runs.length,
    };
  }),
});
