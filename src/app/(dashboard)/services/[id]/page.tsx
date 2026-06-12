"use client";

import { use, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Tag, TrendingUp } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

interface Props { params: Promise<{ id: string }> }

const ruleSchema = z.object({
  name: z.string().min(1, "Required"),
  ruleType: z.enum(["flat", "per_unit", "tiered_volume", "step"]),
  unitPrice: z.string().optional(),
  currency: z.string().default("USD"),
  effectiveDate: z.string().min(1, "Required"),
  expiryDate: z.string().optional(),
});

type RuleFormData = z.infer<typeof ruleSchema>;

const RULE_TYPE_LABELS: Record<string, string> = {
  flat: "Flat Rate",
  per_unit: "Per Unit",
  tiered_volume: "Tiered Volume",
  step: "Step Pricing",
};

export default function ServiceDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const [addRuleOpen, setAddRuleOpen] = useState(false);

  const { data: service, isLoading, refetch } = trpc.services.getById.useQuery({ id });

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<RuleFormData>({
    resolver: zodResolver(ruleSchema) as Resolver<RuleFormData>,
    defaultValues: { ruleType: "flat", currency: "USD" },
  });

  const createRule = trpc.services.createPricingRule.useMutation({
    onSuccess: () => {
      toast.success("Pricing rule created");
      reset();
      setAddRuleOpen(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleActive = trpc.services.update.useMutation({
    onSuccess: () => { toast.success("Service updated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  }

  if (!service) {
    return <div className="py-24 text-center text-muted-foreground">Service not found.</div>;
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title={service.name} description={`${service.code} · ${service.category.replace(/_/g, " ")}`}>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Active</span>
            <Switch
              checked={service.isActive}
              onCheckedChange={(checked) => toggleActive.mutate({ id, data: { isActive: checked } })}
            />
          </div>
        </PageHeader>
      </div>

      {/* Service info */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">Service Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-sm">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Billing Type</p>
            <Badge variant="info" className="capitalize">{service.billingType}</Badge>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Unit of Measure</p>
            <p className="font-medium">{service.unitOfMeasure ?? "—"}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">GL Code</p>
            <p className="font-medium font-mono">{service.glCode ?? "—"}</p>
          </div>
          {service.description && (
            <div className="col-span-3 space-y-0.5">
              <p className="text-xs text-muted-foreground">Description</p>
              <p>{service.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing Rules */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            Pricing Rules
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setAddRuleOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Rule
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {!service.pricingRules?.length ? (
            <EmptyState
              icon={TrendingUp}
              title="No pricing rules"
              description="Add pricing rules to use this service in contracts."
              className="py-10"
            >
              <Button size="sm" variant="outline" onClick={() => setAddRuleOpen(true)}>
                <Plus className="h-4 w-4" /> Add Rule
              </Button>
            </EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {service.pricingRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{RULE_TYPE_LABELS[rule.ruleType]}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums text-sm">
                        {rule.unitPrice ? formatCurrency(rule.unitPrice, rule.currency) : "—"}
                      </span>
                    </TableCell>
                    <TableCell>{rule.currency}</TableCell>
                    <TableCell>{formatDate(rule.effectiveDate)}</TableCell>
                    <TableCell>{rule.expiryDate ? formatDate(rule.expiryDate) : "Open"}</TableCell>
                    <TableCell>
                      <Badge variant={rule.isActive ? "success" : "secondary"}>
                        {rule.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Pricing Rule Dialog */}
      <Dialog open={addRuleOpen} onOpenChange={setAddRuleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Pricing Rule</DialogTitle></DialogHeader>
          <form
            onSubmit={handleSubmit((d) => createRule.mutate({ ...d, serviceId: id }))}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Rule Name <span className="text-destructive">*</span></Label>
              <Input {...register("name")} placeholder="Standard Rate 2026" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Rule Type</Label>
                <Select defaultValue="flat" onValueChange={(v) => setValue("ruleType", v as RuleFormData["ruleType"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat Rate</SelectItem>
                    <SelectItem value="per_unit">Per Unit</SelectItem>
                    <SelectItem value="tiered_volume">Tiered Volume</SelectItem>
                    <SelectItem value="step">Step Pricing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
            </div>

            <div className="space-y-1.5">
              <Label>Unit Price</Label>
              <Input {...register("unitPrice")} type="number" step="0.0001" placeholder="0.0000" />
            </div>

            <div className="grid grid-cols-2 gap-3">
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddRuleOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createRule.isPending}>
                {createRule.isPending ? "Creating…" : "Create Rule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
