"use client";

import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { BarChart3 } from "lucide-react";

const PIE_COLORS = ["hsl(243 75% 59%)", "hsl(243 75% 70%)", "hsl(243 75% 80%)", "hsl(243 75% 88%)"];

export default function ReportsPage() {
  const { data: kpis, isLoading } = trpc.dashboard.getKPIs.useQuery();

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" description="Revenue and operational insights" />

      <div className="grid gap-4 sm:grid-cols-3">
        {["Total Monthly Revenue", "Active Contracts", "Active Customers"].map((label, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              {isLoading ? <Skeleton className="h-14 w-full" /> : (
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {i === 0 ? formatCurrency(kpis?.currentMonthRevenue ?? 0) :
                     i === 1 ? kpis?.activeContracts ?? 0 :
                     kpis?.activeCustomers ?? 0}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Monthly Revenue (6 months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-56 w-full" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={kpis?.revenueTrend ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v) => [formatCurrency(Number(v ?? 0)), "Revenue"]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="revenue" fill="hsl(243 75% 59%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contract Status Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-56 w-full" /> : (
              <div className="flex flex-col gap-4 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Active contracts</span>
                  <span className="text-sm font-semibold">{kpis?.activeContracts ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Expiring within 90 days</span>
                  <span className="text-sm font-semibold text-amber-600">{kpis?.expiringContracts ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pending approvals</span>
                  <span className="text-sm font-semibold text-blue-600">{kpis?.pendingApprovals ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Revenue change (MoM)</span>
                  <span className={`text-sm font-semibold ${(kpis?.revenueChange ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {(kpis?.revenueChange ?? 0) >= 0 ? "+" : ""}{(kpis?.revenueChange ?? 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
