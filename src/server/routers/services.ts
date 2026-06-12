import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { services, pricingRules } from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const serviceSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.enum([
    "maintenance",
    "operations",
    "transport",
    "security",
    "processing",
    "consulting",
    "other",
  ]),
  billingType: z.enum(["fixed", "variable", "tiered", "consumption"]),
  unitOfMeasure: z.string().optional(),
  glCode: z.string().optional(),
  isActive: z.boolean().default(true),
});

const pricingRuleSchema = z.object({
  serviceId: z.string().uuid(),
  name: z.string().min(1),
  ruleType: z.enum(["flat", "per_unit", "tiered_volume", "step"]),
  unitPrice: z.string().optional(),
  currency: z.string().default("USD"),
  tiers: z
    .array(
      z.object({
        from: z.number(),
        to: z.number().optional(),
        price: z.number(),
      })
    )
    .default([]),
  effectiveDate: z.string(),
  expiryDate: z.string().optional(),
});

export const servicesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        includeInactive: z.boolean().default(false),
        category: z
          .enum([
            "maintenance",
            "operations",
            "transport",
            "security",
            "processing",
            "consulting",
            "other",
            "all",
          ])
          .default("all"),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(services.tenantId, ctx.tenant.id),
        isNull(services.deletedAt),
      ];

      if (!input.includeInactive) {
        conditions.push(eq(services.isActive, true));
      }

      const results = await ctx.db.query.services.findMany({
        where: and(...conditions),
        orderBy: [services.category, services.name],
      });

      return results;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = await ctx.db.query.services.findFirst({
        where: and(
          eq(services.id, input.id),
          eq(services.tenantId, ctx.tenant.id),
          isNull(services.deletedAt)
        ),
      });

      if (!service) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const rules = await ctx.db.query.pricingRules.findMany({
        where: and(eq(pricingRules.serviceId, input.id), eq(pricingRules.isActive, true)),
        orderBy: [desc(pricingRules.effectiveDate)],
      });

      return { ...service, pricingRules: rules };
    }),

  create: protectedProcedure.input(serviceSchema).mutation(async ({ ctx, input }) => {
    const [service] = await ctx.db
      .insert(services)
      .values({ ...input, tenantId: ctx.tenant.id })
      .returning();
    return service;
  }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), data: serviceSchema.partial() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(services)
        .set({ ...input.data, updatedAt: new Date() })
        .where(and(eq(services.id, input.id), eq(services.tenantId, ctx.tenant.id)))
        .returning();
      return updated;
    }),

  createPricingRule: protectedProcedure
    .input(pricingRuleSchema)
    .mutation(async ({ ctx, input }) => {
      const [rule] = await ctx.db
        .insert(pricingRules)
        .values({ ...input, tenantId: ctx.tenant.id })
        .returning();
      return rule;
    }),

  getPricingRules: protectedProcedure
    .input(z.object({ serviceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.pricingRules.findMany({
        where: and(
          eq(pricingRules.serviceId, input.serviceId),
          eq(pricingRules.tenantId, ctx.tenant.id)
        ),
        orderBy: [desc(pricingRules.effectiveDate)],
      });
    }),
});
