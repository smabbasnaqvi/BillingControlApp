"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, CalendarDays, Lock, CheckCircle, AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";

const schema = z.object({
  name: z.string().min(1, "Required"),
  periodStart: z.string().min(1, "Required"),
  periodEnd: z.string().min(1, "Required"),
});

type FormData = z.infer<typeof schema>;

export default function BillingPeriodsPage() {
  const [createOpen, setCreateOpen] = useState(false);

  const { data: periods, isLoading, refetch } = trpc.billing.listPeriods.useQuery();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const createPeriod = trpc.billing.createPeriod.useMutation({
    onSuccess: () => {
      toast.success("Billing period created");
      reset();
      setCreateOpen(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const lockPeriod = trpc.billing.lockPeriod.useMutation({
    onSuccess: () => { toast.success("Period locked"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const closePeriod = trpc.billing.closePeriod.useMutation({
    onSuccess: () => { toast.success("Period closed"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const STATUS_ICON = {
    open: <CheckCircle className="h-4 w-4 text-green-500" />,
    locked: <Lock className="h-4 w-4 text-amber-500" />,
    closed: <Lock className="h-4 w-4 text-muted-foreground" />,
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Billing Periods" description="Manage billing periods and lock cycles">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Period
        </Button>
      </PageHeader>

      <Alert variant="info">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Lock a period to prevent further changes once all billing runs are approved. Locked periods cannot be reopened.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !periods?.length ? (
            <EmptyState
              icon={CalendarDays}
              title="No billing periods"
              description="Create your first billing period to start generating billing runs."
            >
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Create Period
              </Button>
            </EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period Name</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Locked By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {STATUS_ICON[period.status]}
                        <Link
                          href={`/billing?periodId=${period.id}`}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {period.name}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(period.periodStart)}</TableCell>
                    <TableCell>{formatDate(period.periodEnd)}</TableCell>
                    <TableCell><StatusBadge status={period.status} /></TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {period.lockedAt ? formatDate(period.lockedAt) : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {period.status === "open" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => lockPeriod.mutate({ id: period.id })}
                            disabled={lockPeriod.isPending}
                          >
                            <Lock className="h-3.5 w-3.5" />
                            Lock Period
                          </Button>
                        )}
                        {period.status === "locked" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => closePeriod.mutate({ id: period.id })}
                            disabled={closePeriod.isPending}
                          >
                            Close
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Billing Period</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => createPeriod.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Period Name <span className="text-destructive">*</span></Label>
              <Input {...register("name")} placeholder="e.g. June 2026" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date <span className="text-destructive">*</span></Label>
                <Input type="date" {...register("periodStart")} />
                {errors.periodStart && <p className="text-xs text-destructive">{errors.periodStart.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>End Date <span className="text-destructive">*</span></Label>
                <Input type="date" {...register("periodEnd")} />
                {errors.periodEnd && <p className="text-xs text-destructive">{errors.periodEnd.message}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createPeriod.isPending}>
                {createPeriod.isPending ? "Creating…" : "Create Period"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
