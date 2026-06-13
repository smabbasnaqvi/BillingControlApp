"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Resolver } from "react-hook-form";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CheckCircle2, ChevronRight, Zap, Building2, Users, Grid3X3 } from "lucide-react";

// ── Step schemas ────────────────────────────────────────────────────────────

const orgSchema = z.object({
  orgName: z.string().min(2, "Organization name must be at least 2 characters"),
  industry: z.string().optional(),
});

const customerSchema = z.object({
  legalName: z.string().min(2, "Legal name must be at least 2 characters"),
  tradingName: z.string().optional(),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).default(30),
});

const SERVICE_CATEGORIES = [
  "maintenance",
  "operations",
  "transport",
  "security",
  "processing",
  "consulting",
  "other",
] as const;

const serviceSchema = z.object({
  name: z.string().min(2, "Service name must be at least 2 characters"),
  code: z.string().min(1, "Service code is required"),
  category: z.enum(SERVICE_CATEGORIES, { error: "Please select a category" }),
  billingType: z.enum(["fixed", "variable", "tiered", "consumption"]).default("fixed"),
});

type OrgForm = z.infer<typeof orgSchema>;
type CustomerForm = z.infer<typeof customerSchema>;
type ServiceForm = z.infer<typeof serviceSchema>;
type ServiceCategory = typeof SERVICE_CATEGORIES[number];

// ── Progress Indicator ──────────────────────────────────────────────────────

const STEPS = [
  { label: "Organization", icon: Building2 },
  { label: "First Customer", icon: Users },
  { label: "First Service", icon: Grid3X3 },
  { label: "Done!", icon: CheckCircle2 },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, idx) => {
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={idx} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                done
                  ? "bg-primary text-primary-foreground"
                  : active
                  ? "bg-primary/10 text-primary border-2 border-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
            </div>
            {!active && idx < STEPS.length - 1 && (
              <div className={cn("h-px w-8", done ? "bg-primary" : "bg-border")} />
            )}
            {active && (
              <>
                <span className="text-xs font-medium text-primary hidden sm:block">{step.label}</span>
                {idx < STEPS.length - 1 && <div className="h-px w-8 bg-border hidden sm:block" />}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Organization ────────────────────────────────────────────────────

function OrgStep({ onNext }: { onNext: (data: OrgForm) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<OrgForm>({
    resolver: zodResolver(orgSchema) as Resolver<OrgForm>,
  });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Step 1 of 3</p>
        <h2 className="text-xl font-semibold">Set up your organization</h2>
        <p className="text-sm text-muted-foreground">Tell us about your company to personalize your workspace.</p>
      </div>

      <div className="space-y-3 pt-2">
        <div className="space-y-1.5">
          <Label htmlFor="orgName">Organization Name *</Label>
          <Input id="orgName" placeholder="Acme Cash Logistics" {...register("orgName")} />
          {errors.orgName && <p className="text-xs text-destructive">{errors.orgName.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="industry">Industry</Label>
          <Input id="industry" placeholder="e.g. Cash Logistics, ATM Managed Services" {...register("industry")} />
        </div>
      </div>

      <Button type="submit" className="w-full">
        Continue
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </form>
  );
}

// ── Step 2: First Customer ──────────────────────────────────────────────────

function CustomerStep({
  onNext,
  onSkip,
}: {
  onNext: (data: CustomerForm) => Promise<void>;
  onSkip: () => void;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema) as Resolver<CustomerForm>,
    defaultValues: { paymentTermsDays: 30 },
  });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Step 2 of 3</p>
        <h2 className="text-xl font-semibold">Add your first customer</h2>
        <p className="text-sm text-muted-foreground">You can add more customers later from the Customer Master.</p>
      </div>

      <div className="space-y-3 pt-2">
        <div className="space-y-1.5">
          <Label htmlFor="legalName">Legal Name *</Label>
          <Input id="legalName" placeholder="Customer Pty Ltd" {...register("legalName")} />
          {errors.legalName && <p className="text-xs text-destructive">{errors.legalName.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tradingName">Trading Name</Label>
          <Input id="tradingName" placeholder="Trading as..." {...register("tradingName")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="paymentTermsDays">Payment Terms (days)</Label>
          <Input id="paymentTermsDays" type="number" {...register("paymentTermsDays")} />
          {errors.paymentTermsDays && <p className="text-xs text-destructive">{errors.paymentTermsDays.message}</p>}
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="flex-1" onClick={onSkip}>
          Skip for now
        </Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Continue"}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </form>
  );
}

// ── Step 3: First Service ───────────────────────────────────────────────────

function ServiceStep({
  onNext,
  onSkip,
}: {
  onNext: (data: ServiceForm) => Promise<void>;
  onSkip: () => void;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema) as Resolver<ServiceForm>,
    defaultValues: { billingType: "fixed" },
  });

  return (
    <form onSubmit={handleSubmit((data) => onNext(data as ServiceForm))} className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Step 3 of 3</p>
        <h2 className="text-xl font-semibold">Create your first service</h2>
        <p className="text-sm text-muted-foreground">Services are the billable items you include in contracts.</p>
      </div>

      <div className="space-y-3 pt-2">
        <div className="space-y-1.5">
          <Label htmlFor="svcName">Service Name *</Label>
          <Input id="svcName" placeholder="Monthly Site Visit" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="code">Service Code *</Label>
            <Input id="code" placeholder="SVC-001" {...register("code")} />
            {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Category *</Label>
            <select id="category" {...register("category")} className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
              <option value="">Select…</option>
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
            {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="flex-1" onClick={onSkip}>
          Skip for now
        </Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Finish Setup"}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </form>
  );
}

// ── Step 4: Done ────────────────────────────────────────────────────────────

function DoneStep({ onGo }: { onGo: () => void }) {
  return (
    <div className="space-y-5 text-center">
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
      </div>
      <div>
        <h2 className="text-xl font-semibold">You&apos;re all set!</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your workspace is ready. Start by creating a contract and generating your first billing run.
        </p>
      </div>
      <Button onClick={onGo} className="w-full">
        Go to Dashboard
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}

// ── Main Onboarding Page ────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const createCustomer = trpc.customers.create.useMutation();
  const createService = trpc.services.create.useMutation();

  async function handleCustomer(data: CustomerForm) {
    try {
      await createCustomer.mutateAsync({
        legalName: data.legalName,
        tradingName: data.tradingName || undefined,
        paymentTermsDays: data.paymentTermsDays,
        contacts: [],
        status: "active",
      });
      setStep(2);
    } catch {
      toast.error("Failed to create customer. Please try again.");
    }
  }

  async function handleService(data: ServiceForm) {
    try {
      await createService.mutateAsync({
        name: data.name,
        code: data.code,
        category: data.category as ServiceCategory,
        billingType: data.billingType,
        isActive: true,
      });
      setStep(3);
    } catch {
      toast.error("Failed to create service. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">BillingControl</span>
        </div>

        <StepIndicator current={step} />

        <Card>
          <CardContent className="p-6">
            {step === 0 && (
              <OrgStep onNext={() => setStep(1)} />
            )}
            {step === 1 && (
              <CustomerStep
                onNext={handleCustomer}
                onSkip={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <ServiceStep
                onNext={handleService}
                onSkip={() => setStep(3)}
              />
            )}
            {step === 3 && (
              <DoneStep onGo={() => router.push("/dashboard")} />
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          You can change all of this later in Settings
        </p>
      </div>
    </div>
  );
}
