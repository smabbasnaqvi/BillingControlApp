import { router, protectedProcedure } from "../trpc";
import { customers, contracts, billingRuns, approvalInstances } from "@/db/schema";
import { eq, and, gte, desc, isNull } from "drizzle-orm";

export const dashboardRouter = router({
  getKPIs: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenant.id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      allCustomers,
      activeContracts,
      allBillingRuns,
      pendingApprovals,
    ] = await Promise.all([
      ctx.db.query.customers.findMany({
        where: and(eq(customers.tenantId, tenantId), isNull(customers.deletedAt)),
      }),
      ctx.db.query.contracts.findMany({
        where: and(
          eq(contracts.tenantId, tenantId),
          eq(contracts.status, "active"),
          isNull(contracts.deletedAt)
        ),
      }),
      ctx.db.query.billingRuns.findMany({
        where: and(eq(billingRuns.tenantId, tenantId)),
        orderBy: [desc(billingRuns.createdAt)],
      }),
      ctx.db.query.approvalInstances.findMany({
        where: and(
          eq(approvalInstances.tenantId, tenantId),
          eq(approvalInstances.status, "pending")
        ),
      }),
    ]);

    const currentMonthRuns = allBillingRuns.filter(
      (r) => new Date(r.createdAt) >= startOfMonth && ["approved", "invoiced"].includes(r.status)
    );
    const lastMonthRuns = allBillingRuns.filter(
      (r) =>
        new Date(r.createdAt) >= startOfLastMonth &&
        new Date(r.createdAt) <= endOfLastMonth &&
        ["approved", "invoiced"].includes(r.status)
    );

    const currentMonthRevenue = currentMonthRuns.reduce(
      (sum, r) => sum + parseFloat(r.totalAmount),
      0
    );
    const lastMonthRevenue = lastMonthRuns.reduce(
      (sum, r) => sum + parseFloat(r.totalAmount),
      0
    );
    const revenueChange =
      lastMonthRevenue > 0
        ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : 0;

    // Monthly revenue trend (last 6 months)
    const trend = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const revenue = allBillingRuns
        .filter(
          (r) =>
            new Date(r.createdAt) >= monthStart &&
            new Date(r.createdAt) <= monthEnd &&
            ["approved", "invoiced"].includes(r.status)
        )
        .reduce((sum, r) => sum + parseFloat(r.totalAmount), 0);
      return {
        month: monthStart.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        revenue,
      };
    });

    // Expiring contracts (next 90 days)
    const in90Days = new Date();
    in90Days.setDate(in90Days.getDate() + 90);
    const expiringContracts = activeContracts.filter(
      (c) => c.expiryDate && new Date(c.expiryDate) <= in90Days
    );

    return {
      activeCustomers: allCustomers.filter((c) => c.status === "active").length,
      totalCustomers: allCustomers.length,
      activeContracts: activeContracts.length,
      expiringContracts: expiringContracts.length,
      currentMonthRevenue,
      revenueChange,
      pendingApprovals: pendingApprovals.length,
      revenueTrend: trend,
    };
  }),

  getRecentActivity: protectedProcedure.query(async ({ ctx }) => {
    const recentRuns = await ctx.db.query.billingRuns.findMany({
      where: eq(billingRuns.tenantId, ctx.tenant.id),
      orderBy: [desc(billingRuns.createdAt)],
      limit: 10,
      with: { customer: true },
    });

    return recentRuns.map((r) => ({
      id: r.id,
      type: "billing_run" as const,
      title: `Billing run for ${r.customer.legalName}`,
      status: r.status,
      amount: parseFloat(r.totalAmount),
      currency: r.currency,
      createdAt: r.createdAt,
    }));
  }),
});
