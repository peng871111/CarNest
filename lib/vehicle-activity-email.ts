import "server-only";

import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
export const VEHICLE_ACTIVITY_EMAIL_FROM = process.env.EMAIL_FROM ?? "CarNest <offers@mail.carnest.au>";

export interface VehicleActivityEmailPayload {
  to: string[];
  vehicleId: string;
  vehicleTitle: string;
  referenceId: string;
  message: string;
  customerName?: string | null;
  imageUrls?: string[];
}

export function getVehicleActivityEmailContent(
  payload: Pick<VehicleActivityEmailPayload, "vehicleTitle" | "referenceId" | "message" | "customerName" | "imageUrls">
) {
  const greeting = payload.customerName?.trim()
    ? `Hi ${payload.customerName.trim()},`
    : "Hi there,";
  const imageUrls = payload.imageUrls?.filter((imageUrl) => typeof imageUrl === "string" && imageUrl.trim().length > 0) ?? [];
  const photoLinksText = imageUrls.length
    ? [
        "",
        "Attached photos:",
        ...imageUrls.map((imageUrl, index) => `${index + 1}. ${imageUrl}`)
      ]
    : [];
  const photoSectionHtml = imageUrls.length
    ? `
          <div style="margin:0 0 20px;">
            <p style="margin:0 0 10px;font-size:13px;line-height:1.5;letter-spacing:0.16em;text-transform:uppercase;color:#6d685f;">Photos</p>
            <div>
              ${imageUrls
                .map(
                  (imageUrl) => `
                    <img src="${imageUrl}" alt="Vehicle update photo" style="width:100%;max-width:520px;border-radius:14px;display:block;margin:12px 0;border:1px solid rgba(0,0,0,0.08);background:#faf7f2;height:auto;" />
                  `
                )
                .join("")}
            </div>
          </div>
        `
    : "";

  return {
    subject: `Vehicle update: ${payload.vehicleTitle}`,
    text: [
      greeting,
      "",
      "Here is an update on your vehicle.",
      "",
      "Update:",
      payload.message,
      "",
      `Vehicle: ${payload.vehicleTitle}`,
      "",
      `Reference: ${payload.referenceId}`,
      ...photoLinksText,
      "",
      "This is an update from the CarNest team. No login is required.",
      "",
      "Questions?",
      "Email: info@carnestau.com",
      "Phone / WhatsApp:",
      "Craig: 0466661516",
      "Leon: 0406095686",
      "WeChat:",
      "Craig: Craig0490158769",
      "Leon: Morikawa_leon",
      "",
      "Regards,",
      "CarNest"
    ].join("\n"),
    html: `
      <div style="background:#f6f1e8;padding:24px 12px;font-family:Arial,sans-serif;color:#1b1b18;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid rgba(0,0,0,0.08);border-radius:24px;padding:28px 24px;">
          <p style="margin:0 0 8px;font-size:12px;line-height:1.4;letter-spacing:0.18em;text-transform:uppercase;color:#8f5b2e;">CarNest vehicle update</p>
          <h1 style="margin:0 0 20px;font-size:24px;line-height:1.2;color:#1b1b18;font-weight:700;">CarNest vehicle update</h1>
          <p style="font-size:15px;line-height:1.7;margin:0 0 8px;">${greeting}</p>
          <p style="font-size:15px;line-height:1.7;margin:0 0 20px;">Here is an update on your vehicle.</p>
          <div style="margin:0 0 20px;">
            <p style="margin:0 0 10px;font-size:13px;line-height:1.5;letter-spacing:0.16em;text-transform:uppercase;color:#6d685f;">Update</p>
            <div style="border:1px solid rgba(0,0,0,0.08);border-radius:18px;padding:16px;background:#faf7f2;">
              <p style="font-size:15px;line-height:1.7;margin:0;">${payload.message}</p>
            </div>
          </div>
          <p style="font-size:15px;line-height:1.7;margin:0 0 6px;"><strong>Vehicle:</strong><br />${payload.vehicleTitle}</p>
          <p style="font-size:15px;line-height:1.7;margin:0 0 20px;"><strong>Reference:</strong><br />${payload.referenceId}</p>
          ${photoSectionHtml}
          <p style="font-size:14px;line-height:1.7;margin:0 0 20px;color:#4b4b44;">This is an update from the CarNest team. No login is required.</p>
          <div style="border-top:1px solid rgba(0,0,0,0.08);padding-top:20px;">
            <p style="font-size:14px;line-height:1.7;margin:0 0 12px;font-weight:700;color:#1b1b18;">Questions?</p>
            <p style="font-size:14px;line-height:1.8;margin:0 0 10px;">
              <strong>Email:</strong><br />
              info@carnestau.com
            </p>
            <p style="font-size:14px;line-height:1.8;margin:0 0 10px;">
              <strong>Phone / WhatsApp:</strong><br />
              Craig: 0466661516<br />
              Leon: 0406095686
            </p>
            <p style="font-size:14px;line-height:1.8;margin:0;">
              <strong>WeChat:</strong><br />
              Craig: Craig0490158769<br />
              Leon: Morikawa_leon
            </p>
          </div>
          <p style="font-size:14px;line-height:1.7;margin:24px 0 0;color:#1b1b18;">Regards,<br />CarNest</p>
        </div>
      </div>
    `
  };
}

export async function sendVehicleActivityEmail(payload: VehicleActivityEmailPayload) {
  const content = getVehicleActivityEmailContent(payload);

  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is missing.");
  }

  const resend = new Resend(RESEND_API_KEY);
  console.log("Using Resend API");
  console.log("[vehicle-activity-email] Executing resend.emails.send()", {
    vehicleId: payload.vehicleId,
    recipientEmails: payload.to,
    subject: content.subject,
    from: VEHICLE_ACTIVITY_EMAIL_FROM,
    imageUrlCount: payload.imageUrls?.length ?? 0
  });
  const { data, error } = await resend.emails.send({
    from: VEHICLE_ACTIVITY_EMAIL_FROM,
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
      from: VEHICLE_ACTIVITY_EMAIL_FROM,
      imageUrlCount: payload.imageUrls?.length ?? 0,
      error,
      errorName: error.name,
      errorMessage: error.message
    });
    throw new Error(error.message || "Vehicle activity email send failed.");
  }

  console.log("[vehicle-activity-email] Resend response", {
    vehicleId: payload.vehicleId,
    recipientEmails: payload.to,
    subject: content.subject,
    from: VEHICLE_ACTIVITY_EMAIL_FROM,
    imageUrlCount: payload.imageUrls?.length ?? 0,
    response: data
  });

  return {
    sent: true as const,
    skipped: false as const,
    subject: content.subject,
    providerMessageId: data?.id ?? null
  };
}
