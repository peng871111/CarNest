import "server-only";

import { Resend } from "resend";
import { buildAbsoluteUrl } from "@/lib/seo";

export type OfferEmailEvent =
  | "new_offer_to_seller"
  | "seller_countered_offer"
  | "seller_accepted_offer"
  | "buyer_accepted_counteroffer";

export interface OfferEmailPayload {
  event: OfferEmailEvent;
  to: string;
  vehicleTitle: string;
  amount: number;
  offerId: string;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const EMAIL_FROM = process.env.EMAIL_FROM ?? process.env.RESEND_FROM_EMAIL ?? "CarNest <offers@mail.carnest.au>";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(amount);
}

export function getOfferEmailContent(payload: OfferEmailPayload) {
  const sellerOfferUrl = buildAbsoluteUrl(`/seller/offers/${payload.offerId}`);
  const buyerOfferUrl = buildAbsoluteUrl("/dashboard/offers");

  if (payload.event === "new_offer_to_seller") {
    return {
      subject: "You’ve received a new offer on your vehicle",
      ctaUrl: sellerOfferUrl,
      ctaLabel: "Review offer",
      intro: `A new offer has been submitted on ${payload.vehicleTitle}.`,
      detail: `Current offer amount: ${formatCurrency(payload.amount)}`
    };
  }

  if (payload.event === "seller_countered_offer") {
    return {
      subject: "You’ve received a counteroffer",
      ctaUrl: buyerOfferUrl,
      ctaLabel: "Review counteroffer",
      intro: `The seller sent a counteroffer on ${payload.vehicleTitle}.`,
      detail: `Current negotiation amount: ${formatCurrency(payload.amount)}`
    };
  }

  if (payload.event === "seller_accepted_offer") {
    return {
      subject: "Your offer has been accepted",
      ctaUrl: buyerOfferUrl,
      ctaLabel: "View accepted offer",
      intro: `Your offer on ${payload.vehicleTitle} has been accepted.`,
      detail: `Accepted amount: ${formatCurrency(payload.amount)}`
    };
  }

  return {
    subject: "Your counteroffer has been accepted",
    ctaUrl: sellerOfferUrl,
    ctaLabel: "View accepted counteroffer",
    intro: `The buyer accepted your counteroffer on ${payload.vehicleTitle}.`,
    detail: `Accepted amount: ${formatCurrency(payload.amount)}`
  };
}

function renderOfferEmailHtml(payload: OfferEmailPayload) {
  const content = getOfferEmailContent(payload);
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

function renderOfferEmailText(payload: OfferEmailPayload) {
  const content = getOfferEmailContent(payload);
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

export async function sendOfferEmail(payload: OfferEmailPayload) {
  const content = getOfferEmailContent(payload);

  if (!RESEND_API_KEY || !EMAIL_FROM) {
    console.warn("[offer-email] Transactional email is not configured. Skipping email send.", {
      event: payload.event,
      offerId: payload.offerId,
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
  console.log("[offer-email] Executing resend.emails.send()", {
    event: payload.event,
    offerId: payload.offerId,
    recipientEmail: payload.to,
    subject: content.subject
  });

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: payload.to,
    subject: content.subject,
    html: renderOfferEmailHtml(payload),
    text: renderOfferEmailText(payload)
  });

  if (error) {
    console.error("[offer-email] Resend rejected email request.", {
      event: payload.event,
      offerId: payload.offerId,
      recipientEmail: payload.to,
      subject: content.subject,
      errorName: error.name,
      errorMessage: error.message
    });
    throw new Error(error.message || "Transactional email send failed.");
  }

  return {
    sent: true as const,
    skipped: false as const,
    subject: content.subject,
    providerMessageId: data?.id ?? null
  };
}
