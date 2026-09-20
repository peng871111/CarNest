import "server-only";

import {
  createResendClient,
  getVerificationEmailFrom,
  getVehicleActionEmailMissingEnvVars
} from "@/lib/public-vehicle-action-email";
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
  vehicleId?: string;
  buyerAccess?: "guest" | "registered";
  buyerOriginalAmount?: number;
  counterAmount?: number;
}

export type OfferEmailSendResult =
  | {
      sent: true;
      skipped: false;
      subject: string;
      providerMessageId: string | null;
    }
  | {
      sent: false;
      skipped: true;
      reason: "missing_env";
      missingEnvVars: string[];
    }
  | {
      sent: false;
      skipped: false;
      reason: "resend_error";
      providerErrorName: string | null;
      providerStatusCode: number | null;
    };

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
  const publicVehicleUrl = payload.vehicleId ? buildAbsoluteUrl(`/inventory/${payload.vehicleId}`) : buildAbsoluteUrl("/inventory");
  const buyerOriginalAmount =
    typeof payload.buyerOriginalAmount === "number" && Number.isFinite(payload.buyerOriginalAmount)
      ? payload.buyerOriginalAmount
      : undefined;
  const counterAmount =
    typeof payload.counterAmount === "number" && Number.isFinite(payload.counterAmount)
      ? payload.counterAmount
      : payload.amount;

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
    const isGuestBuyer = payload.buyerAccess === "guest";
    return {
      subject: "You’ve received a counteroffer",
      ctaUrl: isGuestBuyer ? publicVehicleUrl : buyerOfferUrl,
      ctaLabel: isGuestBuyer ? "View vehicle listing" : "Review counteroffer",
      intro: `CarNest has reviewed your offer on ${payload.vehicleTitle} and sent a counter offer.`,
      detail: "You can review the key numbers below and reply through the CarNest offer flow where available.",
      details: [
        `Vehicle: ${payload.vehicleTitle}`,
        ...(buyerOriginalAmount ? [`Your original offer: ${formatCurrency(buyerOriginalAmount)}`] : []),
        `CarNest counter offer: ${formatCurrency(counterAmount)}`,
        isGuestBuyer
          ? "This email includes the counter offer amount for your records. Use the listing link below if you would like to continue with this vehicle."
          : "Sign in to your CarNest account to accept, decline, or continue the negotiation."
      ]
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
  const details = "details" in content && Array.isArray(content.details) ? content.details : [];
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1b1b18;">
      <p style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#9d6b2f;margin:0 0 12px;">CarNest</p>
      <h1 style="font-size:24px;line-height:1.3;margin:0 0 16px;">${content.subject}</h1>
      <p style="font-size:16px;line-height:1.6;margin:0 0 12px;">${content.intro}</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:#4b4b44;">${content.detail}</p>
      ${details.length ? `
        <div style="background:#fbf6ef;border:1px solid #ead8c2;border-radius:18px;padding:16px;margin:0 0 24px;">
          ${details.map((detail) => `<p style="font-size:14px;line-height:1.6;margin:0 0 8px;color:#1b1b18;">${detail}</p>`).join("")}
        </div>
      ` : ""}
      <a href="${content.ctaUrl}" style="display:inline-block;background:#1b1b18;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;">
        ${content.ctaLabel}
      </a>
      <p style="font-size:13px;line-height:1.6;margin:24px 0 0;color:#6a6a63;">If the button does not open, use this link: ${content.ctaUrl}</p>
    </div>
  `;
}

function renderOfferEmailText(payload: OfferEmailPayload) {
  const content = getOfferEmailContent(payload);
  const details = "details" in content && Array.isArray(content.details) ? content.details : [];
  return [
    "CarNest",
    "",
    content.subject,
    "",
    content.intro,
    content.detail,
    ...(details.length ? ["", ...details] : []),
    "",
    `${content.ctaLabel}: ${content.ctaUrl}`
  ].join("\n");
}

export async function sendOfferEmail(payload: OfferEmailPayload) {
  const content = getOfferEmailContent(payload);
  const from = getVerificationEmailFrom();
  const missingEnvVars = getVehicleActionEmailMissingEnvVars(from);

  if (missingEnvVars.length) {
    console.warn("[offer-email] Transactional email is not configured. Skipping email send.", {
      event: payload.event,
      offerId: payload.offerId,
      recipientEmail: payload.to,
      subject: content.subject,
      missingEnvVars
    });
    return {
      sent: false as const,
      skipped: true as const,
      reason: "missing_env" as const,
      missingEnvVars
    };
  }

  const resend = createResendClient(from);
  console.log("[offer-email] Executing resend.emails.send()", {
    event: payload.event,
    offerId: payload.offerId,
    recipientEmail: payload.to,
    subject: content.subject,
    from
  });

  const { data, error } = await resend.emails.send({
    from,
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
      statusCode: error.statusCode ?? null
    });
    return {
      sent: false as const,
      skipped: false as const,
      reason: "resend_error" as const,
      providerErrorName: error.name ?? null,
      providerStatusCode: error.statusCode ?? null
    };
  }

  return {
    sent: true as const,
    skipped: false as const,
    subject: content.subject,
    providerMessageId: data?.id ?? null
  };
}
