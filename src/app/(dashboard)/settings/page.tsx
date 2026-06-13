"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useUser } from "@clerk/nextjs";
import { Building2, Users, Shield, FlaskConical, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user } = useUser();
  const [seeded, setSeeded] = useState(false);

  const seedMutation = trpc.seed.seedDemoData.useMutation({
    onSuccess: (data) => {
      setSeeded(true);
      toast.success(
        `Demo data loaded — ${data.summary.customers} customers, ${data.summary.contracts} contracts, ${data.summary.billingRuns} billing runs created.`
      );
    },
    onError: (err) => {
      toast.error(`Seed failed: ${err.message}`);
    },
  });

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader title="Settings" description="Manage your organization and account preferences" />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Organization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Organization Name</Label>
            <Input defaultValue="My Organization" />
          </div>
          <div className="space-y-1.5">
            <Label>Billing Email</Label>
            <Input defaultValue={user?.emailAddresses?.[0]?.emailAddress} type="email" />
          </div>
          <div className="space-y-1.5">
            <Label>Industry</Label>
            <Input placeholder="e.g. Cash Logistics" />
          </div>
          <Button size="sm">Save Changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">{user?.fullName ?? "You"}</p>
              <p className="text-xs text-muted-foreground">{user?.emailAddresses?.[0]?.emailAddress}</p>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">Admin</span>
          </div>
          <Separator className="my-3" />
          <Button variant="outline" size="sm">Invite Member</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Two-factor authentication</p>
              <p className="text-xs text-muted-foreground">Add an extra layer of security to your account</p>
            </div>
            <Button variant="outline" size="sm">Configure</Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Audit log</p>
              <p className="text-xs text-muted-foreground">View all actions taken in your organization</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/audit">View Log</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Demo Data */}
      <Card className="border-dashed border-amber-300 bg-amber-50/40 dark:border-amber-700 dark:bg-amber-900/10">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-amber-600" />
            Demo Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Load realistic sample data to explore the platform — 4 customers, 5 services,
            4 contracts (one expiring soon), 2 billing periods, and 5 billing runs in
            various states.
          </p>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>• Armaguard Security, Prosegur Cash, G4S, Brinks Australia</p>
            <p>• Site patrol, ATM loading, cash-in-transit, monitoring services</p>
            <p>• May 2026 (locked) + June 2026 (open) billing periods</p>
            <p>• Invoiced, approved, pending-approval, and draft runs</p>
          </div>
          {seeded ? (
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Demo data loaded — check the Dashboard and Reports
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="border-amber-400 text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
            >
              {seedMutation.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Loading…</>
              ) : (
                <><FlaskConical className="h-3.5 w-3.5 mr-1.5" />Load Demo Data</>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
