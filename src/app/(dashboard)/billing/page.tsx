"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@radix-ui/react-tabs";
import { Receipt, Plus, CheckCircle, Clock, Send } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState<"all" | "draft" | "pending_approval" | "approved">("all");

  const { data: periods } = trpc.billing.listPeriods.useQuery();
  const { data: runs, isLoading, refetch } = trpc.billing.listRuns.useQuery({ status: activeTab });
  const { data: stats } = trpc.billing.getSummaryStats.useQuery();

  const submitForApproval = trpc.billing.submitForApproval.useMutation({
    onSuccess: () => { toast.success("Submitted for approval"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const approve = trpc.billing.approve.useMutation({
    onSuccess: () => { toast.success("Billing run approved"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const TABS = [
    { value: "all", label: "All Runs" },
    { value: "draft", label: "Draft" },
    { value: "pending_approval", label: "Pending Approval" },
    { value: "approved", label: "Approved" },
  ] as const;

  return (
    <div className="space-y-5">
      <PageHeader title="Billing Workspace" description="Manage billing runs and approve charges">
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4" />
          New Billing Run
        </Button>
      </PageHeader>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Monthly Billed</p>
              <p className="text-lg font-semibold">{formatCurrency(stats?.monthlyBilled ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending Approval</p>
              <p className="text-lg font-semibold">{stats?.pendingApproval ?? 0} runs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Runs</p>
              <p className="text-lg font-semibold">{stats?.totalRuns ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        {/* Tab navigation */}
        <div className="flex gap-0 border-b border-border px-4">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`relative px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !runs?.length ? (
            <EmptyState
              icon={Receipt}
              title="No billing runs"
              description="Generate billing runs from active contracts to start billing your customers."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{run.customer.legalName}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(run.billingPeriod.periodStart)} – {formatDate(run.billingPeriod.periodEnd)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatCurrency(run.totalAmount, run.currency)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{formatDate(run.createdAt)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {run.status === "draft" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => submitForApproval.mutate({ id: run.id })}
                            disabled={submitForApproval.isPending}
                          >
                            <Send className="h-3.5 w-3.5" />
                            Submit
                          </Button>
                        )}
                        {run.status === "pending_approval" && (
                          <Button
                            size="sm"
                            onClick={() => approve.mutate({ id: run.id })}
                            disabled={approve.isPending}
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Approve
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
