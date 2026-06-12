"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  create: "success",
  update: "info",
  delete: "destructive",
  status_change: "warning",
  approve: "success",
  reject: "destructive",
  submit: "info",
  lock: "secondary",
  close: "secondary",
  amend: "warning",
  generate: "info",
  login: "secondary",
  export: "secondary",
};

const PAGE_SIZE = 25;

export default function AuditLogPage() {
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(0);

  const { data, isLoading } = trpc.reports.auditLog.useQuery({
    entityType: entityType.trim() || undefined,
    action: action.trim() || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const entries = data ?? [];

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader title="Audit Log" description="Full history of all actions taken in your organization" />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Entity Type</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="e.g. customer, contract"
              value={entityType}
              onChange={(e) => { setEntityType(e.target.value); setPage(0); }}
              className="pl-8 h-8 text-sm w-44"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Action</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="e.g. create, approve"
              value={action}
              onChange={(e) => { setAction(e.target.value); setPage(0); }}
              className="pl-8 h-8 text-sm w-44"
            />
          </div>
        </div>
        {(entityType || action) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setEntityType(""); setAction(""); setPage(0); }}
          >
            Clear
          </Button>
        )}
      </div>

      <Card>
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No audit entries found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Timestamp</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Entity</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Entity ID</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">User</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(entry.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant={(ACTION_COLORS[entry.action] ?? "secondary") as "success" | "info" | "destructive" | "warning" | "secondary" | "default"}
                        className="text-xs capitalize"
                      >
                        {entry.action.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 capitalize">{entry.entityType}</td>
                    <td className="px-4 py-2.5">
                      {entry.entityId ? (
                        <span className="font-mono text-xs text-muted-foreground">{entry.entityId.slice(0, 8)}…</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {entry.userId ? (
                        <span className="font-mono text-xs text-muted-foreground">{entry.userId.slice(0, 8)}…</span>
                      ) : <span className="text-muted-foreground text-xs">System</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{entry.ipAddress ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Page {page + 1} · Showing {entries.length} entries
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={entries.length < PAGE_SIZE}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
