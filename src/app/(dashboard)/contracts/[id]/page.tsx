"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, formatRelativeDate } from "@/lib/utils";
import { ArrowLeft, FileText, CalendarDays, History, Edit } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

interface Props { params: Promise<{ id: string }> }

export default function ContractDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();

  const { data: contract, isLoading, refetch } = trpc.contracts.getById.useQuery({ id });

  const updateStatus = trpc.contracts.updateStatus.useMutation({
    onSuccess: () => { toast.success("Status updated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!contract) {
    return <div className="py-24 text-center text-muted-foreground">Contract not found.</div>;
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title={contract.referenceNumber} description={`${contract.customer.legalName} · v${contract.version}`}>
          <StatusBadge status={contract.status} />
          {contract.status === "draft" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateStatus.mutate({ id, status: "under_review" })}
            >
              Submit for Review
            </Button>
          )}
          {contract.status === "under_review" && (
            <Button
              size="sm"
              onClick={() => updateStatus.mutate({ id, status: "active" })}
            >
              Activate Contract
            </Button>
          )}
          {contract.status === "active" && (
            <Link href={`/contracts/${id}/amend`}>
              <Button size="sm" variant="outline">
                <Edit className="h-3.5 w-3.5" />
                Amend
              </Button>
            </Link>
          )}
        </PageHeader>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm font-semibold">Contract Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="font-medium">{contract.customer.legalName}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Contract Type</p>
              <p className="font-medium capitalize">{contract.type}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Effective Date</p>
              <p className="font-medium">{formatDate(contract.effectiveDate)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Expiry Date</p>
              <p className="font-medium">
                {contract.expiryDate ? (
                  <span>{formatDate(contract.expiryDate)} <span className="text-muted-foreground font-normal">({formatRelativeDate(contract.expiryDate)})</span></span>
                ) : "Open-ended"}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Currency</p>
              <p className="font-medium">{contract.currency}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Notice Period</p>
              <p className="font-medium">{contract.noticePeriodDays} days</p>
            </div>
            {contract.notes && (
              <div className="col-span-2 space-y-0.5">
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-foreground">{contract.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            Timeline
          </CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{formatDate(contract.createdAt)}</span>
            </div>
            {contract.approvedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Approved</span>
                <span>{formatDate(contract.approvedAt)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Auto-renew</span>
              <span>{contract.autoRenew ? "Yes" : "No"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Line Items
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!contract.lineItems.length ? (
            <p className="px-6 py-6 text-sm text-muted-foreground">No line items defined.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contract.lineItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-sm">{item.description}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.service.name}</TableCell>
                    <TableCell className="capitalize text-sm">{item.billingFrequency.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-sm">
                      {formatCurrency(item.unitPrice, contract.currency)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={3} className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Monthly Total
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {formatCurrency(
                      contract.lineItems
                        .filter((li) => li.billingFrequency === "monthly")
                        .reduce((sum, li) => sum + parseFloat(li.unitPrice), 0),
                      contract.currency
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
