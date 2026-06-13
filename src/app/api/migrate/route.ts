import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

// One-time migration endpoint — protected by a secret token
// Call with: POST /api/migrate  Header: x-migrate-token: <MIGRATE_SECRET>
export async function POST(request: Request) {
  const token = request.headers.get("x-migrate-token");
  const secret = process.env.MIGRATE_SECRET ?? "run-migration-now";

  if (token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Run each statement individually, ignoring "already exists" errors
    const statements = [
      // Enums
      `CREATE TYPE IF NOT EXISTS "public"."approval_status" AS ENUM('pending', 'approved', 'rejected', 'escalated', 'cancelled')`,
      `CREATE TYPE IF NOT EXISTS "public"."billing_frequency" AS ENUM('monthly', 'quarterly', 'annually', 'one_time')`,
      `CREATE TYPE IF NOT EXISTS "public"."billing_period_status" AS ENUM('open', 'locked', 'closed')`,
      `CREATE TYPE IF NOT EXISTS "public"."billing_run_status" AS ENUM('draft', 'pending_approval', 'approved', 'invoiced', 'disputed', 'voided')`,
      `CREATE TYPE IF NOT EXISTS "public"."billing_type" AS ENUM('fixed', 'variable', 'tiered', 'consumption')`,
      `CREATE TYPE IF NOT EXISTS "public"."contract_status" AS ENUM('draft', 'under_review', 'active', 'expiring', 'expired', 'terminated')`,
      `CREATE TYPE IF NOT EXISTS "public"."contract_type" AS ENUM('fixed', 'variable', 'mixed')`,
      `CREATE TYPE IF NOT EXISTS "public"."customer_status" AS ENUM('active', 'inactive', 'prospect', 'suspended')`,
      `CREATE TYPE IF NOT EXISTS "public"."industry_type" AS ENUM('logistics', 'security_services', 'atm_managed_services', 'cash_logistics', 'other')`,
      `CREATE TYPE IF NOT EXISTS "public"."pricing_rule_type" AS ENUM('flat', 'per_unit', 'tiered_volume', 'step')`,
      `CREATE TYPE IF NOT EXISTS "public"."service_category" AS ENUM('maintenance', 'operations', 'transport', 'security', 'processing', 'consulting', 'other')`,
      `CREATE TYPE IF NOT EXISTS "public"."tenant_plan" AS ENUM('starter', 'professional', 'enterprise')`,
      `CREATE TYPE IF NOT EXISTS "public"."tenant_status" AS ENUM('active', 'suspended', 'cancelled')`,
      `CREATE TYPE IF NOT EXISTS "public"."user_status" AS ENUM('active', 'inactive', 'invited')`,

      // Tables
      `CREATE TABLE IF NOT EXISTS "tenants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "slug" text NOT NULL UNIQUE,
        "name" text NOT NULL,
        "plan" "tenant_plan" DEFAULT 'starter' NOT NULL,
        "status" "tenant_status" DEFAULT 'active' NOT NULL,
        "industry_type" "industry_type",
        "billing_email" text,
        "logo_url" text,
        "settings" jsonb DEFAULT '{}',
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "deleted_at" timestamp
      )`,

      `CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "clerk_id" text NOT NULL UNIQUE,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
        "email" text NOT NULL,
        "name" text NOT NULL,
        "avatar_url" text,
        "status" "user_status" DEFAULT 'active' NOT NULL,
        "last_login_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "deleted_at" timestamp
      )`,

      `CREATE UNIQUE INDEX IF NOT EXISTS "users_clerk_id_idx" ON "users" ("clerk_id")`,
      `CREATE INDEX IF NOT EXISTS "users_tenant_idx" ON "users" ("tenant_id")`,

      `CREATE TABLE IF NOT EXISTS "roles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid REFERENCES "tenants"("id"),
        "name" text NOT NULL,
        "description" text,
        "is_system_role" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS "permissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "resource" text NOT NULL,
        "action" text NOT NULL,
        "description" text
      )`,

      `CREATE TABLE IF NOT EXISTS "role_permissions" (
        "role_id" uuid NOT NULL REFERENCES "roles"("id"),
        "permission_id" uuid NOT NULL REFERENCES "permissions"("id")
      )`,

      `CREATE TABLE IF NOT EXISTS "user_roles" (
        "user_id" uuid NOT NULL REFERENCES "users"("id"),
        "role_id" uuid NOT NULL REFERENCES "roles"("id"),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
        "assigned_at" timestamp DEFAULT now() NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS "customers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
        "code" text NOT NULL,
        "legal_name" text NOT NULL,
        "trading_name" text,
        "industry" "industry_type",
        "status" "customer_status" DEFAULT 'active' NOT NULL,
        "account_manager_id" uuid REFERENCES "users"("id"),
        "credit_limit" numeric(15,2),
        "payment_terms_days" integer DEFAULT 30,
        "billing_address" jsonb,
        "contacts" jsonb DEFAULT '[]',
        "tax_number" text,
        "notes" text,
        "metadata" jsonb DEFAULT '{}',
        "created_by" uuid REFERENCES "users"("id"),
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "deleted_at" timestamp
      )`,

      `CREATE INDEX IF NOT EXISTS "customers_tenant_idx" ON "customers" ("tenant_id")`,
      `CREATE INDEX IF NOT EXISTS "customers_status_idx" ON "customers" ("tenant_id", "status")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "customers_code_tenant_idx" ON "customers" ("tenant_id", "code")`,

      `CREATE TABLE IF NOT EXISTS "services" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
        "code" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "category" "service_category" NOT NULL,
        "billing_type" "billing_type" NOT NULL,
        "unit_of_measure" text,
        "gl_code" text,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "deleted_at" timestamp
      )`,

      `CREATE INDEX IF NOT EXISTS "services_tenant_idx" ON "services" ("tenant_id")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "services_code_tenant_idx" ON "services" ("tenant_id", "code")`,

      `CREATE TABLE IF NOT EXISTS "pricing_rules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
        "service_id" uuid NOT NULL REFERENCES "services"("id"),
        "name" text NOT NULL,
        "rule_type" "pricing_rule_type" NOT NULL,
        "unit_price" numeric(15,4),
        "currency" text DEFAULT 'USD' NOT NULL,
        "tiers" jsonb DEFAULT '[]',
        "effective_date" date NOT NULL,
        "expiry_date" date,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )`,

      `CREATE INDEX IF NOT EXISTS "pricing_rules_service_idx" ON "pricing_rules" ("service_id")`,

      `CREATE TABLE IF NOT EXISTS "contracts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
        "customer_id" uuid NOT NULL REFERENCES "customers"("id"),
        "reference_number" text NOT NULL,
        "type" "contract_type" NOT NULL,
        "status" "contract_status" DEFAULT 'draft' NOT NULL,
        "version" integer DEFAULT 1 NOT NULL,
        "parent_contract_id" uuid,
        "effective_date" date NOT NULL,
        "expiry_date" date,
        "auto_renew" boolean DEFAULT false NOT NULL,
        "notice_period_days" integer DEFAULT 30,
        "terms_document_url" text,
        "currency" text DEFAULT 'USD' NOT NULL,
        "notes" text,
        "approved_by" uuid REFERENCES "users"("id"),
        "approved_at" timestamp,
        "created_by" uuid NOT NULL REFERENCES "users"("id"),
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "deleted_at" timestamp
      )`,

      `CREATE INDEX IF NOT EXISTS "contracts_tenant_idx" ON "contracts" ("tenant_id")`,
      `CREATE INDEX IF NOT EXISTS "contracts_customer_idx" ON "contracts" ("customer_id")`,
      `CREATE INDEX IF NOT EXISTS "contracts_status_idx" ON "contracts" ("tenant_id", "status")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "contracts_ref_tenant_idx" ON "contracts" ("tenant_id", "reference_number")`,

      `CREATE TABLE IF NOT EXISTS "contract_line_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "contract_id" uuid NOT NULL REFERENCES "contracts"("id"),
        "service_id" uuid NOT NULL REFERENCES "services"("id"),
        "pricing_rule_id" uuid REFERENCES "pricing_rules"("id"),
        "description" text NOT NULL,
        "quantity_basis" text,
        "unit_price" numeric(15,4) NOT NULL,
        "billing_frequency" "billing_frequency" NOT NULL,
        "escalation_clause" jsonb,
        "effective_from" date,
        "effective_to" date,
        "sort_order" integer DEFAULT 0,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )`,

      `CREATE INDEX IF NOT EXISTS "contract_line_items_contract_idx" ON "contract_line_items" ("contract_id")`,

      `CREATE TABLE IF NOT EXISTS "billing_periods" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
        "name" text NOT NULL,
        "period_start" date NOT NULL,
        "period_end" date NOT NULL,
        "status" "billing_period_status" DEFAULT 'open' NOT NULL,
        "locked_at" timestamp,
        "locked_by" uuid REFERENCES "users"("id"),
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )`,

      `CREATE INDEX IF NOT EXISTS "billing_periods_tenant_idx" ON "billing_periods" ("tenant_id", "status")`,

      `CREATE TABLE IF NOT EXISTS "billing_runs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
        "billing_period_id" uuid NOT NULL REFERENCES "billing_periods"("id"),
        "customer_id" uuid NOT NULL REFERENCES "customers"("id"),
        "contract_id" uuid REFERENCES "contracts"("id"),
        "status" "billing_run_status" DEFAULT 'draft' NOT NULL,
        "total_amount" numeric(15,2) DEFAULT '0' NOT NULL,
        "currency" text DEFAULT 'USD' NOT NULL,
        "notes" text,
        "generated_by" uuid REFERENCES "users"("id"),
        "approved_by" uuid REFERENCES "users"("id"),
        "approved_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )`,

      `CREATE INDEX IF NOT EXISTS "billing_runs_tenant_idx" ON "billing_runs" ("tenant_id")`,
      `CREATE INDEX IF NOT EXISTS "billing_runs_period_idx" ON "billing_runs" ("billing_period_id")`,
      `CREATE INDEX IF NOT EXISTS "billing_runs_customer_idx" ON "billing_runs" ("customer_id")`,
      `CREATE INDEX IF NOT EXISTS "billing_runs_status_idx" ON "billing_runs" ("tenant_id", "status")`,

      `CREATE TABLE IF NOT EXISTS "billing_line_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "billing_run_id" uuid NOT NULL REFERENCES "billing_runs"("id"),
        "contract_line_item_id" uuid REFERENCES "contract_line_items"("id"),
        "service_id" uuid REFERENCES "services"("id"),
        "description" text NOT NULL,
        "quantity" numeric(15,4) DEFAULT '1' NOT NULL,
        "unit_price" numeric(15,4) NOT NULL,
        "amount" numeric(15,2) NOT NULL,
        "adjustments" jsonb DEFAULT '[]',
        "source_data" jsonb DEFAULT '{}',
        "is_voided" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )`,

      `CREATE INDEX IF NOT EXISTS "billing_line_items_run_idx" ON "billing_line_items" ("billing_run_id")`,

      `CREATE TABLE IF NOT EXISTS "workflow_definitions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
        "name" text NOT NULL,
        "entity_type" text NOT NULL,
        "steps" jsonb DEFAULT '[]' NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_by" uuid REFERENCES "users"("id"),
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS "approval_instances" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
        "workflow_definition_id" uuid REFERENCES "workflow_definitions"("id"),
        "entity_type" text NOT NULL,
        "entity_id" uuid NOT NULL,
        "status" "approval_status" DEFAULT 'pending' NOT NULL,
        "current_step" integer DEFAULT 1 NOT NULL,
        "initiated_by" uuid REFERENCES "users"("id"),
        "completed_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )`,

      `CREATE INDEX IF NOT EXISTS "approval_instances_entity_idx" ON "approval_instances" ("entity_type", "entity_id")`,
      `CREATE INDEX IF NOT EXISTS "approval_instances_tenant_idx" ON "approval_instances" ("tenant_id", "status")`,

      `CREATE TABLE IF NOT EXISTS "approval_steps" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "approval_instance_id" uuid NOT NULL REFERENCES "approval_instances"("id"),
        "step_number" integer NOT NULL,
        "approver_id" uuid REFERENCES "users"("id"),
        "approver_role" text,
        "status" "approval_status" DEFAULT 'pending' NOT NULL,
        "comments" text,
        "decided_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS "audit_log" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
        "user_id" uuid REFERENCES "users"("id"),
        "action" text NOT NULL,
        "entity_type" text NOT NULL,
        "entity_id" uuid,
        "before_state" jsonb,
        "after_state" jsonb,
        "ip_address" text,
        "user_agent" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      )`,

      `CREATE INDEX IF NOT EXISTS "audit_log_tenant_idx" ON "audit_log" ("tenant_id")`,
      `CREATE INDEX IF NOT EXISTS "audit_log_entity_idx" ON "audit_log" ("entity_type", "entity_id")`,
    ];

    const results: string[] = [];
    for (const stmt of statements) {
      try {
        await db.execute(sql.raw(stmt));
        results.push(`OK: ${stmt.slice(0, 60)}…`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        // Ignore "already exists" errors — idempotent
        if (msg.includes("already exists")) {
          results.push(`SKIP (exists): ${stmt.slice(0, 60)}…`);
        } else {
          results.push(`ERROR: ${msg} — ${stmt.slice(0, 80)}`);
        }
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
