"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Suspense } from "react";

const schema = z.object({
  customerId: z.string().uuid("Select a customer"),
  type: z.enum(["fixed", "variable", "mixed"]),
  effectiveDate: z.string().min(1, "Required"),
  expiryDate: z.string().optional(),
  autoRenew: z.boolean().default(false),
  noticePeriodDays: z.coerce.number().int().min(0).default(30),
  currency: z.string().default("USD"),
  notes: z.string().optional(),
  lineItems: z.array(z.object({
    serviceId: z.string().uuid("Select a service"),
    description: z.string().min(1, "Required"),
    unitPrice: z.string().min(1, "Required"),
    billingFrequency: z.enum(["monthly", "quarterly", "annually", "one_time"]),
    sortOrder: z.number().default(0),
  })).min(1, "Add at least one line item"),
});

type FormData = z.infer<typeof schema>;

function NewContractForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultCustomerId = searchParams.get("customerId") ?? undefined;

  const { data: customers } = trpc.customers.list.useQuery({ status: "active", limit: 100 });
  const { data: services } = trpc.services.list.useQuery({});

  const { register, handleSubmit, setValue, control, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      customerId: defaultCustomerId ?? "",
      type: "fixed",
      currency: "USD",
      noticePeriodDays: 30,
      autoRenew: false,
      lineItems: [{ serviceId: "", description: "", unitPrice: "", billingFrequency: "monthly", sortOrder: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lineItems" });

  const createContract = trpc.contracts.create.useMutation({
    onSuccess: (contract) => {
      toast.success("Contract created");
      router.push(`/contracts/${contract.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form onSubmit={handleSubmit((d) => createContract.mutate(d))} className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="New Contract" description="Create a new customer contract" />
      </div>

      {/* Contract Details */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">Contract Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Customer <span className="text-destructive">*</span></Label>
            <Select
              defaultValue={defaultCustomerId}
              onValueChange={(v) => setValue("customerId", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select customer…" />
              </SelectTrigger>
              <SelectContent>
                {customers?.items.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.legalName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.customerId && <p className="text-xs text-destructive">{errors.customerId.message}</p>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select defaultValue="fixed" onValueChange={(v) => setValue("type", v as FormData["type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="variable">Variable</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Effective Date <span className="text-destructive">*</span></Label>
              <Input type="date" {...register("effectiveDate")} />
              {errors.effectiveDate && <p className="text-xs text-destructive">{errors.effectiveDate.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Expiry Date</Label>
              <Input type="date" {...register("expiryDate")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select defaultValue="USD" onValueChange={(v) => setValue("currency", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="ZAR">ZAR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notice Period (days)</Label>
              <Input type="number" {...register("noticePeriodDays")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea {...register("notes")} rows={2} placeholder="Internal notes…" />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Line Items</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ serviceId: "", description: "", unitPrice: "", billingFrequency: "monthly", sortOrder: fields.length })}
          >
            <Plus className="h-3.5 w-3.5" /> Add Line
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {errors.lineItems?.root && (
            <p className="text-xs text-destructive">{errors.lineItems.root.message}</p>
          )}
          {fields.map((field, idx) => (
            <div key={field.id} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Line {idx + 1}</p>
                {fields.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(idx)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Service</Label>
                  <Select onValueChange={(v) => setValue(`lineItems.${idx}.serviceId`, v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select service…" /></SelectTrigger>
                    <SelectContent>
                      {services?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Billing Frequency</Label>
                  <Select
                    defaultValue="monthly"
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
                  <Input
                    {...register(`lineItems.${idx}.description`)}
                    className="h-8 text-sm"
                    placeholder="Describe this charge…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Unit Price</Label>
                  <Input
                    {...register(`lineItems.${idx}.unitPrice`)}
                    className="h-8 text-sm font-mono"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={createContract.isPending}>
          {createContract.isPending ? "Creating…" : "Create Contract"}
        </Button>
      </div>
    </form>
  );
}

export default function NewContractPage() {
  return (
    <Suspense>
      <NewContractForm />
    </Suspense>
  );
}
