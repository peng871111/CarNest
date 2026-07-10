import { AdminAppointment, AdminAppointmentReminderLog } from "@/types";
import { buildAbsoluteUrl } from "@/lib/seo";

export const MELBOURNE_TIMEZONE = "Australia/Melbourne";
export const ADMIN_CALENDAR_REMINDER_RECIPIENT = "info@carnest.au";
export const ADMIN_CALENDAR_REMINDER_HOUR = 18;

type MelbourneDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

type ReminderField = {
  label: string;
  value: string;
};

function getMelbourneDateTimeParts(date: Date): MelbourneDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: MELBOURNE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);

  const getNumericPart = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: getNumericPart("year"),
    month: getNumericPart("month"),
    day: getNumericPart("day"),
    hour: getNumericPart("hour"),
    minute: getNumericPart("minute")
  };
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

export function shiftMelbourneDateKey(dateKey: string, offsetDays: number) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return dateKey;

  const base = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return toDateKey(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate());
}

export function getMelbourneDateKeyFromDate(date: Date) {
  const parts = getMelbourneDateTimeParts(date);
  return toDateKey(parts.year, parts.month, parts.day);
}

export function getTomorrowMelbourneDateKey(date = new Date()) {
  return shiftMelbourneDateKey(getMelbourneDateKeyFromDate(date), 1);
}

export function isMelbourneReminderExecutionTime(date = new Date(), targetHour = ADMIN_CALENDAR_REMINDER_HOUR) {
  return getMelbourneDateTimeParts(date).hour === targetHour;
}

export function formatReminderDateHeading(dateKey: string) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return dateKey;

  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: MELBOURNE_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).formatToParts(new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12)));

  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";

  return [weekday ? `${weekday},` : "", day, month, year].filter(Boolean).join(" ");
}

export function formatAppointmentReminderTime(time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time.trim());
  if (!match) return time || "Time not set";

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const suffix = hour >= 12 ? "PM" : "AM";
  const twelveHour = hour % 12 || 12;
  return `${twelveHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function sortAdminAppointmentsByTime<T extends Pick<AdminAppointment, "date" | "time" | "title">>(appointments: T[]) {
  return [...appointments].sort((left, right) => {
    const leftKey = `${left.date} ${left.time || "99:99"} ${left.title || ""}`;
    const rightKey = `${right.date} ${right.time || "99:99"} ${right.title || ""}`;
    return leftKey.localeCompare(rightKey);
  });
}

export function isReminderEligibleAppointment(appointment: Partial<AdminAppointment>) {
  const normalizedStatus = typeof appointment.status === "string" ? appointment.status.toLowerCase() : "active";
  return normalizedStatus !== "cancelled"
    && normalizedStatus !== "deleted"
    && !appointment.cancelledAt
    && !appointment.deletedAt;
}

export function filterReminderEligibleAppointments<T extends AdminAppointment>(appointments: T[]) {
  return sortAdminAppointmentsByTime(appointments.filter((appointment) => isReminderEligibleAppointment(appointment)));
}

function sanitizeField(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getAppointmentReminderFields(appointment: AdminAppointment): ReminderField[] {
  const fields: ReminderField[] = [];

  const customerName = sanitizeField(appointment.customerName);
  const vehicleInfo = sanitizeField(appointment.vehicleInfo);
  const registration = sanitizeField(appointment.registration);
  const customerPhone = sanitizeField(appointment.customerPhone);
  const customerEmail = sanitizeField(appointment.customerEmail);
  const location = sanitizeField(appointment.location);
  const appointmentType = sanitizeField(appointment.appointmentType);
  const notes = sanitizeField(appointment.description);

  if (customerName) fields.push({ label: "Customer", value: customerName });
  if (vehicleInfo) fields.push({ label: "Vehicle", value: vehicleInfo });
  if (registration) fields.push({ label: "Registration", value: registration });
  if (customerPhone) fields.push({ label: "Phone", value: customerPhone });
  if (customerEmail) fields.push({ label: "Email", value: customerEmail });
  if (location) fields.push({ label: "Location", value: location });
  if (appointmentType) fields.push({ label: "Appointment Type", value: appointmentType });
  if (notes) fields.push({ label: "Notes", value: notes });

  return fields;
}

export function buildAdminCalendarReminderEmailContent(appointments: AdminAppointment[], appointmentDate: string) {
  const sortedAppointments = filterReminderEligibleAppointments(appointments);
  const formattedDate = formatReminderDateHeading(appointmentDate);
  const calendarUrl = buildAbsoluteUrl("/admin/calendar");
  const appointmentCountLabel = `${sortedAppointments.length} appointment${sortedAppointments.length === 1 ? "" : "s"} scheduled`;

  const textSections = sortedAppointments.map((appointment) => {
    const headline = `${formatAppointmentReminderTime(appointment.time)} — ${sanitizeField(appointment.title) || "Appointment"}`;
    const details = getAppointmentReminderFields(appointment).map((field) => `${field.label}: ${field.value}`);
    return [headline, ...details].join("\n");
  });

  const htmlSections = sortedAppointments.map((appointment) => {
    const headline = `${formatAppointmentReminderTime(appointment.time)} — ${sanitizeField(appointment.title) || "Appointment"}`;
    const details = getAppointmentReminderFields(appointment)
      .map((field) => `<p style="margin:6px 0 0;font-size:14px;line-height:1.7;color:#1b1b18;"><strong>${escapeHtml(field.label)}:</strong> ${escapeHtml(field.value)}</p>`)
      .join("");

    return `
      <div style="padding:0 0 20px;margin:0 0 20px;border-bottom:1px solid rgba(0,0,0,0.08);">
        <p style="margin:0;font-size:16px;line-height:1.6;font-weight:700;color:#1b1b18;">${escapeHtml(headline)}</p>
        ${details}
      </div>
    `;
  }).join("");

  return {
    subject: `CarNest Appointments — ${formattedDate}`,
    text: [
      "Tomorrow’s Appointments",
      formattedDate,
      "",
      appointmentCountLabel,
      "",
      ...textSections.flatMap((section, index) => index === textSections.length - 1 ? [section] : [section, "", "--------------------------------------------------", ""]),
      "",
      `Admin Calendar: ${calendarUrl}`
    ].join("\n"),
    html: `
      <div style="background:#f6f1e8;padding:24px 12px;font-family:Arial,sans-serif;color:#1b1b18;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid rgba(0,0,0,0.08);border-radius:24px;padding:28px 24px;">
          <p style="margin:0 0 8px;font-size:12px;line-height:1.4;letter-spacing:0.18em;text-transform:uppercase;color:#8f5b2e;">CarNest calendar</p>
          <h1 style="margin:0 0 8px;font-size:28px;line-height:1.15;color:#1b1b18;font-weight:700;">Tomorrow’s Appointments</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#4b4b44;">${escapeHtml(formattedDate)}</p>
          <div style="border:1px solid rgba(0,0,0,0.08);border-radius:18px;padding:16px;background:#faf7f2;margin:0 0 24px;">
            <p style="margin:0;font-size:15px;line-height:1.7;color:#1b1b18;">${escapeHtml(appointmentCountLabel)}</p>
          </div>
          ${htmlSections}
          <p style="margin:0;font-size:14px;line-height:1.7;">
            <a href="${escapeHtml(calendarUrl)}" style="color:#8f5b2e;text-decoration:none;font-weight:700;">Open Admin Calendar</a>
          </p>
        </div>
      </div>
    `
  };
}

export function getAdminAppointmentReminderLogId(appointmentDate: string, recipient = ADMIN_CALENDAR_REMINDER_RECIPIENT) {
  const normalizedRecipient = sanitizeField(recipient).toLowerCase().replace(/[^a-z0-9@._-]+/g, "-");
  return `calendar-reminder-${appointmentDate}-${normalizedRecipient}`;
}

export function hasSuccessfulReminderDelivery(log?: Partial<AdminAppointmentReminderLog> | null) {
  return log?.deliveryStatus === "sent";
}
