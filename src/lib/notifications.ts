import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface ApprovalRequestEmail {
  to: string;
  approverName: string;
  requesterName: string;
  entityType: "billing_run" | "contract";
  entityLabel: string;
  amount?: number;
  currency?: string;
  approvalUrl: string;
}

export async function sendApprovalRequestEmail(data: ApprovalRequestEmail) {
  if (!resend) return;

  const formattedAmount =
    data.amount !== undefined
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: data.currency ?? "USD" }).format(data.amount)
      : null;

  await resend.emails.send({
    from: "BillingControl <noreply@billingcontrol.app>",
    to: data.to,
    subject: `Action required: Approve ${data.entityType === "billing_run" ? "billing run" : "contract"} — ${data.entityLabel}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <div style="margin-bottom: 24px;">
          <div style="display: inline-flex; align-items: center; gap: 8px; background: #4F46E5; padding: 8px 12px; border-radius: 8px; margin-bottom: 20px;">
            <span style="color: white; font-size: 14px; font-weight: 600;">BillingControl</span>
          </div>
          <h1 style="font-size: 20px; font-weight: 600; color: #0F172A; margin: 0 0 8px;">Approval Required</h1>
          <p style="font-size: 14px; color: #64748B; margin: 0;">Hi ${data.approverName}, ${data.requesterName} has submitted a ${data.entityType === "billing_run" ? "billing run" : "contract"} for your review.</p>
        </div>

        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 12px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em;">Reference</span>
            <span style="font-size: 14px; font-weight: 500; color: #0F172A; font-family: monospace;">${data.entityLabel}</span>
          </div>
          ${formattedAmount ? `
          <div style="display: flex; justify-content: space-between; padding-top: 8px; border-top: 1px solid #E2E8F0;">
            <span style="font-size: 12px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em;">Amount</span>
            <span style="font-size: 18px; font-weight: 700; color: #0F172A;">${formattedAmount}</span>
          </div>` : ""}
        </div>

        <a href="${data.approvalUrl}" style="display: inline-block; background: #4F46E5; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
          Review &amp; Approve →
        </a>

        <p style="font-size: 12px; color: #94A3B8; margin-top: 32px;">If you weren't expecting this request, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function sendApprovalDecisionEmail(data: {
  to: string;
  requesterName: string;
  approverName: string;
  decision: "approved" | "rejected";
  entityLabel: string;
  comments?: string;
}) {
  if (!resend) return;

  const isApproved = data.decision === "approved";

  await resend.emails.send({
    from: "BillingControl <noreply@billingcontrol.app>",
    to: data.to,
    subject: `${isApproved ? "✓ Approved" : "✗ Rejected"}: ${data.entityLabel}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <h1 style="font-size: 20px; font-weight: 600; color: #0F172A; margin: 0 0 8px;">
          ${isApproved ? "Approved" : "Not Approved"}
        </h1>
        <p style="font-size: 14px; color: #64748B;">
          ${data.approverName} has ${isApproved ? "approved" : "rejected"} <strong>${data.entityLabel}</strong>.
        </p>
        ${data.comments ? `
        <div style="background: #F8FAFC; border-left: 3px solid ${isApproved ? "#22C55E" : "#EF4444"}; padding: 12px 16px; margin-top: 16px; border-radius: 4px;">
          <p style="font-size: 13px; color: #475569; margin: 0;">"${data.comments}"</p>
        </div>` : ""}
      </div>
    `,
  });
}
