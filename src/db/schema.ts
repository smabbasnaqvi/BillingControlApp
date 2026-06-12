import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  jsonb,
  pgEnum,
  uuid,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const tenantPlanEnum = pgEnum("tenant_plan", ["starter", "professional", "enterprise"]);
export const tenantStatusEnum = pgEnum("tenant_status", ["active", "suspended", "cancelled"]);
export const industryTypeEnum = pgEnum("industry_type", [
  "logistics",
  "security_services",
  "atm_managed_services",
  "cash_logistics",
  "other",
]);

export const userStatusEnum = pgEnum("user_status", ["active", "inactive", "invited"]);

export const customerStatusEnum = pgEnum("customer_status", ["active", "inactive", "prospect", "suspended"]);

export const contractStatusEnum = pgEnum("contract_status", [
  "draft",
  "under_review",
  "active",
  "expiring",
  "expired",
  "terminated",
]);

export const contractTypeEnum = pgEnum("contract_type", ["fixed", "variable", "mixed"]);

export const billingTypeEnum = pgEnum("billing_type", ["fixed", "variable", "tiered", "consumption"]);

export const billingFrequencyEnum = pgEnum("billing_frequency", [
  "monthly",
  "quarterly",
  "annually",
  "one_time",
]);

export const billingRunStatusEnum = pgEnum("billing_run_status", [
  "draft",
  "pending_approval",
  "approved",
  "invoiced",
  "disputed",
  "voided",
]);

export const billingPeriodStatusEnum = pgEnum("billing_period_status", [
  "open",
  "locked",
  "closed",
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
  "escalated",
  "cancelled",
]);

export const pricingRuleTypeEnum = pgEnum("pricing_rule_type", [
  "flat",
  "per_unit",
  "tiered_volume",
  "step",
]);

export const serviceCategoryEnum = pgEnum("service_category", [
  "maintenance",
  "operations",
  "transport",
  "security",
  "processing",
  "consulting",
  "other",
]);

// ─── Tenants ──────────────────────────────────────────────────────────────────

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  plan: tenantPlanEnum("plan").notNull().default("starter"),
  status: tenantStatusEnum("status").notNull().default("active"),
  industryType: industryTypeEnum("industry_type"),
  billingEmail: text("billing_email"),
  logoUrl: text("logo_url"),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkId: text("clerk_id").notNull().unique(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    email: text("email").notNull(),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    status: userStatusEnum("status").notNull().default("active"),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("users_tenant_idx").on(t.tenantId),
    uniqueIndex("users_clerk_id_idx").on(t.clerkId),
  ]
);

// ─── Roles & Permissions ──────────────────────────────────────────────────────

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  isSystemRole: boolean("is_system_role").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  resource: text("resource").notNull(),
  action: text("action").notNull(),
  description: text("description"),
});

export const rolePermissions = pgTable("role_permissions", {
  roleId: uuid("role_id")
    .notNull()
    .references(() => roles.id),
  permissionId: uuid("permission_id")
    .notNull()
    .references(() => permissions.id),
});

export const userRoles = pgTable("user_roles", {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  roleId: uuid("role_id")
    .notNull()
    .references(() => roles.id),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
});

// ─── Customers ────────────────────────────────────────────────────────────────

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    code: text("code").notNull(),
    legalName: text("legal_name").notNull(),
    tradingName: text("trading_name"),
    industry: industryTypeEnum("industry"),
    status: customerStatusEnum("status").notNull().default("active"),
    accountManagerId: uuid("account_manager_id").references(() => users.id),
    creditLimit: decimal("credit_limit", { precision: 15, scale: 2 }),
    paymentTermsDays: integer("payment_terms_days").default(30),
    billingAddress: jsonb("billing_address"),
    contacts: jsonb("contacts").default([]),
    taxNumber: text("tax_number"),
    notes: text("notes"),
    metadata: jsonb("metadata").default({}),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("customers_tenant_idx").on(t.tenantId),
    index("customers_status_idx").on(t.tenantId, t.status),
    uniqueIndex("customers_code_tenant_idx").on(t.tenantId, t.code),
  ]
);

// ─── Services ─────────────────────────────────────────────────────────────────

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    category: serviceCategoryEnum("category").notNull(),
    billingType: billingTypeEnum("billing_type").notNull(),
    unitOfMeasure: text("unit_of_measure"),
    glCode: text("gl_code"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("services_tenant_idx").on(t.tenantId),
    uniqueIndex("services_code_tenant_idx").on(t.tenantId, t.code),
  ]
);

// ─── Pricing Rules ────────────────────────────────────────────────────────────

export const pricingRules = pgTable(
  "pricing_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id),
    name: text("name").notNull(),
    ruleType: pricingRuleTypeEnum("rule_type").notNull(),
    unitPrice: decimal("unit_price", { precision: 15, scale: 4 }),
    currency: text("currency").notNull().default("USD"),
    tiers: jsonb("tiers").default([]),
    effectiveDate: date("effective_date").notNull(),
    expiryDate: date("expiry_date"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("pricing_rules_service_idx").on(t.serviceId)]
);

// ─── Contracts ────────────────────────────────────────────────────────────────

export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    referenceNumber: text("reference_number").notNull(),
    type: contractTypeEnum("type").notNull(),
    status: contractStatusEnum("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    parentContractId: uuid("parent_contract_id"),
    effectiveDate: date("effective_date").notNull(),
    expiryDate: date("expiry_date"),
    autoRenew: boolean("auto_renew").default(false).notNull(),
    noticePeriodDays: integer("notice_period_days").default(30),
    termsDocumentUrl: text("terms_document_url"),
    currency: text("currency").notNull().default("USD"),
    notes: text("notes"),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("contracts_tenant_idx").on(t.tenantId),
    index("contracts_customer_idx").on(t.customerId),
    index("contracts_status_idx").on(t.tenantId, t.status),
    uniqueIndex("contracts_ref_tenant_idx").on(t.tenantId, t.referenceNumber),
  ]
);

export const contractLineItems = pgTable(
  "contract_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id),
    pricingRuleId: uuid("pricing_rule_id").references(() => pricingRules.id),
    description: text("description").notNull(),
    quantityBasis: text("quantity_basis"),
    unitPrice: decimal("unit_price", { precision: 15, scale: 4 }).notNull(),
    billingFrequency: billingFrequencyEnum("billing_frequency").notNull(),
    escalationClause: jsonb("escalation_clause"),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("contract_line_items_contract_idx").on(t.contractId)]
);

// ─── Billing Periods ──────────────────────────────────────────────────────────

export const billingPeriods = pgTable(
  "billing_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    status: billingPeriodStatusEnum("status").notNull().default("open"),
    lockedAt: timestamp("locked_at"),
    lockedBy: uuid("locked_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("billing_periods_tenant_idx").on(t.tenantId, t.status)]
);

// ─── Billing Runs ─────────────────────────────────────────────────────────────

export const billingRuns = pgTable(
  "billing_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    billingPeriodId: uuid("billing_period_id")
      .notNull()
      .references(() => billingPeriods.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    contractId: uuid("contract_id").references(() => contracts.id),
    status: billingRunStatusEnum("status").notNull().default("draft"),
    totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull().default("0"),
    currency: text("currency").notNull().default("USD"),
    notes: text("notes"),
    generatedBy: uuid("generated_by").references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("billing_runs_tenant_idx").on(t.tenantId),
    index("billing_runs_period_idx").on(t.billingPeriodId),
    index("billing_runs_customer_idx").on(t.customerId),
    index("billing_runs_status_idx").on(t.tenantId, t.status),
  ]
);

export const billingLineItems = pgTable(
  "billing_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billingRunId: uuid("billing_run_id")
      .notNull()
      .references(() => billingRuns.id),
    contractLineItemId: uuid("contract_line_item_id").references(() => contractLineItems.id),
    serviceId: uuid("service_id").references(() => services.id),
    description: text("description").notNull(),
    quantity: decimal("quantity", { precision: 15, scale: 4 }).notNull().default("1"),
    unitPrice: decimal("unit_price", { precision: 15, scale: 4 }).notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    adjustments: jsonb("adjustments").default([]),
    sourceData: jsonb("source_data").default({}),
    isVoided: boolean("is_voided").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("billing_line_items_run_idx").on(t.billingRunId)]
);

// ─── Workflow ─────────────────────────────────────────────────────────────────

export const workflowDefinitions = pgTable("workflow_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  triggerEvent: text("trigger_event").notNull(),
  steps: jsonb("steps").notNull().default([]),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const approvalInstances = pgTable(
  "approval_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowDefinitionId: uuid("workflow_definition_id").references(() => workflowDefinitions.id),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    status: approvalStatusEnum("status").notNull().default("pending"),
    currentStep: integer("current_step").default(0),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("approval_instances_tenant_idx").on(t.tenantId, t.status),
    index("approval_instances_entity_idx").on(t.entityType, t.entityId),
  ]
);

export const approvalSteps = pgTable("approval_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  approvalInstanceId: uuid("approval_instance_id")
    .notNull()
    .references(() => approvalInstances.id),
  stepOrder: integer("step_order").notNull(),
  approverId: uuid("approver_id")
    .notNull()
    .references(() => users.id),
  status: approvalStatusEnum("status").notNull().default("pending"),
  actionedAt: timestamp("actioned_at"),
  comments: text("comments"),
  escalatedAt: timestamp("escalated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Audit Log ────────────────────────────────────────────────────────────────

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: uuid("user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("audit_log_tenant_idx").on(t.tenantId, t.createdAt),
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  customers: many(customers),
  services: many(services),
  contracts: many(contracts),
  billingPeriods: many(billingPeriods),
  billingRuns: many(billingRuns),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  userRoles: many(userRoles),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, { fields: [customers.tenantId], references: [tenants.id] }),
  accountManager: one(users, { fields: [customers.accountManagerId], references: [users.id] }),
  contracts: many(contracts),
  billingRuns: many(billingRuns),
}));

export const contractsRelations = relations(contracts, ({ one, many }) => ({
  tenant: one(tenants, { fields: [contracts.tenantId], references: [tenants.id] }),
  customer: one(customers, { fields: [contracts.customerId], references: [customers.id] }),
  lineItems: many(contractLineItems),
  billingRuns: many(billingRuns),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  tenant: one(tenants, { fields: [services.tenantId], references: [tenants.id] }),
  pricingRules: many(pricingRules),
}));

export const pricingRulesRelations = relations(pricingRules, ({ one }) => ({
  service: one(services, { fields: [pricingRules.serviceId], references: [services.id] }),
  tenant: one(tenants, { fields: [pricingRules.tenantId], references: [tenants.id] }),
}));

export const contractLineItemsRelations = relations(contractLineItems, ({ one }) => ({
  contract: one(contracts, { fields: [contractLineItems.contractId], references: [contracts.id] }),
  service: one(services, { fields: [contractLineItems.serviceId], references: [services.id] }),
}));

export const billingRunsRelations = relations(billingRuns, ({ one, many }) => ({
  tenant: one(tenants, { fields: [billingRuns.tenantId], references: [tenants.id] }),
  customer: one(customers, { fields: [billingRuns.customerId], references: [customers.id] }),
  contract: one(contracts, { fields: [billingRuns.contractId], references: [contracts.id] }),
  billingPeriod: one(billingPeriods, {
    fields: [billingRuns.billingPeriodId],
    references: [billingPeriods.id],
  }),
  lineItems: many(billingLineItems),
}));

export const billingLineItemsRelations = relations(billingLineItems, ({ one }) => ({
  billingRun: one(billingRuns, { fields: [billingLineItems.billingRunId], references: [billingRuns.id] }),
  service: one(services, { fields: [billingLineItems.serviceId], references: [services.id] }),
}));

export const approvalInstancesRelations = relations(approvalInstances, ({ one, many }) => ({
  tenant: one(tenants, { fields: [approvalInstances.tenantId], references: [tenants.id] }),
  workflowDefinition: one(workflowDefinitions, {
    fields: [approvalInstances.workflowDefinitionId],
    references: [workflowDefinitions.id],
  }),
  steps: many(approvalSteps),
}));

export const approvalStepsRelations = relations(approvalSteps, ({ one }) => ({
  approvalInstance: one(approvalInstances, {
    fields: [approvalSteps.approvalInstanceId],
    references: [approvalInstances.id],
  }),
  approver: one(users, { fields: [approvalSteps.approverId], references: [users.id] }),
}));
