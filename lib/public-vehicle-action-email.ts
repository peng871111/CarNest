import "server-only";

import { Resend } from "resend";
import { formatCurrency, getVehicleDisplayReference } from "@/lib/utils";
import { Vehicle } from "@/types";
import { EMAIL_OTP_EXPIRY_MINUTES } from "@/lib/public-vehicle-action-validation";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const DEFAULT_VERIFIED_CARNEST_VERIFICATION_FROM = "CarNest <verification@mail.carnest.au>";
const DEFAULT_VERIFIED_CARNEST_ADMIN_FROM = "CarNest <offers@mail.carnest.au>";
const ADMIN_EMAIL_FROM = process.env.EMAIL_FROM ?? process.env.RESEND_FROM_EMAIL ?? DEFAULT_VERIFIED_CARNEST_ADMIN_FROM;
const ADMIN_NOTIFICATION_RECIPIENT = "info@carnest.au";

export class VehicleActionEmailProviderError extends Error {
  providerStatusCode: number | null;
  providerErrorName: string | null;

  constructor(message: string, providerStatusCode: number | null, providerErrorName: string | null) {
    super(message);
    this.name = "VehicleActionEmailProviderError";
    this.providerStatusCode = providerStatusCode;
    this.providerErrorName = providerErrorName;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isResendTestingSender(value: string) {
  return /@resend\.dev/i.test(value) || /onboarding@resend\.dev/i.test(value);
}

function getVerificationEmailFrom() {
  const configuredSender =
    process.env.VEHICLE_ACTION_VERIFICATION_EMAIL_FROM?.trim()
    || process.env.VEHICLE_ACTION_EMAIL_FROM?.trim()
    || "";

  if (configuredSender && !isResendTestingSender(configuredSender)) {
    return configuredSender;
  }

  if (configuredSender) {
    console.warn("[public-vehicle-action-email] Ignoring Resend testing sender for OTP email.", {
      configuredSenderDomain: configuredSender.split("@")[1]?.replace(/[>"]/g, "").toLowerCase() ?? "unknown"
    });
  }

  return DEFAULT_VERIFIED_CARNEST_VERIFICATION_FROM;
}

function requireResendConfiguration(from: string) {
  if (!RESEND_API_KEY || !from) {
    throw new Error([
      !RESEND_API_KEY ? "RESEND_API_KEY" : null,
      !from ? "EMAIL_FROM" : null
    ].filter(Boolean).join(", ") || "Resend configuration is missing.");
  }
}

function createResendClient(from: string) {
  requireResendConfiguration(from);
  return new Resend(RESEND_API_KEY);
}

function getStableAdminUrl(pathname: string) {
  const rawUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim()
    || process.env.NEXT_PUBLIC_APP_URL?.trim()
    || process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
    || "";

  if (!rawUrl) return "";
  if (rawUrl.includes("vercel.app") || rawUrl.includes("localhost")) return "";

  const baseUrl = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
    ? rawUrl
    : `https://${rawUrl}`;

  return new URL(pathname, baseUrl).toString();
}

function formatMelbourneDateTime(value: Date | string) {
  const parsed = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Australia/Melbourne"
  }).format(parsed);
}

function formatMelbourneDate(value: Date | string) {
  const parsed = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Melbourne"
  }).format(parsed);
}

export async function sendVehicleActionVerificationCodeEmail(email: string, code: string) {
  const from = getVerificationEmailFrom();
  const resend = createResendClient(from);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1b1b18;">
      <p style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#9d6b2f;margin:0 0 12px;">CarNest</p>
      <h1 style="font-size:24px;line-height:1.3;margin:0 0 16px;">Your CarNest verification code</h1>
      <p style="font-size:16px;line-height:1.6;margin:0 0 12px;">Your CarNest verification code is:</p>
      <p style="font-size:32px;line-height:1.2;font-weight:700;letter-spacing:0.18em;margin:0 0 16px;">${escapeHtml(code)}</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 12px;color:#4b4b44;">This code expires in ${EMAIL_OTP_EXPIRY_MINUTES} minutes.</p>
      <p style="font-size:14px;line-height:1.6;margin:0;color:#6a6a63;">If you did not request this code, you can ignore this email.</p>
    </div>
  `;
  const text = [
    "CarNest",
    "",
    "Your CarNest verification code is:",
    "",
    code,
    "",
    `This code expires in ${EMAIL_OTP_EXPIRY_MINUTES} minutes.`,
    "",
    "If you did not request this code, you can ignore this email."
  ].join("\n");

  console.log("[public-vehicle-action-email] Executing resend.emails.send()", {
    recipientEmailDomain: email.split("@")[1]?.toLowerCase() ?? "unknown",
    subject: "Your CarNest verification code",
    from
  });

  const { data, error } = await resend.emails.send({
    from,
    to: email,
    subject: "Your CarNest verification code",
    html,
    text
  });

  if (error) {
    console.error("[public-vehicle-action-email] Resend rejected verification email.", {
      recipientEmailDomain: email.split("@")[1]?.toLowerCase() ?? "unknown",
      subject: "Your CarNest verification code",
      from,
      errorName: error.name,
      errorMessage: error.message,
      statusCode: error.statusCode ?? null
    });
    throw new VehicleActionEmailProviderError(
      error.message || "Verification email send failed.",
      error.statusCode ?? null,
      error.name ?? null
    );
  }

  console.log("[public-vehicle-action-email] Resend accepted verification email.", {
    recipientEmailDomain: email.split("@")[1]?.toLowerCase() ?? "unknown",
    subject: "Your CarNest verification code",
    from,
    providerMessageId: data?.id ?? null
  });

  return {
    providerMessageId: data?.id ?? null
  };
}

function renderAdminEmailField(label: string, value?: string | null) {
  if (!value) return "";
  return `<p style="font-size:15px;line-height:1.6;margin:0 0 6px;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

export async function sendAdminOfferNotificationEmail(input: {
  vehicle: Vehicle;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  offerAmount: number;
  message?: string;
  offerPercentage: number;
  verificationMethodLabel: string;
  submittedAt: Date;
}) {
  const resend = createResendClient(ADMIN_EMAIL_FROM);
  const vehicleTitle = [input.vehicle.year, input.vehicle.make, input.vehicle.model, input.vehicle.variant].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const vehicleReference = getVehicleDisplayReference(input.vehicle);
  const adminOfferUrl = getStableAdminUrl("/admin/offers");
  const messageBlock = input.message
    ? `<p style="font-size:15px;line-height:1.7;margin:16px 0 0;white-space:pre-line;">${escapeHtml(input.message)}</p>`
    : "";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1b1b18;">
      <p style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#9d6b2f;margin:0 0 12px;">CarNest</p>
      <h1 style="font-size:24px;line-height:1.3;margin:0 0 16px;">New Verified Offer</h1>
      ${renderAdminEmailField("Vehicle", vehicleTitle)}
      ${renderAdminEmailField("CN / reference", vehicleReference)}
      ${renderAdminEmailField("Asking price", formatCurrency(input.vehicle.price))}
      ${renderAdminEmailField("Offer amount", formatCurrency(input.offerAmount))}
      ${renderAdminEmailField("Offer percentage", `${input.offerPercentage.toFixed(1)}% of asking price`)}
      ${renderAdminEmailField("Buyer name", input.buyerName)}
      ${renderAdminEmailField("Buyer email", input.buyerEmail)}
      ${renderAdminEmailField("Buyer phone", input.buyerPhone)}
      ${renderAdminEmailField("Submitted", formatMelbourneDateTime(input.submittedAt))}
      ${renderAdminEmailField("Email verification", input.verificationMethodLabel)}
      ${input.message ? `<div style="margin-top:18px;"><p style="font-size:15px;line-height:1.6;margin:0 0 6px;"><strong>Buyer message:</strong></p>${messageBlock}</div>` : ""}
      ${adminOfferUrl ? `<p style="font-size:14px;line-height:1.6;margin:18px 0 0;"><a href="${escapeHtml(adminOfferUrl)}" style="color:#1b1b18;">Open Admin Offers</a></p>` : ""}
    </div>
  `;
  const text = [
    "CarNest",
    "",
    "New Verified Offer",
    "",
    `Vehicle: ${vehicleTitle}`,
    `CN / reference: ${vehicleReference}`,
    `Asking price: ${formatCurrency(input.vehicle.price)}`,
    `Offer amount: ${formatCurrency(input.offerAmount)}`,
    `Offer percentage: ${input.offerPercentage.toFixed(1)}% of asking price`,
    `Buyer name: ${input.buyerName}`,
    `Buyer email: ${input.buyerEmail}`,
    `Buyer phone: ${input.buyerPhone}`,
    `Submitted: ${formatMelbourneDateTime(input.submittedAt)}`,
    `Email verification: ${input.verificationMethodLabel}`,
    ...(input.message ? ["", "Buyer message:", input.message] : []),
    ...(adminOfferUrl ? ["", `Open Admin Offers: ${adminOfferUrl}`] : [])
  ].join("\n");

  const { data, error } = await resend.emails.send({
    from: ADMIN_EMAIL_FROM,
    to: ADMIN_NOTIFICATION_RECIPIENT,
    subject: `New Verified Offer — ${vehicleTitle} — ${formatCurrency(input.offerAmount)}`,
    html,
    text
  });

  if (error) {
    throw new Error(error.message || "Offer admin notification failed.");
  }

  return {
    providerMessageId: data?.id ?? null
  };
}

export async function sendAdminInspectionNotificationEmail(input: {
  vehicle: Vehicle;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  preferredDate: string;
  preferredTime: string;
  message?: string;
  verificationMethodLabel: string;
  submittedAt: Date;
}) {
  const resend = createResendClient(ADMIN_EMAIL_FROM);
  const vehicleTitle = [input.vehicle.year, input.vehicle.make, input.vehicle.model, input.vehicle.variant].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const vehicleReference = getVehicleDisplayReference(input.vehicle);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1b1b18;">
      <p style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#9d6b2f;margin:0 0 12px;">CarNest</p>
      <h1 style="font-size:24px;line-height:1.3;margin:0 0 16px;">New Verified Inspection Request</h1>
      ${renderAdminEmailField("Vehicle", vehicleTitle)}
      ${renderAdminEmailField("CN / reference", vehicleReference)}
      ${renderAdminEmailField("Requester name", input.buyerName)}
      ${renderAdminEmailField("Requester email", input.buyerEmail)}
      ${renderAdminEmailField("Requester phone", input.buyerPhone)}
      ${renderAdminEmailField("Preferred date", formatInspectionDateForEmail(input.preferredDate))}
      ${renderAdminEmailField("Preferred time", input.preferredTime)}
      ${renderAdminEmailField("Submitted", formatMelbourneDateTime(input.submittedAt))}
      ${renderAdminEmailField("Email verification", input.verificationMethodLabel)}
      ${input.message ? `<div style="margin-top:18px;"><p style="font-size:15px;line-height:1.6;margin:0 0 6px;"><strong>Message:</strong></p><p style="font-size:15px;line-height:1.7;margin:0;white-space:pre-line;">${escapeHtml(input.message)}</p></div>` : ""}
    </div>
  `;
  const text = [
    "CarNest",
    "",
    "New Verified Inspection Request",
    "",
    `Vehicle: ${vehicleTitle}`,
    `CN / reference: ${vehicleReference}`,
    `Requester name: ${input.buyerName}`,
    `Requester email: ${input.buyerEmail}`,
    `Requester phone: ${input.buyerPhone}`,
    `Preferred date: ${formatInspectionDateForEmail(input.preferredDate)}`,
    `Preferred time: ${input.preferredTime}`,
    `Submitted: ${formatMelbourneDateTime(input.submittedAt)}`,
    `Email verification: ${input.verificationMethodLabel}`,
    ...(input.message ? ["", "Message:", input.message] : [])
  ].join("\n");

  const { data, error } = await resend.emails.send({
    from: ADMIN_EMAIL_FROM,
    to: ADMIN_NOTIFICATION_RECIPIENT,
    subject: `New Inspection Request — ${vehicleTitle} — ${formatMelbourneDate(input.preferredDate)}`,
    html,
    text
  });

  if (error) {
    throw new Error(error.message || "Inspection admin notification failed.");
  }

  return {
    providerMessageId: data?.id ?? null
  };
}

function formatInspectionDateForEmail(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return formatMelbourneDate(parsed);
}

export async function sendSellerOfferNotificationEmail(input: {
  to: string;
  vehicleTitle: string;
  amount: number;
  offerId: string;
}) {
  const resend = createResendClient(ADMIN_EMAIL_FROM);
  const reviewUrl = getStableAdminUrl(`/seller/offers/${input.offerId}`);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1b1b18;">
      <p style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#9d6b2f;margin:0 0 12px;">CarNest</p>
      <h1 style="font-size:24px;line-height:1.3;margin:0 0 16px;">You’ve received a new offer on your vehicle</h1>
      <p style="font-size:16px;line-height:1.6;margin:0 0 12px;">A new offer has been submitted on ${escapeHtml(input.vehicleTitle)}.</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:#4b4b44;">Current offer amount: ${escapeHtml(formatCurrency(input.amount))}</p>
      ${reviewUrl ? `<p style="font-size:14px;line-height:1.6;margin:0;"><a href="${escapeHtml(reviewUrl)}" style="color:#1b1b18;">Review offer</a></p>` : ""}
    </div>
  `;
  const text = [
    "CarNest",
    "",
    "You’ve received a new offer on your vehicle",
    "",
    `A new offer has been submitted on ${input.vehicleTitle}.`,
    `Current offer amount: ${formatCurrency(input.amount)}`,
    ...(reviewUrl ? ["", `Review offer: ${reviewUrl}`] : [])
  ].join("\n");

  const { data, error } = await resend.emails.send({
    from: ADMIN_EMAIL_FROM,
    to: input.to,
    subject: "You’ve received a new offer on your vehicle",
    html,
    text
  });

  if (error) {
    throw new Error(error.message || "Seller offer notification failed.");
  }

  return {
    providerMessageId: data?.id ?? null
  };
}
