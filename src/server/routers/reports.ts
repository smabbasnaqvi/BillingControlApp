import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import {
  billingRuns,
  billingLineItems,
  customers,
  contracts,
  services,
  billingPeriods,
} from "@/db/schema";
import { eq, and, gte, lte, desc, isNull, sql } from "drizzle-orm";

const dateRangeInput = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const reportsRouter = router({
  // ── Revenue Summary ─────────────────────────────────────────────────────

  revenueSummary: protectedProcedure
    .input(
      z.object({
        dateRange: dateRangeInput,
        groupBy: z.enum(["customer", "period", "month"]).default("month"),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(billingRuns.tenantId, ctx.tenant.id),
        sql`${billingRuns.status} IN ('approved', 'invoiced')`,
      ];

      if (input.dateRange.from) {
        conditions.push(gte(billingRuns.createdAt, new Date(input.dateRange.from)));
      }
      if (input.dateRange.to) {
        conditions.push(lte(billingRuns.createdAt, new Date(input.dateRange.to)));
      }

      const runs = await ctx.db.query.billingRuns.findMany({
        where: and(...conditions),
        orderBy: [desc(billingRuns.createdAt)],
        with: { customer: true, billingPeriod: true },
      });

      if (input.groupBy === "customer") {
        const byCustomer = new Map<string, { customerId: string; customerName: string; total: number; runCount: number }>();
        runs.forEach((r) => {
          const existing = byCustomer.get(r.customerId) ?? {
            customerId: r.customerId,
            customerName: r.customer.legalName,
            total: 0,
            runCount: 0,
          };
          existing.total += parseFloat(r.totalAmount);
          existing.runCount += 1;
          byCustomer.set(r.customerId, existing);
        });
        return {
          rows: Array.from(byCustomer.values()).sort((a, b) => b.total - a.total),
          totalRevenue: runs.reduce((s, r) => s + parseFloat(r.totalAmount), 0),
          currency: "USD",
        };
      }

      if (input.groupBy === "period") {
        const byPeriod = new Map<string, { periodId: string; periodName: string; total: number; runCount: number }>();
        runs.forEach((r) => {
          const existing = byPeriod.get(r.billingPeriodId) ?? {
            periodId: r.billingPeriodId,
            periodName: r.billingPeriod.name,
            total: 0,
            runCount: 0,
          };
          existing.total += parseFloat(r.totalAmount);
          existing.runCount += 1;
          byPeriod.set(r.billingPeriodId, existing);
        });
        return {
          rows: Array.from(byPeriod.values()).sort((a, b) => b.total - a.total),
          totalRevenue: runs.reduce((s, r) => s + parseFloat(r.totalAmount), 0),
          currency: "USD",
        };
      }

      // Group by month
      const byMonth = new Map<string, { month: string; total: number; runCount: number }>();
      runs.forEach((r) => {
        const d = new Date(r.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
        const existing = byMonth.get(key) ?? { month: label, total: 0, runCount: 0 };
        existing.total += parseFloat(r.totalAmount);
        existing.runCount += 1;
        byMonth.set(key, existing);
      });
      return {
        rows: Array.from(byMonth.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, v]) => v),
        totalRevenue: runs.reduce((s, r) => s + parseFloat(r.totalAmount), 0),
        currency: "USD",
      };
    }),

  // ── Customer Concentration (top N customers) ──────────────────────────

  customerConcentration: protectedProcedure
    .input(z.object({ topN: z.number().default(10), dateRange: dateRangeInput }))
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(billingRuns.tenantId, ctx.tenant.id),
        sql`${billingRuns.status} IN ('approved', 'invoiced')`,
      ];
      if (input.dateRange.from) conditions.push(gte(billingRuns.createdAt, new Date(input.dateRange.from)));
      if (input.dateRange.to) conditions.push(lte(billingRuns.createdAt, new Date(input.dateRange.to)));

      const runs = await ctx.db.query.billingRuns.findMany({
        where: and(...conditions),
        with: { customer: true },
      });

      const byCustomer = new Map<string, { name: string; revenue: number }>();
      runs.forEach((r) => {
        const e = byCustomer.get(r.customerId) ?? { name: r.customer.legalName, revenue: 0 };
        e.revenue += parseFloat(r.totalAmount);
        byCustomer.set(r.customerId, e);
      });

      const sorted = Array.from(byCustomer.values()).sort((a, b) => b.revenue - a.revenue);
      const top = sorted.slice(0, input.topN);
      const otherRevenue = sorted.slice(input.topN).reduce((s, c) => s + c.revenue, 0);
      const total = sorted.reduce((s, c) => s + c.revenue, 0);

      return {
        items: [
          ...top.map((c) => ({ name: c.name, revenue: c.revenue, pct: total > 0 ? (c.revenue / total) * 100 : 0 })),
          ...(otherRevenue > 0 ? [{ name: "Others", revenue: otherRevenue, pct: total > 0 ? (otherRevenue / total) * 100 : 0 }] : []),
        ],
        total,
      };
    }),

  // ── Contract Expiry Report ────────────────────────────────────────────

  contractExpiry: protectedProcedure
    .input(
      z.object({
        withinDays: z.number().default(180),
        status: z.enum(["active", "expiring", "all"]).default("all"),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + input.withinDays);

      const allContracts = await ctx.db.query.contracts.findMany({
        where: and(eq(contracts.tenantId, ctx.tenant.id), isNull(contracts.deletedAt)),
        with: { customer: true, lineItems: true },
        orderBy: [contracts.expiryDate],
      });

      const withDays = allContracts
        .filter((c) => ["active", "expiring"].includes(c.status))
        .filter((c) => !c.expiryDate || new Date(c.expiryDate) <= cutoff)
        .map((c) => {
          const expiry = c.expiryDate ? new Date(c.expiryDate) : null;
          const daysLeft = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / 86400000) : null;
          const monthlyValue = c.lineItems
            .filter((li) => li.billingFrequency === "monthly")
            .reduce((s, li) => s + parseFloat(li.unitPrice), 0);
          return { ...c, daysLeft, monthlyValue };
        })
        .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));

      return {
        contracts: withDays,
        expiredCount: withDays.filter((c) => (c.daysLeft ?? 0) < 0).length,
        expiringIn30: withDays.filter((c) => c.daysLeft !== null && c.daysLeft >= 0 && c.daysLeft <= 30).length,
        expiringIn90: withDays.filter((c) => c.daysLeft !== null && c.daysLeft > 30 && c.daysLeft <= 90).length,
        totalMonthlyAtRisk: withDays.filter((c) => (c.daysLeft ?? 0) <= 90).reduce((s, c) => s + c.monthlyValue, 0),
      };
    }),

  // ── Customer Aging (unpaid/invoiced balance by age) ──────────────────

  customerAging: protectedProcedure
    .input(z.object({ asOfDate: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const asOf = input.asOfDate ? new Date(input.asOfDate) : new Date();

      const invoicedRuns = await ctx.db.query.billingRuns.findMany({
        where: and(
          eq(billingRuns.tenantId, ctx.tenant.id),
          sql`${billingRuns.status} IN ('approved', 'invoiced')`
        ),
        with: { customer: true, billingPeriod: true },
      });

      type AgingRow = {
        customerId: string;
        customerName: string;
        current: number;    // 0–30 days
        days31_60: number;
        days61_90: number;
        over90: number;
        total: number;
      };

      const byCustomer = new Map<string, AgingRow>();

      invoicedRuns.forEach((run) => {
        const age = Math.floor(
          (asOf.getTime() - new Date(run.createdAt).getTime()) / 86400000
        );
        const amount = parseFloat(run.totalAmount);

        const row = byCustomer.get(run.customerId) ?? {
          customerId: run.customerId,
          customerName: run.customer.legalName,
          current: 0,
          days31_60: 0,
          days61_90: 0,
          over90: 0,
          total: 0,
        };

        if (age <= 30) row.current += amount;
        else if (age <= 60) row.days31_60 += amount;
        else if (age <= 90) row.days61_90 += amount;
        else row.over90 += amount;

        row.total += amount;
        byCustomer.set(run.customerId, row);
      });

      const rows = Array.from(byCustomer.values()).sort((a, b) => b.total - a.total);

      return {
        rows,
        totals: {
          current: rows.reduce((s, r) => s + r.current, 0),
          days31_60: rows.reduce((s, r) => s + r.days31_60, 0),
          days61_90: rows.reduce((s, r) => s + r.days61_90, 0),
          over90: rows.reduce((s, r) => s + r.over90, 0),
          total: rows.reduce((s, r) => s + r.total, 0),
        },
        asOfDate: asOf.toISOString(),
      };
    }),

  // ── Revenue by Service ───────────────────────────────────────────────

  revenueByService: protectedProcedure
    .input(z.object({ dateRange: dateRangeInput }))
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(billingRuns.tenantId, ctx.tenant.id),
        sql`${billingRuns.status} IN ('approved', 'invoiced')`,
      ];
      if (input.dateRange.from) conditions.push(gte(billingRuns.createdAt, new Date(input.dateRange.from)));
      if (input.dateRange.to) conditions.push(lte(billingRuns.createdAt, new Date(input.dateRange.to)));

      const runs = await ctx.db.query.billingRuns.findMany({
        where: and(...conditions),
        with: {
          lineItems: {
            where: eq(billingLineItems.isVoided, false),
            with: { service: true },
          },
        },
      });

      const byService = new Map<string, { serviceName: string; category: string; total: number; lineCount: number }>();
      runs.forEach((run) => {
        run.lineItems.forEach((li) => {
          if (!li.service) return;
          const key = li.service.id;
          const e = byService.get(key) ?? {
            serviceName: li.service.name,
            category: li.service.category,
            total: 0,
            lineCount: 0,
          };
          e.total += parseFloat(li.amount);
          e.lineCount += 1;
          byService.set(key, e);
        });
      });

      return Array.from(byService.values()).sort((a, b) => b.total - a.total);
    }),

  // ── Audit Log ────────────────────────────────────────────────────────

  auditLog: protectedProcedure
    .input(
      z.object({
        entityType: z.string().optional(),
        action: z.string().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const { auditLog } = await import("@/db/schema");
      const { eq, and, desc } = await import("drizzle-orm");

      const conditions = [eq(auditLog.tenantId, ctx.tenant.id)];
      if (input.entityType) conditions.push(eq(auditLog.entityType, input.entityType));
      if (input.action) conditions.push(eq(auditLog.action, input.action));

      const entries = await ctx.db.query.auditLog.findMany({
        where: and(...conditions),
        orderBy: [desc(auditLog.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });

      return entries;
    }),
});
