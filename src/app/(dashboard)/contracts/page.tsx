"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, FileText, AlertTriangle } from "lucide-react";
import { formatDate, formatRelativeDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ContractsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const { data, isLoading } = trpc.contracts.list.useQuery({ search: search || undefined, status: status as "all" });
  const { data: expiring } = trpc.contracts.getExpiringContracts.useQuery({ withinDays: 90 });

  return (
    <div className="space-y-5">
      <PageHeader title="Contracts" description="Manage customer contracts and line items">
        <Link href="/contracts/new">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            New Contract
          </Button>
        </Link>
      </PageHeader>

      {expiring && expiring.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-sm">
            <span className="font-medium text-amber-800 dark:text-amber-200">
              {expiring.length} contract{expiring.length > 1 ? "s" : ""} expiring within 90 days.
            </span>
            <span className="ml-1 text-amber-700 dark:text-amber-300">
              Review and renew to avoid service disruption.
            </span>
          </div>
        </div>
      )}

      <Card>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Input
            placeholder="Search by reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs h-8 text-sm"
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expiring">Expiring</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="terminated">Terminated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !data?.items.length ? (
            <EmptyState
              icon={FileText}
              title="No contracts found"
              description="Create your first contract to begin billing customers."
            >
              <Link href="/contracts/new">
                <Button size="sm"><Plus className="h-4 w-4" /> New Contract</Button>
              </Link>
            </EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((contract) => (
                  <TableRow
                    key={contract.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/contracts/${contract.id}`)}
                  >
                    <TableCell>
                      <span className="font-mono text-sm font-medium">{contract.referenceNumber}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{contract.customer.legalName}</span>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize text-sm text-muted-foreground">{contract.type}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{formatDate(contract.effectiveDate)}</span>
                    </TableCell>
                    <TableCell>
                      {contract.expiryDate ? (
                        <span className="text-sm">{formatRelativeDate(contract.expiryDate)}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Open-ended</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={contract.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
