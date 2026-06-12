"use client";

import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckSquare, CheckCircle, XCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function ApprovalsPage() {
  const { data: runs, isLoading, refetch } = trpc.billing.listRuns.useQuery({
    status: "pending_approval",
  });

  const approve = trpc.billing.approve.useMutation({
    onSuccess: () => { toast.success("Approved successfully"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Approval Queue"
        description="Review and approve billing runs pending authorization"
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !runs?.length ? (
            <EmptyState
              icon={CheckSquare}
              title="Queue is clear"
              description="No billing runs are currently awaiting your approval."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Billing Period</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{run.customer.legalName}</p>
                      <p className="text-xs text-muted-foreground">{run.lineItems.length} line items</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {formatDate(run.billingPeriod.periodStart)} – {formatDate(run.billingPeriod.periodEnd)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatCurrency(run.totalAmount, run.currency)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{formatDate(run.updatedAt)}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          disabled={approve.isPending}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => approve.mutate({ id: run.id })}
                          disabled={approve.isPending}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Approve
                        </Button>
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
