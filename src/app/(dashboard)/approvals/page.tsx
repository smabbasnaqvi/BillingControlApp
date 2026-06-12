"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckSquare, CheckCircle, XCircle, ExternalLink, Clock } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { StatCard } from "@/components/shared/stat-card";

export default function ApprovalsPage() {
  const router = useRouter();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectComments, setRejectComments] = useState("");
  const [approveId, setApproveId] = useState<string | null>(null);
  const [approveComments, setApproveComments] = useState("");

  const { data: runs, isLoading, refetch } = trpc.billing.listRuns.useQuery({
    status: "pending_approval",
  });

  const { data: allRuns } = trpc.billing.listRuns.useQuery({ status: "all", limit: 100 });

  const approve = trpc.billing.approve.useMutation({
    onSuccess: () => {
      toast.success("Approved successfully");
      refetch();
      setApproveId(null);
      setApproveComments("");
    },
    onError: (e) => toast.error(e.message),
  });

  const reject = trpc.billing.reject.useMutation({
    onSuccess: () => {
      toast.success("Returned for revision");
      refetch();
      setRejectId(null);
      setRejectComments("");
    },
    onError: (e) => toast.error(e.message),
  });

  const totalPending = runs?.length ?? 0;
  const totalApproved = allRuns?.filter((r) => r.status === "approved").length ?? 0;
  const pendingValue = runs?.reduce((s, r) => s + parseFloat(r.totalAmount), 0) ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Approval Queue"
        description="Review and approve billing runs pending authorization"
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title="Pending Approval"
          value={totalPending}
          icon={Clock}
          iconClassName={totalPending > 0 ? "bg-amber-100 dark:bg-amber-900/30" : undefined}
        />
        <StatCard
          title="Pending Value"
          value={formatCurrency(pendingValue)}
          icon={CheckSquare}
        />
        <StatCard
          title="Approved This Month"
          value={totalApproved}
          icon={CheckCircle}
          iconClassName="bg-green-100 dark:bg-green-900/30"
        />
      </div>

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
              description="No billing runs are currently awaiting your approval. Check back later."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Billing Period</TableHead>
                  <TableHead>Lines</TableHead>
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
                      <button
                        className="text-left"
                        onClick={() => router.push(`/billing/${run.id}`)}
                      >
                        <p className="text-sm font-medium hover:text-primary transition-colors">{run.customer.legalName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{run.id.slice(0, 8).toUpperCase()}</p>
                      </button>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{run.billingPeriod.name}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{run.lineItems.length} lines</span>
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
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => router.push(`/billing/${run.id}`)}
                          title="View details"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => { setRejectId(run.id); setRejectComments(""); }}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => { setApproveId(run.id); setApproveComments(""); }}
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

      {/* Approve Dialog */}
      <Dialog open={!!approveId} onOpenChange={(o) => !o && setApproveId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Approve Billing Run</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Comments (optional)</Label>
              <Textarea
                value={approveComments}
                onChange={(e) => setApproveComments(e.target.value)}
                rows={2}
                placeholder="Any notes for the submitter…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveId(null)}>Cancel</Button>
            <Button
              onClick={() => approve.mutate({ id: approveId!, comments: approveComments || undefined })}
              disabled={approve.isPending}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              {approve.isPending ? "Approving…" : "Confirm Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectId} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Return for Revision</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Reason <span className="text-destructive">*</span></Label>
              <Textarea
                value={rejectComments}
                onChange={(e) => setRejectComments(e.target.value)}
                rows={3}
                placeholder="What needs to be corrected before this can be approved?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!rejectComments.trim() || reject.isPending}
              onClick={() => reject.mutate({ id: rejectId!, comments: rejectComments })}
            >
              {reject.isPending ? "Returning…" : "Return for Revision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
