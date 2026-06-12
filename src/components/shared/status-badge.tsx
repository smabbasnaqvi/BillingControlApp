import { Badge } from "@/components/ui/badge";

type Status =
  | "active"
  | "inactive"
  | "prospect"
  | "suspended"
  | "draft"
  | "under_review"
  | "expiring"
  | "expired"
  | "terminated"
  | "pending_approval"
  | "approved"
  | "invoiced"
  | "disputed"
  | "voided"
  | "open"
  | "locked"
  | "closed"
  | "pending"
  | "rejected"
  | "cancelled"
  | "escalated";

const STATUS_CONFIG: Record<Status, { label: string; variant: "success" | "warning" | "destructive" | "info" | "secondary" | "default" }> = {
  active: { label: "Active", variant: "success" },
  inactive: { label: "Inactive", variant: "secondary" },
  prospect: { label: "Prospect", variant: "info" },
  suspended: { label: "Suspended", variant: "warning" },
  draft: { label: "Draft", variant: "secondary" },
  under_review: { label: "Under Review", variant: "info" },
  expiring: { label: "Expiring", variant: "warning" },
  expired: { label: "Expired", variant: "destructive" },
  terminated: { label: "Terminated", variant: "destructive" },
  pending_approval: { label: "Pending Approval", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  invoiced: { label: "Invoiced", variant: "success" },
  disputed: { label: "Disputed", variant: "destructive" },
  voided: { label: "Voided", variant: "secondary" },
  open: { label: "Open", variant: "success" },
  locked: { label: "Locked", variant: "secondary" },
  closed: { label: "Closed", variant: "secondary" },
  pending: { label: "Pending", variant: "warning" },
  rejected: { label: "Rejected", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "secondary" },
  escalated: { label: "Escalated", variant: "warning" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as Status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
