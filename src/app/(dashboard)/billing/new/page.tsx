"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Zap, FileText, CheckCircle, AlertTriangle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";

export default function NewBillingRunPage() {
  const router = useRouter();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  const { data: periods } = trpc.billing.listPeriods.useQuery();
  const { data: customers } = trpc.customers.list.useQuery({ status: "active", limit: 100 });
  const { data: contracts } = trpc.contracts.list.useQuery(
    { customerId: selectedCustomerId, status: "active", limit: 50 },
    { enabled: !!selectedCustomerId }
  );
  const { data: selectedContract } = trpc.contracts.getById.useQuery(
    { id: selectedContractId },
    { enabled: !!selectedContractId }
  );

  const generateFromContract = trpc.billing.generateFromContract.useMutation({
    onSuccess: (run) => {
      toast.success("Billing run generated from contract");
      router.push(`/billing/${run.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const openPeriods = periods?.filter((p) => p.status === "open") ?? [];
  const monthlyTotal = selectedContract?.lineItems
    .filter((li) => li.billingFrequency === "monthly")
    .reduce((s, li) => s + parseFloat(li.unitPrice), 0) ?? 0;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="New Billing Run" description="Generate a billing run for a customer" />
      </div>

      {/* Method selector */}
      <div className="grid grid-cols-1 gap-3">
        <Card className="border-2 border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-4">
            <div className="mt-0.5 h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-primary/20">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Generate from Contract</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Auto-populate fixed billing lines from an active contract. Variable lines can be added after.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Billing Period */}
          <div className="space-y-1.5">
            <Label>Billing Period <span className="text-destructive">*</span></Label>
            {openPeriods.length === 0 ? (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No open billing periods. <a href="/billing/periods" className="underline font-medium">Create one first.</a>
                </AlertDescription>
              </Alert>
            ) : (
              <Select onValueChange={setSelectedPeriodId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select billing period…" />
                </SelectTrigger>
                <SelectContent>
                  {openPeriods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({formatDate(p.periodStart)} – {formatDate(p.periodEnd)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Customer */}
          <div className="space-y-1.5">
            <Label>Customer <span className="text-destructive">*</span></Label>
            <Select onValueChange={(v) => { setSelectedCustomerId(v); setSelectedContractId(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer…" />
              </SelectTrigger>
              <SelectContent>
                {customers?.items.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.legalName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contract */}
          {selectedCustomerId && (
            <div className="space-y-1.5">
              <Label>Contract <span className="text-destructive">*</span></Label>
              {!contracts?.items.length ? (
                <p className="text-sm text-muted-foreground">No active contracts for this customer.</p>
              ) : (
                <Select onValueChange={setSelectedContractId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select contract…" />
                  </SelectTrigger>
                  <SelectContent>
                    {contracts.items.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.referenceNumber} — {c.type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contract Preview */}
      {selectedContract && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Contract Preview — Lines to be Generated
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {selectedContract.lineItems
                .filter((li) => li.billingFrequency === "monthly")
                .map((li) => (
                  <div key={li.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-[10px]">Monthly</Badge>
                      <div>
                        <p className="text-sm font-medium">{li.description}</p>
                        <p className="text-xs text-muted-foreground">{li.service.name}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrency(li.unitPrice, selectedContract.currency)}
                    </span>
                  </div>
                ))}
              {selectedContract.lineItems.filter((li) => li.billingFrequency !== "monthly").length > 0 && (
                <div className="px-4 py-2 bg-muted/30">
                  <p className="text-xs text-muted-foreground">
                    {selectedContract.lineItems.filter((li) => li.billingFrequency !== "monthly").length} non-monthly line{selectedContract.lineItems.filter((li) => li.billingFrequency !== "monthly").length > 1 ? "s" : ""} excluded
                  </p>
                </div>
              )}
            </div>
            <Separator />
            <div className="flex justify-between px-4 py-3 font-semibold">
              <span>Monthly Total</span>
              <span className="tabular-nums">{formatCurrency(monthlyTotal, selectedContract.currency)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Alert variant="info">
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          After generating, you can add variable billing lines (consumption, hours, units) directly in the billing workspace.
        </AlertDescription>
      </Alert>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button
          disabled={!selectedPeriodId || !selectedContractId || generateFromContract.isPending}
          onClick={() => generateFromContract.mutate({
            contractId: selectedContractId,
            billingPeriodId: selectedPeriodId,
          })}
        >
          <Zap className="h-4 w-4" />
          {generateFromContract.isPending ? "Generating…" : "Generate Billing Run"}
        </Button>
      </div>
    </div>
  );
}
