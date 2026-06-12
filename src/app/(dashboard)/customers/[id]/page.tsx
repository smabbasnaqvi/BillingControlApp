"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, FileText, Mail, Phone, MapPin, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

export default function CustomerDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { data: customer, isLoading } = trpc.customers.getById.useQuery({ id });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-muted-foreground">Customer not found.</p>
        <Button variant="ghost" onClick={() => router.back()} className="mt-4">Go back</Button>
      </div>
    );
  }

  const contacts = (customer.contacts as Array<{ name: string; email?: string; phone?: string; role?: string; isPrimary?: boolean }>) ?? [];
  const address = customer.billingAddress as Record<string, string> | null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={customer.legalName}
          description={`${customer.code} · ${customer.industry?.replace(/_/g, " ") ?? "—"}`}
        >
          <StatusBadge status={customer.status} />
          <Button variant="outline" size="sm">Edit</Button>
        </PageHeader>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Customer Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Legal Name</p>
                <p className="font-medium">{customer.legalName}</p>
              </div>
              {customer.tradingName && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Trading Name</p>
                  <p className="font-medium">{customer.tradingName}</p>
                </div>
              )}
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Payment Terms</p>
                <p className="font-medium">{customer.paymentTermsDays ?? 30} days</p>
              </div>
              {customer.creditLimit && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Credit Limit</p>
                  <p className="font-medium">{formatCurrency(customer.creditLimit)}</p>
                </div>
              )}
              {customer.taxNumber && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Tax Number</p>
                  <p className="font-medium font-mono text-xs">{customer.taxNumber}</p>
                </div>
              )}
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Customer Since</p>
                <p className="font-medium">{formatDate(customer.createdAt)}</p>
              </div>
            </div>

            {address && (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" />
                    Billing Address
                  </p>
                  <div className="text-sm text-foreground space-y-0.5">
                    {address.street && <p>{address.street}</p>}
                    <p>
                      {[address.city, address.state, address.postalCode].filter(Boolean).join(", ")}
                    </p>
                    {address.country && <p>{address.country}</p>}
                  </div>
                </div>
              </>
            )}

            {customer.notes && (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Notes</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{customer.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contacts added yet.</p>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{contact.name}</p>
                      {contact.isPrimary && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Primary</span>
                      )}
                    </div>
                    {contact.role && <p className="text-xs text-muted-foreground">{contact.role}</p>}
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-xs text-primary hover:underline">
                        <Mail className="h-3 w-3" />
                        {contact.email}
                      </a>
                    )}
                    {contact.phone && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {contact.phone}
                      </p>
                    )}
                    {idx < contacts.length - 1 && <Separator className="mt-3" />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contracts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Contracts
          </CardTitle>
          <Link href={`/contracts/new?customerId=${customer.id}`}>
            <Button variant="outline" size="sm">New Contract</Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {!customer.contracts?.length ? (
            <p className="px-6 py-6 text-sm text-muted-foreground">No contracts yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {customer.contracts.map((contract) => (
                <Link key={contract.id} href={`/contracts/${contract.id}`}>
                  <div className="flex items-center justify-between px-6 py-3 hover:bg-muted/40 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{contract.referenceNumber}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {contract.type} · {formatDate(contract.effectiveDate)}
                        {contract.expiryDate && ` → ${formatDate(contract.expiryDate)}`}
                      </p>
                    </div>
                    <StatusBadge status={contract.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
