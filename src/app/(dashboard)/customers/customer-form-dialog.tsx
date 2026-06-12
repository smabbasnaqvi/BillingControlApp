"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

const schema = z.object({
  legalName: z.string().min(2, "Required"),
  tradingName: z.string().optional(),
  industry: z.enum(["logistics", "security_services", "atm_managed_services", "cash_logistics", "other"]).optional(),
  status: z.enum(["active", "inactive", "prospect", "suspended"]).default("active"),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).default(30),
  creditLimit: z.string().optional(),
  taxNumber: z.string().optional(),
  notes: z.string().optional(),
  billingAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultValues?: Partial<FormData>;
}

export function CustomerFormDialog({ open, onOpenChange, onSuccess, defaultValues }: Props) {
  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { status: "active", paymentTermsDays: 30, ...defaultValues },
  });

  const createCustomer = trpc.customers.create.useMutation({
    onSuccess: () => {
      toast.success("Customer created successfully");
      reset();
      onOpenChange(false);
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const onSubmit = (data: FormData) => createCustomer.mutate({
    ...data,
    contacts: [],
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Customer</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Identity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="legalName">Legal Name <span className="text-destructive">*</span></Label>
              <Input id="legalName" {...register("legalName")} placeholder="Acme Corporation Ltd." />
              {errors.legalName && <p className="text-xs text-destructive">{errors.legalName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tradingName">Trading Name</Label>
              <Input id="tradingName" {...register("tradingName")} placeholder="Acme Corp" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Select onValueChange={(v) => setValue("industry", v as FormData["industry"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="logistics">Logistics</SelectItem>
                  <SelectItem value="security_services">Security Services</SelectItem>
                  <SelectItem value="atm_managed_services">ATM Managed Services</SelectItem>
                  <SelectItem value="cash_logistics">Cash Logistics</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select defaultValue="active" onValueChange={(v) => setValue("status", v as FormData["status"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Financial */}
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Financial</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="paymentTermsDays">Payment Terms (days)</Label>
              <Input id="paymentTermsDays" type="number" {...register("paymentTermsDays")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="creditLimit">Credit Limit</Label>
              <Input id="creditLimit" {...register("creditLimit")} placeholder="50000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="taxNumber">Tax / VAT Number</Label>
              <Input id="taxNumber" {...register("taxNumber")} placeholder="GB123456789" />
            </div>
          </div>

          <Separator />

          {/* Billing Address */}
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Billing Address</p>
          <div className="space-y-3">
            <Input {...register("billingAddress.street")} placeholder="Street address" />
            <div className="grid grid-cols-3 gap-3">
              <Input {...register("billingAddress.city")} placeholder="City" />
              <Input {...register("billingAddress.state")} placeholder="State / Province" />
              <Input {...register("billingAddress.postalCode")} placeholder="Postal code" />
            </div>
            <Input {...register("billingAddress.country")} placeholder="Country" />
          </div>

          <Separator />

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Internal Notes</Label>
            <Textarea id="notes" {...register("notes")} placeholder="Any internal notes about this customer…" rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || createCustomer.isPending}>
              {createCustomer.isPending ? "Creating…" : "Create Customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
