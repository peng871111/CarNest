import "server-only";

import { Resend } from "resend";
import { buildAbsoluteUrl } from "@/lib/seo";

export interface DealerInfoRequestEmailPayload {
  to: string;
  applicationId: string;
  businessName: string;
  adminNote: string;
  status?: "info_requested" | "approved" | "rejected";
  note?: string;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const EMAIL_FROM = process.env.EMAIL_FROM ?? process.env.RESEND_FROM_EMAIL ?? "";

export function getDealerInfoRequestEmailContent(payload: DealerInfoRequestEmailPayload) {
  const ctaUrl = buildAbsoluteUrl("/dealer/application-status");
  const status = payload.status ?? "info_requested";
  const statusCopy = {
    info_requested: {
      intro: `Your CarNest dealer application for ${payload.businessName || "your business"} requires additional information.`,
      detail: payload.note || payload.adminNote || "Please log in to provide the requested details."
    },
    approved: {
      intro: `Your CarNest dealer application for ${payload.businessName || "your business"} has been approved.`,
      detail: payload.note || "Please log in to continue to your dealer workspace."
    },
    rejected: {
      intro: `Your CarNest dealer application for ${payload.businessName || "your business"} has been reviewed.`,
      detail: payload.note || payload.adminNote || "Your application was not approved at this time."
    }
  }[status];

  return {
    subject: "CarNest Dealer Application Update",
    ctaUrl,
    ctaLabel: "View application status",
    intro: statusCopy.intro,
    detail: statusCopy.detail
  };
}

function renderDealerInfoRequestEmailHtml(payload: DealerInfoRequestEmailPayload) {
  const content = getDealerInfoRequestEmailContent(payload);

  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1b1b18;">
      <p style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#9d6b2f;margin:0 0 12px;">CarNest</p>
      <h1 style="font-size:24px;line-height:1.3;margin:0 0 16px;">${content.subject}</h1>
      <p style="font-size:16px;line-height:1.6;margin:0 0 12px;">${content.intro}</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:#4b4b44;">${content.detail}</p>
      <a href="${content.ctaUrl}" style="display:inline-block;background:#1b1b18;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;">
        ${content.ctaLabel}
      </a>
      <p style="font-size:13px;line-height:1.6;margin:24px 0 0;color:#6a6a63;">If the button does not open, use this link: ${content.ctaUrl}</p>
    </div>
  `;
}

function renderDealerInfoRequestEmailText(payload: DealerInfoRequestEmailPayload) {
  const content = getDealerInfoRequestEmailContent(payload);
  return [
    "CarNest",
    "",
    content.subject,
    "",
    content.intro,
    content.detail,
    "",
    `${content.ctaLabel}: ${content.ctaUrl}`
  ].join("\n");
}

export async function sendDealerInfoRequestEmail(payload: DealerInfoRequestEmailPayload) {
  const content = getDealerInfoRequestEmailContent(payload);

  if (!RESEND_API_KEY || !EMAIL_FROM) {
    console.warn("[dealer-email] Transactional email is not configured. Skipping email send.", {
      applicationId: payload.applicationId,
      recipientEmail: payload.to,
      subject: content.subject,
      missingEnvVars: [
        !RESEND_API_KEY ? "RESEND_API_KEY" : null,
        !EMAIL_FROM ? "EMAIL_FROM" : null
      ].filter(Boolean)
    });
    return { sent: false as const, skipped: true as const, reason: "missing_env" as const };
  }

  const resend = new Resend(RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: payload.to,
    subject: content.subject,
    html: renderDealerInfoRequestEmailHtml(payload),
    text: renderDealerInfoRequestEmailText(payload)
  });

  if (error) {
    console.error("[dealer-email] Resend rejected dealer info request email.", {
      applicationId: payload.applicationId,
      recipientEmail: payload.to,
      subject: content.subject,
      errorName: error.name,
      errorMessage: error.message
    });
    throw new Error(error.message || "Dealer info request email send failed.");
  }

  return {
    sent: true as const,
    skipped: false as const,
    subject: content.subject,
    providerMessageId: data?.id ?? null
  };
}
