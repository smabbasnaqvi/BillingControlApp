import { router, protectedProcedure } from "../trpc";
import {
  customers,
  services,
  pricingRules,
  contracts,
  contractLineItems,
  billingPeriods,
  billingRuns,
  billingLineItems,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const seedRouter = router({
  seedDemoData: protectedProcedure.mutation(async ({ ctx }) => {
    const tenantId = ctx.tenant.id;
    const userId = ctx.user.id;

    // ── 1. Customers ──────────────────────────────────────────────────────

    const [c1, c2, c3, c4] = await ctx.db
      .insert(customers)
      .values([
        {
          tenantId,
          code: "CUST-ARMG",
          legalName: "Armaguard Security Pty Ltd",
          tradingName: "Armaguard",
          industry: "security_services",
          status: "active",
          paymentTermsDays: 30,
          creditLimit: "500000",
          taxNumber: "ABN 12 345 678 901",
          contacts: [
            { name: "James Whitfield", email: "j.whitfield@armaguard.com.au", phone: "+61 2 9876 5432", role: "Finance Manager", isPrimary: true },
            { name: "Sarah Chen", email: "s.chen@armaguard.com.au", role: "Billing Contact", isPrimary: false },
          ],
          billingAddress: { street: "123 Security Blvd", city: "Sydney", state: "NSW", postalCode: "2000", country: "Australia" },
          createdBy: userId,
        },
        {
          tenantId,
          code: "CUST-PROS",
          legalName: "Prosegur Cash Australia Pty Ltd",
          tradingName: "Prosegur Cash",
          industry: "cash_logistics",
          status: "active",
          paymentTermsDays: 45,
          creditLimit: "750000",
          taxNumber: "ABN 98 765 432 109",
          contacts: [
            { name: "Michael Torres", email: "m.torres@prosegur.com.au", phone: "+61 3 9123 4567", role: "Accounts Payable", isPrimary: true },
          ],
          billingAddress: { street: "456 Logistics Ct", city: "Melbourne", state: "VIC", postalCode: "3000", country: "Australia" },
          createdBy: userId,
        },
        {
          tenantId,
          code: "CUST-G4S",
          legalName: "G4S Secure Solutions (Australia) Pty Ltd",
          tradingName: "G4S",
          industry: "security_services",
          status: "active",
          paymentTermsDays: 30,
          creditLimit: "600000",
          taxNumber: "ABN 55 111 222 333",
          contacts: [
            { name: "David Park", email: "d.park@g4s.com.au", phone: "+61 7 3456 7890", role: "Contract Manager", isPrimary: true },
          ],
          billingAddress: { street: "789 Guard Ave", city: "Brisbane", state: "QLD", postalCode: "4000", country: "Australia" },
          createdBy: userId,
        },
        {
          tenantId,
          code: "CUST-BRNK",
          legalName: "Brinks Australia Pty Ltd",
          tradingName: "Brinks",
          industry: "atm_managed_services",
          status: "active",
          paymentTermsDays: 30,
          creditLimit: "400000",
          taxNumber: "ABN 77 444 555 666",
          contacts: [
            { name: "Amanda Liu", email: "a.liu@brinks.com.au", phone: "+61 8 9012 3456", role: "Finance Director", isPrimary: true },
          ],
          billingAddress: { street: "321 ATM Lane", city: "Perth", state: "WA", postalCode: "6000", country: "Australia" },
          createdBy: userId,
        },
      ])
      .returning();

    // ── 2. Services ───────────────────────────────────────────────────────

    const [s1, s2, s3, s4, s5] = await ctx.db
      .insert(services)
      .values([
        {
          tenantId,
          code: "SVC-PATROL",
          name: "Monthly Site Patrol",
          description: "Regular scheduled security patrols at customer premises",
          category: "security",
          billingType: "fixed",
          unitOfMeasure: "month",
          glCode: "4001",
          isActive: true,
        },
        {
          tenantId,
          code: "SVC-ATM",
          name: "ATM Cash Loading",
          description: "On-site ATM replenishment and cash loading service",
          category: "operations",
          billingType: "variable",
          unitOfMeasure: "visit",
          glCode: "4002",
          isActive: true,
        },
        {
          tenantId,
          code: "SVC-CIT",
          name: "Cash In Transit",
          description: "Secured cash collection and delivery between locations",
          category: "transport",
          billingType: "fixed",
          unitOfMeasure: "month",
          glCode: "4003",
          isActive: true,
        },
        {
          tenantId,
          code: "SVC-MON",
          name: "24/7 Monitoring & Response",
          description: "Round-the-clock alarm monitoring with rapid response",
          category: "security",
          billingType: "fixed",
          unitOfMeasure: "month",
          glCode: "4004",
          isActive: true,
        },
        {
          tenantId,
          code: "SVC-PROC",
          name: "Cash Processing",
          description: "Counting, sorting, and processing of cash deposits",
          category: "processing",
          billingType: "variable",
          unitOfMeasure: "unit",
          glCode: "4005",
          isActive: true,
        },
      ])
      .returning();

    // ── 3. Pricing Rules ──────────────────────────────────────────────────

    await ctx.db.insert(pricingRules).values([
      { tenantId, serviceId: s1.id, name: "Standard Patrol Rate", ruleType: "flat", unitPrice: "2500.00", currency: "USD", effectiveDate: "2025-01-01", isActive: true },
      { tenantId, serviceId: s2.id, name: "Per Visit Rate", ruleType: "per_unit", unitPrice: "85.00", currency: "USD", effectiveDate: "2025-01-01", isActive: true },
      { tenantId, serviceId: s3.id, name: "CIT Monthly Rate", ruleType: "flat", unitPrice: "4200.00", currency: "USD", effectiveDate: "2025-01-01", isActive: true },
      { tenantId, serviceId: s4.id, name: "Monitoring Monthly Rate", ruleType: "flat", unitPrice: "1800.00", currency: "USD", effectiveDate: "2025-01-01", isActive: true },
      { tenantId, serviceId: s5.id, name: "Per Unit Processing", ruleType: "per_unit", unitPrice: "0.50", currency: "USD", effectiveDate: "2025-01-01", isActive: true },
    ]);

    // ── 4. Contracts ──────────────────────────────────────────────────────

    const today = new Date();
    const in20Days = new Date(today); in20Days.setDate(today.getDate() + 20);
    const in60Days = new Date(today); in60Days.setDate(today.getDate() + 60);
    const in365Days = new Date(today); in365Days.setDate(today.getDate() + 365);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const [con1, con2, con3, con4] = await ctx.db
      .insert(contracts)
      .values([
        {
          tenantId, customerId: c1.id, referenceNumber: "CON-2025-001",
          type: "fixed", status: "active", version: 1,
          effectiveDate: "2025-01-01", expiryDate: fmt(in365Days),
          autoRenew: true, noticePeriodDays: 30, currency: "USD",
          notes: "Annual security services contract — auto-renewing",
          createdBy: userId,
        },
        {
          tenantId, customerId: c2.id, referenceNumber: "CON-2025-002",
          type: "mixed", status: "active", version: 1,
          effectiveDate: "2025-01-01", expiryDate: fmt(in60Days),
          autoRenew: false, noticePeriodDays: 30, currency: "USD",
          notes: "Mixed fixed/variable — expiring soon, renewal in progress",
          createdBy: userId,
        },
        {
          tenantId, customerId: c3.id, referenceNumber: "CON-2025-003",
          type: "fixed", status: "active", version: 1,
          effectiveDate: "2025-01-01", expiryDate: fmt(in20Days),
          autoRenew: false, noticePeriodDays: 14, currency: "USD",
          notes: "URGENT: Expiring in under 30 days — amendment required",
          createdBy: userId,
        },
        {
          tenantId, customerId: c4.id, referenceNumber: "CON-2025-004",
          type: "variable", status: "active", version: 1,
          effectiveDate: "2025-03-01", expiryDate: fmt(in365Days),
          autoRenew: true, noticePeriodDays: 60, currency: "USD",
          notes: "ATM managed services — variable billing based on visits",
          createdBy: userId,
        },
      ])
      .returning();

    // ── 5. Contract Line Items ────────────────────────────────────────────

    const [cli1, cli2, cli3, cli4, cli5, cli6, cli7] = await ctx.db
      .insert(contractLineItems)
      .values([
        // Armaguard: Patrol + Monitoring
        { contractId: con1.id, serviceId: s1.id, description: "Monthly Site Patrol — 3 locations", unitPrice: "7500.00", billingFrequency: "monthly", sortOrder: 1 },
        { contractId: con1.id, serviceId: s4.id, description: "24/7 Monitoring & Response", unitPrice: "1800.00", billingFrequency: "monthly", sortOrder: 2 },
        // Prosegur: CIT + Cash Processing
        { contractId: con2.id, serviceId: s3.id, description: "Cash In Transit — daily route", unitPrice: "4200.00", billingFrequency: "monthly", sortOrder: 1 },
        { contractId: con2.id, serviceId: s5.id, description: "Cash Processing — est. 50,000 units", unitPrice: "0.50", billingFrequency: "monthly", sortOrder: 2 },
        // G4S: Patrol only
        { contractId: con3.id, serviceId: s1.id, description: "Monthly Site Patrol — 2 locations", unitPrice: "5000.00", billingFrequency: "monthly", sortOrder: 1 },
        // Brinks: ATM Loading + Monitoring
        { contractId: con4.id, serviceId: s2.id, description: "ATM Cash Loading — est. 80 visits/month", unitPrice: "6800.00", billingFrequency: "monthly", sortOrder: 1 },
        { contractId: con4.id, serviceId: s4.id, description: "24/7 ATM Monitoring", unitPrice: "1800.00", billingFrequency: "monthly", sortOrder: 2 },
      ])
      .returning();

    // ── 6. Billing Periods ────────────────────────────────────────────────

    const [bp1, bp2] = await ctx.db
      .insert(billingPeriods)
      .values([
        { tenantId, name: "May 2026", periodStart: "2026-05-01", periodEnd: "2026-05-31", status: "locked", lockedAt: new Date("2026-06-01"), lockedBy: userId },
        { tenantId, name: "June 2026", periodStart: "2026-06-01", periodEnd: "2026-06-30", status: "open" },
      ])
      .returning();

    // ── 7. Billing Runs ───────────────────────────────────────────────────

    const [br1, br2, br3, br4, br5] = await ctx.db
      .insert(billingRuns)
      .values([
        // May (locked period) — all approved/invoiced
        { tenantId, billingPeriodId: bp1.id, customerId: c1.id, contractId: con1.id, status: "invoiced", totalAmount: "9300.00", currency: "USD", generatedBy: userId, approvedBy: userId, approvedAt: new Date("2026-06-01") },
        { tenantId, billingPeriodId: bp1.id, customerId: c2.id, contractId: con2.id, status: "approved", totalAmount: "29400.00", currency: "USD", generatedBy: userId, approvedBy: userId, approvedAt: new Date("2026-06-02") },
        { tenantId, billingPeriodId: bp1.id, customerId: c3.id, contractId: con3.id, status: "approved", totalAmount: "5000.00", currency: "USD", generatedBy: userId, approvedBy: userId, approvedAt: new Date("2026-06-01") },
        // June (open period) — pending + draft
        { tenantId, billingPeriodId: bp2.id, customerId: c4.id, contractId: con4.id, status: "pending_approval", totalAmount: "8600.00", currency: "USD", generatedBy: userId },
        { tenantId, billingPeriodId: bp2.id, customerId: c1.id, contractId: con1.id, status: "draft", totalAmount: "9300.00", currency: "USD", generatedBy: userId },
      ])
      .returning();

    // ── 8. Billing Line Items ─────────────────────────────────────────────

    await ctx.db.insert(billingLineItems).values([
      // May — Armaguard (invoiced)
      { billingRunId: br1.id, contractLineItemId: cli1.id, serviceId: s1.id, description: "Monthly Site Patrol — 3 locations", quantity: "1", unitPrice: "7500.00", amount: "7500.00", sourceData: { lineType: "fixed" }, isVoided: false },
      { billingRunId: br1.id, contractLineItemId: cli2.id, serviceId: s4.id, description: "24/7 Monitoring & Response", quantity: "1", unitPrice: "1800.00", amount: "1800.00", sourceData: { lineType: "fixed" }, isVoided: false },
      // May — Prosegur (approved)
      { billingRunId: br2.id, contractLineItemId: cli3.id, serviceId: s3.id, description: "Cash In Transit — daily route", quantity: "1", unitPrice: "4200.00", amount: "4200.00", sourceData: { lineType: "fixed" }, isVoided: false },
      { billingRunId: br2.id, contractLineItemId: cli4.id, serviceId: s5.id, description: "Cash Processing — 50,000 units", quantity: "50000", unitPrice: "0.50", amount: "25000.00", sourceData: { lineType: "variable" }, isVoided: false },
      { billingRunId: br2.id, serviceId: s5.id, description: "Volume discount adjustment", quantity: "1", unitPrice: "-200.00", amount: "-200.00", sourceData: { lineType: "adjustment", adjustmentType: "discount", reason: "Volume discount — over 45,000 units" }, isVoided: false },
      // May — G4S (approved)
      { billingRunId: br3.id, contractLineItemId: cli5.id, serviceId: s1.id, description: "Monthly Site Patrol — 2 locations", quantity: "1", unitPrice: "5000.00", amount: "5000.00", sourceData: { lineType: "fixed" }, isVoided: false },
      // June — Brinks (pending approval)
      { billingRunId: br4.id, contractLineItemId: cli6.id, serviceId: s2.id, description: "ATM Cash Loading — 80 visits", quantity: "80", unitPrice: "85.00", amount: "6800.00", sourceData: { lineType: "variable" }, isVoided: false },
      { billingRunId: br4.id, contractLineItemId: cli7.id, serviceId: s4.id, description: "24/7 ATM Monitoring", quantity: "1", unitPrice: "1800.00", amount: "1800.00", sourceData: { lineType: "fixed" }, isVoided: false },
      // June — Armaguard (draft)
      { billingRunId: br5.id, contractLineItemId: cli1.id, serviceId: s1.id, description: "Monthly Site Patrol — 3 locations", quantity: "1", unitPrice: "7500.00", amount: "7500.00", sourceData: { lineType: "fixed" }, isVoided: false },
      { billingRunId: br5.id, contractLineItemId: cli2.id, serviceId: s4.id, description: "24/7 Monitoring & Response", quantity: "1", unitPrice: "1800.00", amount: "1800.00", sourceData: { lineType: "fixed" }, isVoided: false },
    ]);

    return {
      success: true,
      summary: {
        customers: 4,
        services: 5,
        contracts: 4,
        billingPeriods: 2,
        billingRuns: 5,
      },
    };
  }),
});
