import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { contracts, contractLineItems } from "@/db/schema";
import { eq, and, desc, isNull, or, ilike } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const lineItemSchema = z.object({
  serviceId: z.string().uuid(),
  pricingRuleId: z.string().uuid().optional(),
  description: z.string().min(1),
  quantityBasis: z.string().optional(),
  unitPrice: z.string(),
  billingFrequency: z.enum(["monthly", "quarterly", "annually", "one_time"]),
  escalationClause: z
    .object({
      type: z.enum(["fixed_percentage", "cpi_linked", "fixed_amount"]),
      value: z.number(),
      triggerDate: z.string().optional(),
    })
    .optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
  sortOrder: z.number().default(0),
});

export const contractSchema = z.object({
  customerId: z.string().uuid(),
  type: z.enum(["fixed", "variable", "mixed"]),
  effectiveDate: z.string(),
  expiryDate: z.string().optional(),
  autoRenew: z.boolean().default(false),
  noticePeriodDays: z.number().int().min(0).default(30),
  currency: z.string().default("USD"),
  notes: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
});

export const contractsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z
          .enum(["draft", "under_review", "active", "expiring", "expired", "terminated", "all"])
          .default("all"),
        customerId: z.string().uuid().optional(),
        limit: z.number().min(1).max(100).default(25),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(contracts.tenantId, ctx.tenant.id),
        isNull(contracts.deletedAt),
      ];

      if (input.status !== "all") {
        conditions.push(eq(contracts.status, input.status));
      }

      if (input.customerId) {
        conditions.push(eq(contracts.customerId, input.customerId));
      }

      if (input.search) {
        conditions.push(ilike(contracts.referenceNumber, `%${input.search}%`));
      }

      const results = await ctx.db.query.contracts.findMany({
        where: and(...conditions),
        orderBy: [desc(contracts.createdAt)],
        limit: input.limit,
        offset: input.offset,
        with: {
          customer: true,
          lineItems: { with: { service: true } },
        },
      });

      return { items: results, total: results.length };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const contract = await ctx.db.query.contracts.findFirst({
        where: and(
          eq(contracts.id, input.id),
          eq(contracts.tenantId, ctx.tenant.id),
          isNull(contracts.deletedAt)
        ),
        with: {
          customer: true,
          lineItems: {
            orderBy: (li, { asc }) => [asc(li.sortOrder)],
            with: { service: true },
          },
        },
      });

      if (!contract) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Contract not found" });
      }

      return contract;
    }),

  create: protectedProcedure.input(contractSchema).mutation(async ({ ctx, input }) => {
    const refNumber = `CTR-${Date.now().toString(36).toUpperCase()}`;
    const { lineItems, ...contractData } = input;

    const [contract] = await ctx.db
      .insert(contracts)
      .values({
        ...contractData,
        tenantId: ctx.tenant.id,
        referenceNumber: refNumber,
        createdBy: ctx.user.id,
        status: "draft",
        version: 1,
      })
      .returning();

    if (lineItems.length > 0) {
      await ctx.db.insert(contractLineItems).values(
        lineItems.map((li) => ({
          ...li,
          contractId: contract.id,
          pricingRuleId: li.pricingRuleId ?? null,
        }))
      );
    }

    return contract;
  }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["draft", "under_review", "active", "expiring", "expired", "terminated"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.contracts.findFirst({
        where: and(
          eq(contracts.id, input.id),
          eq(contracts.tenantId, ctx.tenant.id),
          isNull(contracts.deletedAt)
        ),
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Contract not found" });
      }

      const [updated] = await ctx.db
        .update(contracts)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(contracts.id, input.id))
        .returning();

      return updated;
    }),

  getExpiringContracts: protectedProcedure
    .input(z.object({ withinDays: z.number().default(90) }))
    .query(async ({ ctx, input }) => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + input.withinDays);

      const results = await ctx.db.query.contracts.findMany({
        where: and(
          eq(contracts.tenantId, ctx.tenant.id),
          eq(contracts.status, "active"),
          isNull(contracts.deletedAt)
        ),
        with: { customer: true },
        orderBy: [contracts.expiryDate],
      });

      return results.filter(
        (c) => c.expiryDate && new Date(c.expiryDate) <= futureDate
      );
    }),

  // ── Amendment (creates new version, preserving history) ──────────────────

  amend: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        effectiveDate: z.string(),
        expiryDate: z.string().optional(),
        notes: z.string().optional(),
        lineItems: z.array(
          z.object({
            serviceId: z.string().uuid(),
            description: z.string().min(1),
            unitPrice: z.string(),
            billingFrequency: z.enum(["monthly", "quarterly", "annually", "one_time"]),
            sortOrder: z.number().default(0),
          })
        ).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const original = await ctx.db.query.contracts.findFirst({
        where: and(
          eq(contracts.id, input.id),
          eq(contracts.tenantId, ctx.tenant.id),
          isNull(contracts.deletedAt)
        ),
        with: { lineItems: true },
      });

      if (!original) throw new TRPCError({ code: "NOT_FOUND" });
      if (!["active", "draft"].includes(original.status)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only active or draft contracts can be amended" });
      }

      // Terminate the original
      await ctx.db
        .update(contracts)
        .set({ status: "terminated", updatedAt: new Date() })
        .where(eq(contracts.id, input.id));

      // Create new version
      const { id: _id, createdAt: _c, updatedAt: _u, ...originalData } = original;
      const [amended] = await ctx.db
        .insert(contracts)
        .values({
          ...originalData,
          effectiveDate: input.effectiveDate,
          expiryDate: input.expiryDate ?? original.expiryDate,
          notes: input.notes ?? original.notes,
          version: (original.version ?? 1) + 1,
          status: "draft",
          parentContractId: original.id,
          referenceNumber: `${original.referenceNumber}-A${(original.version ?? 1) + 1}`,
          createdBy: ctx.user.id,
          approvedBy: null,
          approvedAt: null,
        })
        .returning();

      // Insert new line items
      if (input.lineItems.length > 0) {
        await ctx.db.insert(contractLineItems).values(
          input.lineItems.map((li) => ({ ...li, contractId: amended.id }))
        );
      }

      return amended;
    }),

  // ── Version history ────────────────────────────────────────────────────────

  getVersionHistory: protectedProcedure
    .input(z.object({ referenceBase: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.contracts.findMany({
        where: and(
          eq(contracts.tenantId, ctx.tenant.id),
          isNull(contracts.deletedAt)
        ),
        with: { customer: true },
        orderBy: [contracts.version],
      }).then((all) =>
        all.filter(
          (c) =>
            c.referenceNumber === input.referenceBase ||
            c.referenceNumber.startsWith(input.referenceBase + "-A")
        )
      );
    }),
});
