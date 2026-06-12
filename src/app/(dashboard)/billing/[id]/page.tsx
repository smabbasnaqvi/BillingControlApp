"use client";

import { use, useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeft, Plus, Send, CheckCircle, XCircle, Trash2,
  Info, AlertTriangle, Lock, Edit2, Save, X, MinusCircle
} from "lucide-react";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface Props { params: Promise<{ id: string }> }

// Inline editable cell for variable quantity/price inputs
function EditableCell({
  value,
  onSave,
  type = "number",
  prefix,
  disabled,
}: {
  value: string;
  onSave: (v: string) => void;
  type?: "text" | "number";
  prefix?: string;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  if (disabled) {
    return (
      <span className="tabular-nums text-sm">
        {prefix}{value}
      </span>
    );
  }

  return editing ? (
    <div className="flex items-center gap-1">
      <Input
        type={type}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        className="h-7 w-24 text-sm tabular-nums py-0 px-2"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(local); setEditing(false); }
          if (e.key === "Escape") { setLocal(value); setEditing(false); }
        }}
      />
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { onSave(local); setEditing(false); }}>
        <Save className="h-3 w-3 text-green-600" />
      </Button>
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setLocal(value); setEditing(false); }}>
        <X className="h-3 w-3 text-muted-foreground" />
      </Button>
    </div>
  ) : (
    <button
      className="group flex items-center gap-1.5 rounded px-1 hover:bg-muted transition-colors text-left"
      onClick={() => { setLocal(value); setEditing(true); }}
    >
      <span className="tabular-nums text-sm">{prefix}{value}</span>
      <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// Add line item form schema
const addLineSchema = z.object({
  description: z.string().min(1, "Required"),
  quantity: z.string().min(1),
  unitPrice: z.string().min(1),
  serviceId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

// Add adjustment schema
const adjustSchema = z.object({
  description: z.string().min(1, "Required"),
  amount: z.string().min(1),
  type: z.enum(["credit", "debit"]),
  reason: z.string().optional(),
});

// Reject schema
const rejectSchema = z.object({
  comments: z.string().min(5, "Please provide a reason for rejection"),
});

export default function BillingRunDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const [addLineOpen, setAddLineOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [submitEmail, setSubmitEmail] = useState("");

  const { data: run, isLoading, refetch } = trpc.billing.getRunById.useQuery({ id });
  const { data: services } = trpc.services.list.useQuery({}, { enabled: addLineOpen });

  const utils = trpc.useUtils();

  const addLine = trpc.billing.addLineItem.useMutation({
    onSuccess: () => { toast.success("Line added"); refetch(); setAddLineOpen(false); addLineForm.reset(); },
    onError: (e) => toast.error(e.message),
  });

  const updateLine = trpc.billing.updateLineItem.useMutation({
    onSuccess: () => { refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const voidLine = trpc.billing.voidLineItem.useMutation({
    onSuccess: () => { toast.success("Line voided"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const addAdjustment = trpc.billing.addAdjustment.useMutation({
    onSuccess: () => { toast.success("Adjustment added"); refetch(); setAdjustOpen(false); adjustForm.reset(); },
    onError: (e) => toast.error(e.message),
  });

  const submitForApproval = trpc.billing.submitForApproval.useMutation({
    onSuccess: () => { toast.success("Submitted for approval"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const approve = trpc.billing.approve.useMutation({
    onSuccess: () => { toast.success("Billing run approved"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const reject = trpc.billing.reject.useMutation({
    onSuccess: () => { toast.success("Returned for revision"); refetch(); setRejectOpen(false); },
    onError: (e) => toast.error(e.message),
  });

  const voidRun = trpc.billing.voidRun.useMutation({
    onSuccess: () => { toast.success("Billing run voided"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const addLineForm = useForm<z.infer<typeof addLineSchema>>({
    resolver: zodResolver(addLineSchema) as any,
    defaultValues: { quantity: "1" },
  });

  const adjustForm = useForm<z.infer<typeof adjustSchema>>({
    resolver: zodResolver(adjustSchema) as any,
    defaultValues: { type: "credit" },
  });

  const rejectForm = useForm<z.infer<typeof rejectSchema>>({
    resolver: zodResolver(rejectSchema) as any,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!run) {
    return <div className="py-24 text-center text-muted-foreground">Billing run not found.</div>;
  }

  const isEditable = run.status === "draft";
  const isLocked = !["draft"].includes(run.status);

  // Separate line items by type
  const fixedLines = run.lineItems.filter(
    (li) => (li.sourceData as any)?.lineType !== "adjustment"
  );
  const adjustments = run.lineItems.filter(
    (li) => (li.sourceData as any)?.lineType === "adjustment"
  );

  const fixedTotal = fixedLines.reduce((s, li) => s + parseFloat(li.amount), 0);
  const adjustmentTotal = adjustments.reduce((s, li) => s + parseFloat(li.amount), 0);
  const grandTotal = parseFloat(run.totalAmount);

  return (
    <TooltipProvider>
      <div className="space-y-5 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <PageHeader
            title={`Billing Run — ${run.customer.legalName}`}
            description={`${formatDate(run.billingPeriod.periodStart)} – ${formatDate(run.billingPeriod.periodEnd)} · ${run.id.slice(0, 8).toUpperCase()}`}
          >
            <StatusBadge status={run.status} />
            {/* Action buttons based on status */}
            {run.status === "draft" && (
              <>
                <Button variant="outline" size="sm" onClick={() => setAdjustOpen(true)}>
                  <MinusCircle className="h-3.5 w-3.5" />
                  Add Adjustment
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAddLineOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Line
                </Button>
                <Button
                  size="sm"
                  onClick={() => submitForApproval.mutate({ id, approverEmail: submitEmail || undefined })}
                  disabled={submitForApproval.isPending || run.lineItems.length === 0}
                >
                  <Send className="h-3.5 w-3.5" />
                  Submit for Approval
                </Button>
              </>
            )}
            {run.status === "pending_approval" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setRejectOpen(true)}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => approve.mutate({ id })}
                  disabled={approve.isPending}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Approve
                </Button>
              </>
            )}
          </PageHeader>
        </div>

        {/* Locked banner */}
        {isLocked && run.status !== "voided" && (
          <Alert variant={run.status === "approved" ? "success" : "info"}>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              {run.status === "pending_approval"
                ? "This run is pending approval. Line items are read-only until reviewed."
                : run.status === "approved"
                ? "This billing run has been approved and is locked for editing."
                : "This billing run is locked."}
            </AlertDescription>
          </Alert>
        )}

        {/* Notes banner if rejected */}
        {run.status === "draft" && run.notes && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Returned for revision:</strong> {run.notes}
            </AlertDescription>
          </Alert>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Customer", value: run.customer.legalName },
            { label: "Period", value: `${formatDate(run.billingPeriod.periodStart)} – ${formatDate(run.billingPeriod.periodEnd)}` },
            { label: "Currency", value: run.currency },
            { label: "Line Items", value: `${run.lineItems.length} active` },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="px-4 py-3">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-sm font-medium mt-0.5 truncate">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Variable / Fixed Line Items — THE WORKSPACE */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Billing Lines
                {isEditable && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    Click a quantity or price to edit inline
                  </span>
                )}
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {fixedLines.length} line{fixedLines.length !== 1 ? "s" : ""}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {fixedLines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-sm text-muted-foreground">No line items yet.</p>
                {isEditable && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setAddLineOpen(true)}>
                    <Plus className="h-4 w-4" /> Add First Line
                  </Button>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Service</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Qty</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Unit Price</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</th>
                    {isEditable && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {fixedLines.map((li) => {
                    const isFixed = !!(li.sourceData as any)?.contractLineItemId;
                    return (
                      <tr key={li.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isFixed && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Fixed</Badge>
                                </TooltipTrigger>
                                <TooltipContent>Auto-generated from contract</TooltipContent>
                              </Tooltip>
                            )}
                            <span className="font-medium">{li.description}</span>
                            {(li.sourceData as any)?.notes && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>{(li.sourceData as any).notes}</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {li.service?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <EditableCell
                            value={li.quantity}
                            disabled={isLocked || isFixed}
                            onSave={(v) => updateLine.mutate({
                              id: li.id, billingRunId: id, quantity: v,
                            })}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <EditableCell
                            value={parseFloat(li.unitPrice).toFixed(2)}
                            disabled={isLocked || isFixed}
                            prefix=""
                            onSave={(v) => updateLine.mutate({
                              id: li.id, billingRunId: id, unitPrice: v,
                            })}
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {formatCurrency(li.amount, run.currency)}
                        </td>
                        {isEditable && (
                          <td className="px-2 py-3">
                            {!isFixed && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-destructive"
                                onClick={() => voidLine.mutate({ id: li.id, billingRunId: run.id })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Adjustments */}
        {(adjustments.length > 0 || isEditable) && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Adjustments & Credits</CardTitle>
                {isEditable && (
                  <Button variant="outline" size="sm" onClick={() => setAdjustOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> Add Adjustment
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {adjustments.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">No adjustments applied.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Reason</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {adjustments.map((adj) => {
                      const src = adj.sourceData as any;
                      const isCredit = parseFloat(adj.amount) < 0;
                      return (
                        <tr key={adj.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{adj.description}</td>
                          <td className="px-4 py-3">
                            <Badge variant={isCredit ? "success" : "warning"}>
                              {isCredit ? "Credit" : "Debit"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{src?.reason ?? "—"}</td>
                          <td className={cn(
                            "px-4 py-3 text-right font-semibold tabular-nums",
                            isCredit ? "text-green-600" : "text-foreground"
                          )}>
                            {isCredit ? "" : "+"}{formatCurrency(adj.amount, run.currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Totals Summary */}
        <Card>
          <CardContent className="p-4">
            <div className="ml-auto w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatCurrency(fixedTotal, run.currency)}</span>
              </div>
              {adjustmentTotal !== 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Adjustments</span>
                  <span className={cn("tabular-nums", adjustmentTotal < 0 ? "text-green-600" : "text-foreground")}>
                    {adjustmentTotal > 0 ? "+" : ""}{formatCurrency(adjustmentTotal, run.currency)}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-lg tabular-nums">{formatCurrency(grandTotal, run.currency)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Email input (shown when draft) */}
        {run.status === "draft" && run.lineItems.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label>Notify approver by email (optional)</Label>
                  <Input
                    type="email"
                    placeholder="approver@company.com"
                    value={submitEmail}
                    onChange={(e) => setSubmitEmail(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => submitForApproval.mutate({ id, approverEmail: submitEmail || undefined })}
                  disabled={submitForApproval.isPending}
                >
                  <Send className="h-3.5 w-3.5" />
                  Submit for Approval
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Line Item Dialog */}
        <Dialog open={addLineOpen} onOpenChange={setAddLineOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Variable Line Item</DialogTitle></DialogHeader>
            <form
              onSubmit={addLineForm.handleSubmit((d) => addLine.mutate({ ...d, billingRunId: id, lineType: "variable" }))}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label>Service (optional)</Label>
                <Select onValueChange={(v) => addLineForm.setValue("serviceId", v)}>
                  <SelectTrigger><SelectValue placeholder="Link to service…" /></SelectTrigger>
                  <SelectContent>
                    {services?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Description <span className="text-destructive">*</span></Label>
                <Input {...addLineForm.register("description")} placeholder="e.g. ATM uptime hours — June" />
                {addLineForm.formState.errors.description && (
                  <p className="text-xs text-destructive">{addLineForm.formState.errors.description.message}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Quantity <span className="text-destructive">*</span></Label>
                  <Input {...addLineForm.register("quantity")} type="number" step="0.01" placeholder="1" />
                </div>
                <div className="space-y-1.5">
                  <Label>Unit Price <span className="text-destructive">*</span></Label>
                  <Input {...addLineForm.register("unitPrice")} type="number" step="0.01" placeholder="0.00" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input {...addLineForm.register("notes")} placeholder="Internal note…" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddLineOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={addLine.isPending}>
                  {addLine.isPending ? "Adding…" : "Add Line"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add Adjustment Dialog */}
        <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Adjustment</DialogTitle></DialogHeader>
            <form
              onSubmit={adjustForm.handleSubmit((d) => addAdjustment.mutate({ ...d, billingRunId: id }))}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label>Type <span className="text-destructive">*</span></Label>
                <Select defaultValue="credit" onValueChange={(v) => adjustForm.setValue("type", v as "credit" | "debit")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Credit (reduces total)</SelectItem>
                    <SelectItem value="debit">Debit (increases total)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Description <span className="text-destructive">*</span></Label>
                <Input {...adjustForm.register("description")} placeholder="e.g. Service credit — downtime" />
              </div>
              <div className="space-y-1.5">
                <Label>Amount <span className="text-destructive">*</span></Label>
                <Input {...adjustForm.register("amount")} type="number" step="0.01" placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Reason</Label>
                <Textarea {...adjustForm.register("reason")} rows={2} placeholder="Why is this adjustment being applied?" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={addAdjustment.isPending}>
                  {addAdjustment.isPending ? "Adding…" : "Add Adjustment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Return for Revision</DialogTitle></DialogHeader>
            <form
              onSubmit={rejectForm.handleSubmit((d) => reject.mutate({ id, comments: d.comments }))}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label>Reason for rejection <span className="text-destructive">*</span></Label>
                <Textarea
                  {...rejectForm.register("comments")}
                  rows={3}
                  placeholder="Please explain what needs to be corrected…"
                />
                {rejectForm.formState.errors.comments && (
                  <p className="text-xs text-destructive">{rejectForm.formState.errors.comments.message}</p>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
                <Button type="submit" variant="destructive" disabled={reject.isPending}>
                  {reject.isPending ? "Returning…" : "Return for Revision"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
