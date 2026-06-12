import { db } from "@/db";
import { auditLog } from "@/db/schema";

type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "status_change"
  | "approve"
  | "reject"
  | "submit"
  | "lock"
  | "close"
  | "amend"
  | "generate"
  | "login"
  | "export";

interface AuditParams {
  tenantId: string;
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
  try {
    await db.insert(auditLog).values({
      tenantId: params.tenantId,
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      beforeState: params.before ?? null,
      afterState: params.after ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    });
  } catch {
    // Audit log failures are non-fatal — log to stderr only
    console.error("[audit] Failed to write audit log:", params);
  }
}

// Strips sensitive or bulky fields before storing
export function sanitizeForAudit(obj: Record<string, unknown>): Record<string, unknown> {
  const REDACT = new Set(["password", "token", "secret", "key", "creditCard"]);
  return Object.fromEntries(
    Object.entries(obj).filter(([k]) => !REDACT.has(k)).map(([k, v]) => [
      k,
      v !== null && typeof v === "object" && !Array.isArray(v)
        ? sanitizeForAudit(v as Record<string, unknown>)
        : v,
    ])
  );
}
