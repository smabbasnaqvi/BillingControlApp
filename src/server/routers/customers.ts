import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { customers } from "@/db/schema";
import { eq, and, ilike, desc, or, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { writeAuditLog, sanitizeForAudit } from "@/lib/audit";

export const customerSchema = z.object({
  legalName: z.string().min(2, "Legal name must be at least 2 characters"),
  tradingName: z.string().optional(),
  industry: z
    .enum(["logistics", "security_services", "atm_managed_services", "cash_logistics", "other"])
    .optional(),
  status: z.enum(["active", "inactive", "prospect", "suspended"]).default("active"),
  accountManagerId: z.string().uuid().optional(),
  creditLimit: z.string().optional(),
  paymentTermsDays: z.number().int().min(0).max(365).default(30),
  billingAddress: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  contacts: z
    .array(
      z.object({
        name: z.string(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        role: z.string().optional(),
        isPrimary: z.boolean().default(false),
      })
    )
    .default([]),
  taxNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const customersRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.enum(["active", "inactive", "prospect", "suspended", "all"]).default("all"),
        limit: z.number().min(1).max(100).default(25),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(customers.tenantId, ctx.tenant.id),
        isNull(customers.deletedAt),
      ];

      if (input.status !== "all") {
        conditions.push(eq(customers.status, input.status));
      }

      if (input.search) {
        conditions.push(
          or(
            ilike(customers.legalName, `%${input.search}%`),
            ilike(customers.tradingName, `%${input.search}%`),
            ilike(customers.code, `%${input.search}%`)
          )!
        );
      }

      const results = await ctx.db.query.customers.findMany({
        where: and(...conditions),
        orderBy: [desc(customers.createdAt)],
        limit: input.limit,
        offset: input.offset,
        with: {
          accountManager: true,
        },
      });

      const total = await ctx.db
        .select({ count: customers.id })
        .from(customers)
        .where(and(...conditions));

      return { items: results, total: total.length };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const customer = await ctx.db.query.customers.findFirst({
        where: and(
          eq(customers.id, input.id),
          eq(customers.tenantId, ctx.tenant.id),
          isNull(customers.deletedAt)
        ),
        with: {
          accountManager: true,
          contracts: {
            where: isNull(customers.deletedAt),
            orderBy: (contracts, { desc }) => [desc(contracts.createdAt)],
          },
        },
      });

      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }

      return customer;
    }),

  create: protectedProcedure.input(customerSchema).mutation(async ({ ctx, input }) => {
    const code = `CUST-${Date.now().toString(36).toUpperCase()}`;

    const [customer] = await ctx.db
      .insert(customers)
      .values({
        ...input,
        tenantId: ctx.tenant.id,
        code,
        createdBy: ctx.user.id,
        creditLimit: input.creditLimit ?? null,
      })
      .returning();

    await writeAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: "create",
      entityType: "customer",
      entityId: customer.id,
      after: sanitizeForAudit(customer as unknown as Record<string, unknown>),
    });

    return customer;
  }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), data: customerSchema.partial() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.customers.findFirst({
        where: and(
          eq(customers.id, input.id),
          eq(customers.tenantId, ctx.tenant.id),
          isNull(customers.deletedAt)
        ),
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }

      const [updated] = await ctx.db
        .update(customers)
        .set({ ...input.data, updatedAt: new Date() })
        .where(eq(customers.id, input.id))
        .returning();

      await writeAuditLog({
        tenantId: ctx.tenant.id,
        userId: ctx.user.id,
        action: "update",
        entityType: "customer",
        entityId: input.id,
        before: sanitizeForAudit(existing as unknown as Record<string, unknown>),
        after: sanitizeForAudit(updated as unknown as Record<string, unknown>),
      });

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.customers.findFirst({
        where: and(
          eq(customers.id, input.id),
          eq(customers.tenantId, ctx.tenant.id),
          isNull(customers.deletedAt)
        ),
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }

      await ctx.db
        .update(customers)
        .set({ deletedAt: new Date() })
        .where(eq(customers.id, input.id));

      return { success: true };
    }),
});
