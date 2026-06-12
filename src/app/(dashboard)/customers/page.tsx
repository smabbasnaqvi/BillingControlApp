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
import { Plus, Search, Users, MoreHorizontal } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CustomerFormDialog } from "./customer-form-dialog";

export default function CustomersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive" | "prospect" | "suspended">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [offset, setOffset] = useState(0);

  const { data, isLoading, refetch } = trpc.customers.list.useQuery({
    search: search || undefined,
    status,
    limit: 25,
    offset,
  });

  const deleteCustomer = trpc.customers.delete.useMutation({
    onSuccess: () => refetch(),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Customers" description="Manage your customer master data">
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="h-4 w-4" />
          New Customer
        </Button>
      </PageHeader>

      <Card>
        {/* Filters */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search customers…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
              className="pl-9 h-8 text-sm"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v as typeof status); setOffset(0); }}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="prospect">Prospect</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !data?.items.length ? (
            <EmptyState
              icon={Users}
              title="No customers yet"
              description="Add your first customer to start managing contracts and billing."
            >
              <Button onClick={() => setCreateOpen(true)} size="sm">
                <Plus className="h-4 w-4" />
                Add Customer
              </Button>
            </EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Payment Terms</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((customer) => (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/customers/${customer.id}`)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{customer.legalName}</p>
                        {customer.tradingName && customer.tradingName !== customer.legalName && (
                          <p className="text-xs text-muted-foreground">{customer.tradingName}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{customer.code}</span>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize text-sm text-muted-foreground">
                        {customer.industry?.replace(/_/g, " ") ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{customer.paymentTermsDays ?? 30} days</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={customer.status} />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{formatDate(customer.createdAt)}</span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/customers/${customer.id}`)}>
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => deleteCustomer.mutate({ id: customer.id })}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Pagination */}
        {data && data.total > 25 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {offset + 1}–{Math.min(offset + 25, data.total)} of {data.total}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={offset + 25 >= data.total} onClick={() => setOffset(offset + 25)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <CustomerFormDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={() => refetch()} />
    </div>
  );
}
