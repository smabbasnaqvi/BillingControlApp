"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, AlertTriangle, FileText } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Props { params: Promise<{ id: string }> }

const schema = z.object({
  effectiveDate: z.string().min(1, "Required"),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z.array(z.object({
    serviceId: z.string().uuid("Select a service"),
    description: z.string().min(1, "Required"),
    unitPrice: z.string().min(1),
    billingFrequency: z.enum(["monthly", "quarterly", "annually", "one_time"]),
    sortOrder: z.number().default(0),
  })).min(1),
});

type FormData = z.infer<typeof schema>;

export default function AmendContractPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();

  const { data: contract, isLoading } = trpc.contracts.getById.useQuery({ id });
  const { data: services } = trpc.services.list.useQuery({});

  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      effectiveDate: "",
      lineItems: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lineItems" });

  const amend = trpc.contracts.amend.useMutation({
    onSuccess: (amended) => {
      toast.success(`Contract amended — new version ${amended.version}`);
      router.push(`/contracts/${amended.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  }

  if (!contract) {
    return <div className="py-24 text-center text-muted-foreground">Contract not found.</div>;
  }

  // Pre-populate line items from existing contract on first render
  const handlePrePopulate = () => {
    contract.lineItems.forEach((li) => {
      append({
        serviceId: li.serviceId,
        description: li.description,
        unitPrice: li.unitPrice,
        billingFrequency: li.billingFrequency,
        sortOrder: li.sortOrder ?? 0,
      });
    });
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title="Amend Contract"
          description={`${contract.referenceNumber} — creating version ${(contract.version ?? 1) + 1}`}
        />
      </div>

      <Alert variant="warning">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Amendment terminates the current contract and creates a new version. Existing billing runs are unaffected.
          This action cannot be undone.
        </AlertDescription>
      </Alert>

      {/* Current contract summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Current Contract (v{contract.version}) — Will be Terminated
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {contract.lineItems.map((li) => (
              <div key={li.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-[10px] capitalize">{li.billingFrequency.replace(/_/g, " ")}</Badge>
                  <div>
                    <p className="text-sm font-medium">{li.description}</p>
                    <p className="text-xs text-muted-foreground">{li.service.name}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {formatCurrency(li.unitPrice, contract.currency)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit((d) => amend.mutate({ id, ...d }))} className="space-y-5">
        {/* Amendment details */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Amendment Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>New Effective Date <span className="text-destructive">*</span></Label>
                <Input type="date" {...register("effectiveDate")} />
                {errors.effectiveDate && <p className="text-xs text-destructive">{errors.effectiveDate.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>New Expiry Date</Label>
                <Input type="date" {...register("expiryDate")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Amendment Notes</Label>
              <Textarea {...register("notes")} rows={2} placeholder="Reason for amendment, key changes…" />
            </div>
          </CardContent>
        </Card>

        {/* New Line Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">New Line Items</CardTitle>
            <div className="flex gap-2">
              {fields.length === 0 && (
                <Button type="button" variant="secondary" size="sm" onClick={handlePrePopulate}>
                  Copy from Current
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ serviceId: "", description: "", unitPrice: "", billingFrequency: "monthly", sortOrder: fields.length })}
              >
                <Plus className="h-3.5 w-3.5" /> Add Line
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {errors.lineItems?.root && (
              <p className="text-xs text-destructive">{errors.lineItems.root.message}</p>
            )}
            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Click "Copy from Current" to start from existing lines, or add new lines manually.
              </p>
            ) : (
              fields.map((field, idx) => (
                <div key={field.id} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Line {idx + 1}</p>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(idx)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Service</Label>
                      <Select
                        defaultValue={field.serviceId}
                        onValueChange={(v) => setValue(`lineItems.${idx}.serviceId`, v)}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                          {services?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Frequency</Label>
                      <Select
                        defaultValue={field.billingFrequency}
                        onValueChange={(v) => setValue(`lineItems.${idx}.billingFrequency`, v as FormData["lineItems"][0]["billingFrequency"])}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="annually">Annually</SelectItem>
                          <SelectItem value="one_time">One-time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs">Description</Label>
                      <Input {...register(`lineItems.${idx}.description`)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Unit Price</Label>
                      <Input {...register(`lineItems.${idx}.unitPrice`)} className="h-8 text-sm font-mono" placeholder="0.00" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button
            type="submit"
            disabled={amend.isPending || fields.length === 0}
            variant="default"
            className="bg-amber-600 hover:bg-amber-700"
          >
            {amend.isPending ? "Amending…" : `Create Amendment (v${(contract.version ?? 1) + 1})`}
          </Button>
        </div>
      </form>
    </div>
  );
}
