"use client";

import { trpc } from "@/lib/trpc";
import { StatCard } from "@/components/shared/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Users,
  FileText,
  DollarSign,
  Clock,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import {
  AreaChart,
  Area,
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

const PIE_COLORS = [
  "hsl(243 75% 59%)",
  "hsl(197 71% 52%)",
  "hsl(142 71% 45%)",
  "hsl(47 100% 50%)",
  "hsl(30 100% 50%)",
  "hsl(0 84% 60%)",
];

export default function DashboardPage() {
  const { data: kpis, isLoading: kpisLoading } = trpc.dashboard.getKPIs.useQuery();
  const { data: activity, isLoading: activityLoading } = trpc.dashboard.getRecentActivity.useQuery();
  const { data: concentration, isLoading: concentrationLoading } = trpc.reports.customerConcentration.useQuery({
    topN: 5,
    dateRange: {},
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Overview for ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`}
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpisLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))
        ) : (
          <>
            <StatCard
              title="Monthly Revenue"
              value={formatCurrency(kpis?.currentMonthRevenue ?? 0)}
              change={kpis ? { value: kpis.revenueChange, label: "vs last month" } : undefined}
              icon={DollarSign}
            />
            <StatCard
              title="Active Customers"
              value={kpis?.activeCustomers ?? 0}
              description={`${kpis?.totalCustomers ?? 0} total`}
              icon={Users}
            />
            <StatCard
              title="Active Contracts"
              value={kpis?.activeContracts ?? 0}
              description={kpis?.expiringContracts ? `${kpis.expiringContracts} expiring in 90 days` : undefined}
              icon={FileText}
            />
            <StatCard
              title="Pending Approvals"
              value={kpis?.pendingApprovals ?? 0}
              icon={Clock}
              iconClassName={kpis?.pendingApprovals ? "bg-amber-100 dark:bg-amber-900/30" : undefined}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={kpis?.revenueTrend ?? []}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(243 75% 59%)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(243 75% 59%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(243 75% 59%)"
                    strokeWidth={2}
                    fill="url(#revenueGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Attention Required */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Attention Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {kpisLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : (
              <div className="space-y-2">
                {(kpis?.expiringContracts ?? 0) > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        {kpis?.expiringContracts} contracts expiring
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">Within 90 days</p>
                    </div>
                  </div>
                )}
                {(kpis?.pendingApprovals ?? 0) > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                    <div>
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        {kpis?.pendingApprovals} items need approval
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">Billing runs pending</p>
                    </div>
                  </div>
                )}
                {!kpis?.expiringContracts && !kpis?.pendingApprovals && (
                  <p className="py-4 text-center text-sm text-muted-foreground">All clear — nothing requires attention.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Customer Concentration + Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Customer Concentration Pie */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-muted-foreground" />
              Revenue Concentration
            </CardTitle>
          </CardHeader>
          <CardContent>
            {concentrationLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : !concentration?.items.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No revenue data yet.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={concentration.items}
                      dataKey="revenue"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={65}
                      innerRadius={35}
                    >
                      {concentration.items.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => [formatCurrency(Number(v ?? 0)), "Revenue"]}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "11px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-1">
                  {concentration.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }}
                        />
                        <span className="truncate text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-medium tabular-nums shrink-0 ml-2">{item.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Recent Billing Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !activity?.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No billing activity yet. Create a billing run to get started.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatCurrency(item.amount, item.currency)}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
