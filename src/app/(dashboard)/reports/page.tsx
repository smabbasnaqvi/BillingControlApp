"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { exportToExcel, exportToCsv } from "@/lib/export";
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
import {
  Download,
  TrendingUp,
  Users,
  FileText,
  AlertTriangle,
  BarChart3,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PIE_COLORS = [
  "hsl(243 75% 59%)",
  "hsl(197 71% 52%)",
  "hsl(142 71% 45%)",
  "hsl(47 100% 50%)",
  "hsl(30 100% 50%)",
  "hsl(0 84% 60%)",
  "hsl(280 65% 60%)",
];

function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  return (
    <div className="flex items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs">From</Label>
        <Input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="h-8 text-sm w-36"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">To</Label>
        <Input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="h-8 text-sm w-36"
        />
      </div>
    </div>
  );
}

// ── Revenue Summary Tab ────────────────────────────────────────────────────

function RevenueSummaryTab() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [groupBy, setGroupBy] = useState<"month" | "customer" | "period">("month");

  const { data, isLoading } = trpc.reports.revenueSummary.useQuery({
    dateRange: { from: from || undefined, to: to || undefined },
    groupBy,
  });

  function handleExportExcel() {
    if (!data) return;
    type Row = { label: string; total: number; runCount: number };
    const rows: Row[] = data.rows.map((r) => ({
      label:
        groupBy === "customer"
          ? (r as { customerName: string }).customerName
          : groupBy === "period"
          ? (r as { periodName: string }).periodName
          : (r as { month: string }).month,
      total: r.total,
      runCount: r.runCount,
    }));
    exportToExcel(
      rows as unknown as Record<string, unknown>[],
      [
        { header: groupBy === "customer" ? "Customer" : groupBy === "period" ? "Period" : "Month", key: "label", width: 30 },
        { header: "Revenue (USD)", key: "total", width: 20 },
        { header: "Run Count", key: "runCount", width: 15 },
      ],
      "Revenue Summary",
      `revenue-summary-${new Date().toISOString().slice(0, 10)}`
    );
  }

  function handleExportCsv() {
    if (!data) return;
    type Row = { label: string; total: number; runCount: number };
    const rows: Row[] = data.rows.map((r) => ({
      label:
        groupBy === "customer"
          ? (r as { customerName: string }).customerName
          : groupBy === "period"
          ? (r as { periodName: string }).periodName
          : (r as { month: string }).month,
      total: r.total,
      runCount: r.runCount,
    }));
    exportToCsv(
      rows as unknown as Record<string, unknown>[],
      [
        { header: groupBy === "customer" ? "Customer" : groupBy === "period" ? "Period" : "Month", key: "label", width: 30 },
        { header: "Revenue (USD)", key: "total", width: 20 },
        { header: "Run Count", key: "runCount", width: 15 },
      ],
      `revenue-summary-${new Date().toISOString().slice(0, 10)}`
    );
  }

  const chartData = data?.rows.map((r) => ({
    name:
      groupBy === "customer"
        ? (r as { customerName: string }).customerName
        : groupBy === "period"
        ? (r as { periodName: string }).periodName
        : (r as { month: string }).month,
    revenue: r.total,
  })) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4 justify-between">
        <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Group By</Label>
            <div className="flex rounded-md border border-border overflow-hidden">
              {(["month", "customer", "period"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGroupBy(g)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                    groupBy === g
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!data}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!data}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            CSV
          </Button>
        </div>
      </div>

      {/* Total KPI */}
      {data && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Revenue</p>
              <p className="text-2xl font-semibold">{formatCurrency(data.totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Revenue by {groupBy}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : chartData.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No data for the selected range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
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

      {/* Table */}
      {!isLoading && (data?.rows.length ?? 0) > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {groupBy === "customer" ? "Customer" : groupBy === "period" ? "Period" : "Month"}
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Revenue</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Runs</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data!.rows.map((r, i) => {
                  const label =
                    groupBy === "customer"
                      ? (r as { customerName: string }).customerName
                      : groupBy === "period"
                      ? (r as { periodName: string }).periodName
                      : (r as { month: string }).month;
                  const pct = data!.totalRevenue > 0 ? (r.total / data!.totalRevenue) * 100 : 0;
                  return (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium">{label}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(r.total)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.runCount}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{pct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                  <td className="px-4 py-2.5">Total</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(data!.totalRevenue)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {data!.rows.reduce((s, r) => s + r.runCount, 0)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Contract Expiry Tab ────────────────────────────────────────────────────

function ContractExpiryTab() {
  const [withinDays, setWithinDays] = useState(180);
  const { data, isLoading } = trpc.reports.contractExpiry.useQuery({ withinDays });

  function handleExport() {
    if (!data) return;
    exportToExcel(
      data.contracts.map((c) => ({
        referenceNumber: c.referenceNumber,
        customer: c.customer?.legalName ?? "",
        expiryDate: c.expiryDate ? formatDate(c.expiryDate) : "No expiry",
        daysLeft: c.daysLeft ?? "",
        monthlyValue: c.monthlyValue,
        status: c.status,
      })),
      [
        { header: "Contract Ref", key: "referenceNumber", width: 20 },
        { header: "Customer", key: "customer", width: 30 },
        { header: "Expiry Date", key: "expiryDate", width: 15 },
        { header: "Days Left", key: "daysLeft", width: 12 },
        { header: "Monthly Value", key: "monthlyValue", width: 18 },
        { header: "Status", key: "status", width: 15 },
      ],
      "Contract Expiry",
      `contract-expiry-${new Date().toISOString().slice(0, 10)}`
    );
  }

  function daysColor(days: number | null) {
    if (days === null) return "text-muted-foreground";
    if (days < 0) return "text-red-600 font-semibold";
    if (days <= 30) return "text-red-500 font-semibold";
    if (days <= 90) return "text-amber-600 font-semibold";
    return "text-foreground";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4 justify-between flex-wrap">
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Show contracts expiring within</Label>
            <div className="flex rounded-md border border-border overflow-hidden">
              {[30, 90, 180, 365].map((d) => (
                <button
                  key={d}
                  onClick={() => setWithinDays(d)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    withinDays === d
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!data}>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export Excel
        </Button>
      </div>

      {/* Risk summary cards */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : data && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-red-700 dark:text-red-300 uppercase tracking-wide">Expired</p>
              <p className="text-2xl font-semibold text-red-700 dark:text-red-300">{data.expiredCount}</p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wide">Expiring in 30d</p>
              <p className="text-2xl font-semibold text-amber-700 dark:text-amber-300">{data.expiringIn30}</p>
            </CardContent>
          </Card>
          <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300 uppercase tracking-wide">Expiring in 90d</p>
              <p className="text-2xl font-semibold text-yellow-700 dark:text-yellow-300">{data.expiringIn90}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Monthly at Risk</p>
              <p className="text-2xl font-semibold">{formatCurrency(data.totalMonthlyAtRisk)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        {isLoading ? (
          <CardContent className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </CardContent>
        ) : !data?.contracts.length ? (
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No contracts expiring within {withinDays} days.
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reference</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expiry Date</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Days Left</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Monthly Value</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data!.contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium font-mono text-xs">{c.referenceNumber}</td>
                    <td className="px-4 py-2.5">{c.customer?.legalName ?? "—"}</td>
                    <td className="px-4 py-2.5">{c.expiryDate ? formatDate(c.expiryDate) : <span className="text-muted-foreground">No expiry</span>}</td>
                    <td className={cn("px-4 py-2.5 text-right tabular-nums", daysColor(c.daysLeft))}>
                      {c.daysLeft !== null
                        ? c.daysLeft < 0
                          ? `${Math.abs(c.daysLeft)}d ago`
                          : `${c.daysLeft}d`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(c.monthlyValue)}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={c.status === "active" ? "success" : c.status === "expiring" ? "warning" : "secondary"} className="text-xs">
                        {c.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Customer Aging Tab ─────────────────────────────────────────────────────

function CustomerAgingTab() {
  const [asOfDate, setAsOfDate] = useState("");
  const { data, isLoading } = trpc.reports.customerAging.useQuery({
    asOfDate: asOfDate || undefined,
  });

  function handleExport() {
    if (!data) return;
    exportToExcel(
      data.rows.map((r) => ({
        customer: r.customerName,
        current: r.current,
        days31_60: r.days31_60,
        days61_90: r.days61_90,
        over90: r.over90,
        total: r.total,
      })),
      [
        { header: "Customer", key: "customer", width: 30 },
        { header: "0–30 Days", key: "current", width: 16 },
        { header: "31–60 Days", key: "days31_60", width: 16 },
        { header: "61–90 Days", key: "days61_90", width: 16 },
        { header: "Over 90 Days", key: "over90", width: 16 },
        { header: "Total", key: "total", width: 16 },
      ],
      "Customer Aging",
      `customer-aging-${new Date().toISOString().slice(0, 10)}`
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4 justify-between flex-wrap">
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">As of Date</Label>
            <Input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="h-8 text-sm w-40"
            />
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!data}>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export Excel
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <CardContent className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </CardContent>
        ) : !data?.rows.length ? (
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No aging data found.
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">0–30 Days</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">31–60 Days</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">61–90 Days</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Over 90 Days</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data!.rows.map((r) => (
                  <tr key={r.customerId} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{r.customerName}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.current > 0 ? formatCurrency(r.current) : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {r.days31_60 > 0 ? <span className="text-amber-600">{formatCurrency(r.days31_60)}</span> : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {r.days61_90 > 0 ? <span className="text-orange-600">{formatCurrency(r.days61_90)}</span> : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {r.over90 > 0 ? <span className="text-red-600 font-semibold">{formatCurrency(r.over90)}</span> : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{formatCurrency(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                  <td className="px-4 py-2.5">Total</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(data!.totals.current)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-amber-600">{formatCurrency(data!.totals.days31_60)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-orange-600">{formatCurrency(data!.totals.days61_90)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-red-600">{formatCurrency(data!.totals.over90)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(data!.totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {data && (
        <p className="text-xs text-muted-foreground">Aging as of: {formatDate(data.asOfDate)}</p>
      )}
    </div>
  );
}

// ── Revenue by Service Tab ─────────────────────────────────────────────────

function RevenueByServiceTab() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, isLoading } = trpc.reports.revenueByService.useQuery({
    dateRange: { from: from || undefined, to: to || undefined },
  });

  function handleExport() {
    if (!data) return;
    exportToCsv(
      data.map((r) => ({ ...r })) as unknown as Record<string, unknown>[],
      [
        { header: "Service", key: "serviceName", width: 30 },
        { header: "Category", key: "category", width: 20 },
        { header: "Revenue", key: "total", width: 18 },
        { header: "Line Items", key: "lineCount", width: 12 },
      ],
      `revenue-by-service-${new Date().toISOString().slice(0, 10)}`
    );
  }

  const total = data?.reduce((s, r) => s + r.total, 0) ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4 justify-between flex-wrap">
        <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!data}>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Revenue Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : !data?.length ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="total"
                    nameKey="serviceName"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => {
                      const n = (name ?? "") as string;
                      return `${n.length > 12 ? n.slice(0, 12) + "…" : n} ${(((percent ?? 0) as number) * 100).toFixed(1)}%`;
                    }}
                    labelLine={false}
                  >
                    {data.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => [formatCurrency(Number(v ?? 0)), "Revenue"]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <div className="overflow-y-auto max-h-80">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Service</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Revenue</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}><td colSpan={4} className="px-4 py-2"><Skeleton className="h-6 w-full" /></td></tr>
                    ))
                  : data?.map((r, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-medium">{r.serviceName}</td>
                        <td className="px-4 py-2.5 text-muted-foreground capitalize">{r.category}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(r.total)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                          {total > 0 ? ((r.total / total) * 100).toFixed(1) : "0"}%
                        </td>
                      </tr>
                    ))}
              </tbody>
              {!isLoading && total > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                    <td className="px-4 py-2.5" colSpan={2}>Total</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(total)}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">100%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ReportsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Reports" description="Revenue analysis, contract risk, and billing insights" />

      <Tabs defaultValue="revenue">
        <TabsList className="mb-2">
          <TabsTrigger value="revenue" className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Revenue Summary
          </TabsTrigger>
          <TabsTrigger value="expiry" className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Contract Expiry
          </TabsTrigger>
          <TabsTrigger value="aging" className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Customer Aging
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            By Service
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <RevenueSummaryTab />
        </TabsContent>
        <TabsContent value="expiry">
          <ContractExpiryTab />
        </TabsContent>
        <TabsContent value="aging">
          <CustomerAgingTab />
        </TabsContent>
        <TabsContent value="services">
          <RevenueByServiceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
