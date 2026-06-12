"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useUser } from "@clerk/nextjs";
import { Building2, Users, Shield, Bell } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const { user } = useUser();

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
    </div>
  );
}
