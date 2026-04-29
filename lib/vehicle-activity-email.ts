import "server-only";

import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const EMAIL_FROM = process.env.EMAIL_FROM ?? process.env.RESEND_FROM_EMAIL ?? "CarNest <offers@mail.carnest.au>";

export interface VehicleActivityEmailPayload {
  to: string[];
  vehicleId: string;
  vehicleTitle: string;
  referenceId: string;
  message: string;
}

export function getVehicleActivityEmailContent(payload: VehicleActivityEmailPayload) {
  const supportText = [
    "If you have any questions, feel free to contact us:",
    "",
    "Email:",
    "info@carnestau.com",
    "",
    "Phone / WhatsApp:",
    "Craig: 0466661516",
    "Leon: 0406095686",
    "",
    "WeChat:",
    "Craig: Craig0490158769",
    "Leon: Morikawa_leon"
  ].join("\n");

  return {
    subject: `CarNest update: ${payload.vehicleTitle}`,
    text: [
      "Hi,",
      "",
      "We’ve made an update to your vehicle listing:",
      "",
      payload.message,
      "",
      `Vehicle: ${payload.vehicleTitle}`,
      `Reference: ${payload.referenceId}`,
      "",
      "You don’t need to log in — this is just to keep you informed.",
      "",
      supportText,
      "",
      "Regards,",
      "CarNest"
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1b1b18;">
        <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi,</p>
        <p style="font-size:16px;line-height:1.6;margin:0 0 12px;">We’ve made an update to your vehicle listing:</p>
        <div style="border:1px solid rgba(0,0,0,0.08);border-radius:18px;padding:16px;background:#faf7f2;margin:0 0 16px;">
          <p style="font-size:15px;line-height:1.7;margin:0;">${payload.message}</p>
        </div>
        <p style="font-size:15px;line-height:1.6;margin:0 0 6px;"><strong>Vehicle:</strong> ${payload.vehicleTitle}</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;"><strong>Reference:</strong> ${payload.referenceId}</p>
        <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#4b4b44;">You don’t need to log in — this is just to keep you informed.</p>
        <div style="border-top:1px solid rgba(0,0,0,0.08);margin-top:20px;padding-top:20px;">
          <p style="font-size:14px;line-height:1.7;margin:0 0 12px;">If you have any questions, feel free to contact us:</p>
          <p style="font-size:14px;line-height:1.7;margin:0 0 10px;">
            <strong>Email:</strong><br />
            info@carnestau.com
          </p>
          <p style="font-size:14px;line-height:1.7;margin:0 0 10px;">
            <strong>Phone / WhatsApp:</strong><br />
            Craig: 0466661516<br />
            Leon: 0406095686
          </p>
          <p style="font-size:14px;line-height:1.7;margin:0;">
            <strong>WeChat:</strong><br />
            Craig: Craig0490158769<br />
            Leon: Morikawa_leon
          </p>
        </div>
        <p style="font-size:14px;line-height:1.6;margin:0;">Regards,<br />CarNest</p>
      </div>
    `
  };
}

export async function sendVehicleActivityEmail(payload: VehicleActivityEmailPayload) {
  const content = getVehicleActivityEmailContent(payload);

  if (!RESEND_API_KEY || !EMAIL_FROM) {
    console.warn("[vehicle-activity-email] Transactional email is not configured. Skipping email send.", {
      vehicleId: payload.vehicleId,
      recipientEmail: payload.to.join(", "),
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
    html: content.html,
    text: content.text
  });

  if (error) {
    console.error("[vehicle-activity-email] Resend rejected customer update email.", {
      vehicleId: payload.vehicleId,
      recipientEmail: payload.to.join(", "),
      subject: content.subject,
      errorName: error.name,
      errorMessage: error.message
    });
    throw new Error(error.message || "Vehicle activity email send failed.");
  }

  return {
    sent: true as const,
    skipped: false as const,
    subject: content.subject,
    providerMessageId: data?.id ?? null
  };
}
