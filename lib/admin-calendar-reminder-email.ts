import "server-only";

import { Resend } from "resend";
import { AdminAppointment } from "@/types";
import {
  ADMIN_CALENDAR_REMINDER_RECIPIENT,
  buildAdminCalendarReminderEmailContent
} from "@/lib/admin-calendar-reminders";
import { isValidEmailAddress } from "@/lib/form-safety";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
export const ADMIN_CALENDAR_REMINDER_EMAIL_FROM =
  process.env.CALENDAR_EMAIL_FROM
  || process.env.EMAIL_FROM
  || process.env.RESEND_FROM_EMAIL
  || "CarNest Calendar <notifications@carnest.au>";

export interface AdminCalendarReminderEmailPayload {
  to?: string[];
  appointmentDate: string;
  appointments: AdminAppointment[];
}

export async function sendAdminCalendarReminderEmail(payload: AdminCalendarReminderEmailPayload) {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is missing.");
  }

  const recipients = Array.from(
    new Set((payload.to?.length ? payload.to : [ADMIN_CALENDAR_REMINDER_RECIPIENT]).map((item) => item.trim().toLowerCase()).filter(isValidEmailAddress))
  );

  if (!recipients.length) {
    throw new Error("No valid calendar reminder recipients were provided.");
  }

  const emailContent = buildAdminCalendarReminderEmailContent(payload.appointments, payload.appointmentDate);
  const resend = new Resend(RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: ADMIN_CALENDAR_REMINDER_EMAIL_FROM,
    to: recipients,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text
  });

  if (error) {
    throw new Error(error.message || "Admin calendar reminder email send failed.");
  }

  return {
    sent: true as const,
    subject: emailContent.subject,
    providerMessageId: data?.id ?? null,
    recipientCount: recipients.length
  };
}
