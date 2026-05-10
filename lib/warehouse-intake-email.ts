import "server-only";

import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
export const WAREHOUSE_INTAKE_EMAIL_FROM = process.env.EMAIL_FROM ?? "CarNest <offers@mail.carnest.au>";

export interface WarehouseIntakeEmailPayload {
  to: string[];
  customerName?: string;
  vehicleTitle: string;
  referenceId: string;
  pdfAttachment?: {
    filename: string;
    content: string;
  } | null;
  adminStaffName?: string;
  signedAt?: string;
  financeOwing?: string;
}

function buildWarehouseIntakeEmailContent(payload: WarehouseIntakeEmailPayload) {
  const greeting = payload.customerName?.trim() ? `Hi ${payload.customerName.trim()},` : "Hi there,";
  const summaryLines = [
    payload.signedAt ? `Signed: ${payload.signedAt}` : "",
    payload.financeOwing ? `Finance declaration: ${payload.financeOwing}` : "",
    payload.adminStaffName ? `CarNest staff: ${payload.adminStaffName}` : ""
  ].filter(Boolean);

  return {
    subject: `CarNest warehouse intake: ${payload.vehicleTitle}`,
    text: [
      greeting,
      "",
      payload.pdfAttachment
        ? "Attached is your CarNest warehouse intake summary and signed agreement."
        : "Your CarNest warehouse intake summary is ready.",
      "",
      `Vehicle: ${payload.vehicleTitle}`,
      `Reference: ${payload.referenceId}`,
      ...summaryLines,
      "",
      "CarNest acts solely as a storage and operational service provider. Vehicle transactions remain between buyer and seller.",
      "",
      "Questions?",
      "Email: info@carnestau.com",
      "Phone / WhatsApp:",
      "Craig: 0466661516",
      "Leon: 0406095686",
      "",
      "Regards,",
      "CarNest"
    ].join("\n"),
    html: `
      <div style="background:#f6f1e8;padding:24px 12px;font-family:Arial,sans-serif;color:#1b1b18;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid rgba(0,0,0,0.08);border-radius:24px;padding:28px 24px;">
          <p style="margin:0 0 8px;font-size:12px;line-height:1.4;letter-spacing:0.18em;text-transform:uppercase;color:#8f5b2e;">CarNest warehouse intake</p>
          <h1 style="margin:0 0 20px;font-size:24px;line-height:1.2;color:#1b1b18;font-weight:700;">Signed intake summary</h1>
          <p style="font-size:15px;line-height:1.7;margin:0 0 12px;">${greeting}</p>
          <p style="font-size:15px;line-height:1.7;margin:0 0 20px;">Thank you for completing your CarNest warehouse intake. ${payload.pdfAttachment ? "Your signed agreement is attached with the intake summary below." : "Your intake summary is ready below."}</p>
          <div style="border:1px solid rgba(0,0,0,0.08);border-radius:18px;padding:16px;background:#faf7f2;margin:0 0 20px;">
            <p style="font-size:15px;line-height:1.7;margin:0 0 8px;"><strong>Vehicle:</strong><br />${payload.vehicleTitle}</p>
            <p style="font-size:15px;line-height:1.7;margin:0 0 8px;"><strong>Reference:</strong><br />${payload.referenceId}</p>
            ${summaryLines.length ? `<p style="font-size:14px;line-height:1.8;margin:0;">${summaryLines.join("<br />")}</p>` : ""}
          </div>
          <p style="font-size:14px;line-height:1.7;margin:0 0 20px;color:#4b4b44;">CarNest acts solely as a storage and operational service provider. Vehicle transactions remain between buyer and seller.</p>
          <div style="border-top:1px solid rgba(0,0,0,0.08);padding-top:20px;">
            <p style="font-size:14px;line-height:1.7;margin:0 0 12px;font-weight:700;color:#1b1b18;">Questions?</p>
            <p style="font-size:14px;line-height:1.8;margin:0 0 10px;">
              <strong>Email:</strong><br />
              info@carnestau.com
            </p>
            <p style="font-size:14px;line-height:1.8;margin:0;">
              <strong>Phone / WhatsApp:</strong><br />
              Craig: 0466661516<br />
              Leon: 0406095686
            </p>
          </div>
          <p style="font-size:14px;line-height:1.7;margin:24px 0 0;color:#1b1b18;">Regards,<br />CarNest</p>
        </div>
      </div>
    `
  };
}

export async function sendWarehouseIntakeEmail(payload: WarehouseIntakeEmailPayload) {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is missing.");
  }

  const resend = new Resend(RESEND_API_KEY);
  const content = buildWarehouseIntakeEmailContent(payload);

  const { data, error } = await resend.emails.send({
    from: WAREHOUSE_INTAKE_EMAIL_FROM,
    to: payload.to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    attachments: payload.pdfAttachment ? [payload.pdfAttachment] : []
  });

  if (error) {
    throw new Error(error.message || "Warehouse intake email send failed.");
  }

  return {
    sent: true as const,
    subject: content.subject,
    providerMessageId: data?.id ?? null
  };
}
