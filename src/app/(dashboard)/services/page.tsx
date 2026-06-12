"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Grid3X3, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

const BILLING_TYPE_COLORS: Record<string, string> = {
  fixed: "info",
  variable: "warning",
  tiered: "default",
  consumption: "secondary",
};

const serviceSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.enum(["maintenance", "operations", "transport", "security", "processing", "consulting", "other"]),
  billingType: z.enum(["fixed", "variable", "tiered", "consumption"]),
  unitOfMeasure: z.string().optional(),
  glCode: z.string().optional(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

export default function ServicesPage() {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: services, isLoading, refetch } = trpc.services.list.useQuery({ includeInactive: true });

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
  });

  const createService = trpc.services.create.useMutation({
    onSuccess: () => {
      toast.success("Service created");
      reset();
      setCreateOpen(false);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Services & Pricing" description="Manage service catalog and pricing rules">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Service
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !services?.length ? (
            <EmptyState
              icon={Grid3X3}
              title="No services defined"
              description="Define your service catalog before creating contracts."
            >
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Add Service
              </Button>
            </EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Billing Type</TableHead>
                  <TableHead>Unit of Measure</TableHead>
                  <TableHead>GL Code</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id} className="cursor-pointer" onClick={() => router.push(`/services/${service.id}`)}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{service.name}</p>
                        {service.description && (
                          <p className="text-xs text-muted-foreground">{service.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{service.code}</span>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize text-sm">{service.category.replace(/_/g, " ")}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={(BILLING_TYPE_COLORS[service.billingType] as "info" | "warning" | "default" | "secondary") ?? "secondary"}>
                        {service.billingType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{service.unitOfMeasure ?? "—"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{service.glCode ?? "—"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={service.isActive ? "success" : "secondary"}>
                        {service.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Service</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((data) => createService.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Code <span className="text-destructive">*</span></Label>
                <Input {...register("code")} placeholder="ATM-MAINT" className="font-mono" />
                {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input {...register("name")} placeholder="ATM Maintenance" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea {...register("description")} rows={2} placeholder="Brief description of this service" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category <span className="text-destructive">*</span></Label>
                <Select onValueChange={(v) => setValue("category", v as ServiceFormData["category"])}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {["maintenance","operations","transport","security","processing","consulting","other"].map(c => (
                      <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Billing Type <span className="text-destructive">*</span></Label>
                <Select onValueChange={(v) => setValue("billingType", v as ServiceFormData["billingType"])}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="variable">Variable</SelectItem>
                    <SelectItem value="tiered">Tiered</SelectItem>
                    <SelectItem value="consumption">Consumption</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Unit of Measure</Label>
                <Input {...register("unitOfMeasure")} placeholder="e.g. hour, shift, unit" />
              </div>
              <div className="space-y-1.5">
                <Label>GL Code</Label>
                <Input {...register("glCode")} className="font-mono" placeholder="4001" />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createService.isPending}>
                {createService.isPending ? "Creating…" : "Create Service"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
