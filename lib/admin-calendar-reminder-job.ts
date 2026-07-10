import "server-only";

import { Timestamp } from "firebase-admin/firestore";
import { AdminAppointment, AdminAppointmentReminderLog } from "@/types";
import {
  ADMIN_CALENDAR_REMINDER_HOUR,
  ADMIN_CALENDAR_REMINDER_RECIPIENT,
  filterReminderEligibleAppointments,
  getAdminAppointmentReminderLogId,
  getTomorrowMelbourneDateKey,
  hasSuccessfulReminderDelivery,
  isMelbourneReminderExecutionTime
} from "@/lib/admin-calendar-reminders";
import { sendAdminCalendarReminderEmail } from "@/lib/admin-calendar-reminder-email";
import { getAdminDb } from "@/lib/firebase-admin-server";

const ADMIN_APPOINTMENTS_COLLECTION = "adminAppointments";
const ADMIN_APPOINTMENT_REMINDER_LOGS_COLLECTION = "adminAppointmentReminderLogs";

function serializeTimestampValue(value: unknown) {
  if (typeof value === "string") return value;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return "";
}

function serializeAdminAppointmentRecord(id: string, data: Record<string, unknown>): AdminAppointment {
  return {
    id,
    date: typeof data.date === "string" ? data.date : "",
    time: typeof data.time === "string" ? data.time : "",
    title: typeof data.title === "string" ? data.title : "",
    description: typeof data.description === "string" ? data.description : "",
    customerName: typeof data.customerName === "string" ? data.customerName : "",
    customerEmail: typeof data.customerEmail === "string" ? data.customerEmail : "",
    customerPhone: typeof data.customerPhone === "string" ? data.customerPhone : "",
    vehicleInfo: typeof data.vehicleInfo === "string" ? data.vehicleInfo : "",
    registration: typeof data.registration === "string" ? data.registration : "",
    location: typeof data.location === "string" ? data.location : "",
    appointmentType: typeof data.appointmentType === "string" ? data.appointmentType : "",
    status: data.status === "cancelled" ? "cancelled" : "active",
    cancelledAt: serializeTimestampValue(data.cancelledAt),
    deletedAt: serializeTimestampValue(data.deletedAt),
    createdAt: serializeTimestampValue(data.createdAt),
    updatedAt: serializeTimestampValue(data.updatedAt)
  };
}

function serializeReminderLogRecord(id: string, data: Record<string, unknown>): AdminAppointmentReminderLog {
  return {
    id,
    appointmentDate: typeof data.appointmentDate === "string" ? data.appointmentDate : "",
    recipient: typeof data.recipient === "string" ? data.recipient : ADMIN_CALENDAR_REMINDER_RECIPIENT,
    appointmentCount: typeof data.appointmentCount === "number" ? data.appointmentCount : 0,
    deliveryStatus: data.deliveryStatus === "sent" || data.deliveryStatus === "failed" ? data.deliveryStatus : "no_appointments",
    providerMessageId: typeof data.providerMessageId === "string" ? data.providerMessageId : "",
    errorMessage: typeof data.errorMessage === "string" ? data.errorMessage : "",
    sentAt: serializeTimestampValue(data.sentAt),
    checkedAt: serializeTimestampValue(data.checkedAt),
    updatedAt: serializeTimestampValue(data.updatedAt)
  };
}

async function getReminderLog(appointmentDate: string, recipient: string) {
  const db = getAdminDb();
  const logId = getAdminAppointmentReminderLogId(appointmentDate, recipient);
  const snapshot = await db.collection(ADMIN_APPOINTMENT_REMINDER_LOGS_COLLECTION).doc(logId).get();
  if (!snapshot.exists) return null;
  return serializeReminderLogRecord(snapshot.id, snapshot.data() ?? {});
}

async function saveReminderLog(input: {
  appointmentDate: string;
  recipient: string;
  appointmentCount: number;
  deliveryStatus: AdminAppointmentReminderLog["deliveryStatus"];
  providerMessageId?: string | null;
  errorMessage?: string;
  sentAt?: Date | null;
  checkedAt?: Date;
}) {
  const db = getAdminDb();
  const logId = getAdminAppointmentReminderLogId(input.appointmentDate, input.recipient);
  await db.collection(ADMIN_APPOINTMENT_REMINDER_LOGS_COLLECTION).doc(logId).set({
    appointmentDate: input.appointmentDate,
    recipient: input.recipient,
    appointmentCount: input.appointmentCount,
    deliveryStatus: input.deliveryStatus,
    providerMessageId: input.providerMessageId ?? "",
    errorMessage: input.errorMessage ?? "",
    ...(input.sentAt ? { sentAt: Timestamp.fromDate(input.sentAt) } : {}),
    checkedAt: Timestamp.fromDate(input.checkedAt ?? new Date()),
    updatedAt: Timestamp.fromDate(input.checkedAt ?? new Date())
  }, { merge: true });
}

async function getAppointmentsForDate(dateKey: string) {
  const db = getAdminDb();
  const snapshot = await db.collection(ADMIN_APPOINTMENTS_COLLECTION).where("date", "==", dateKey).get();
  return snapshot.docs.map((doc) => serializeAdminAppointmentRecord(doc.id, doc.data() ?? {}));
}

export interface AdminCalendarReminderRunOptions {
  now?: Date;
  force?: boolean;
  recipient?: string;
}

export interface AdminCalendarReminderRunResult {
  ok: boolean;
  sent: boolean;
  skipped: boolean;
  reason:
    | "sent"
    | "outside_reminder_window"
    | "already_sent"
    | "no_appointments"
    | "failed";
  appointmentDate: string;
  appointmentCount: number;
  providerMessageId?: string | null;
}

export async function runAdminCalendarReminder(options: AdminCalendarReminderRunOptions = {}): Promise<AdminCalendarReminderRunResult> {
  const now = options.now ?? new Date();
  const force = options.force === true;
  const recipient = options.recipient?.trim().toLowerCase() || ADMIN_CALENDAR_REMINDER_RECIPIENT;
  const appointmentDate = getTomorrowMelbourneDateKey(now);

  if (!force && !isMelbourneReminderExecutionTime(now, ADMIN_CALENDAR_REMINDER_HOUR)) {
    return {
      ok: true,
      sent: false,
      skipped: true,
      reason: "outside_reminder_window",
      appointmentDate,
      appointmentCount: 0
    };
  }

  const existingLog = await getReminderLog(appointmentDate, recipient);
  if (hasSuccessfulReminderDelivery(existingLog)) {
    return {
      ok: true,
      sent: false,
      skipped: true,
      reason: "already_sent",
      appointmentDate,
      appointmentCount: existingLog?.appointmentCount ?? 0,
      providerMessageId: existingLog?.providerMessageId ?? null
    };
  }

  let appointments: AdminAppointment[] = [];

  try {
    appointments = filterReminderEligibleAppointments(await getAppointmentsForDate(appointmentDate));
  } catch (error) {
    console.error("[admin-calendar-reminder] Failed to retrieve appointments", {
      appointmentDate,
      recipient,
      error
    });
    await saveReminderLog({
      appointmentDate,
      recipient,
      appointmentCount: 0,
      deliveryStatus: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
      checkedAt: now
    });
    throw error;
  }

  if (!appointments.length) {
    await saveReminderLog({
      appointmentDate,
      recipient,
      appointmentCount: 0,
      deliveryStatus: "no_appointments",
      errorMessage: "",
      checkedAt: now
    });

    return {
      ok: true,
      sent: false,
      skipped: true,
      reason: "no_appointments",
      appointmentDate,
      appointmentCount: 0
    };
  }

  try {
    const sendResult = await sendAdminCalendarReminderEmail({
      to: [recipient],
      appointmentDate,
      appointments
    });

    await saveReminderLog({
      appointmentDate,
      recipient,
      appointmentCount: appointments.length,
      deliveryStatus: "sent",
      providerMessageId: sendResult.providerMessageId,
      errorMessage: "",
      sentAt: now,
      checkedAt: now
    });

    return {
      ok: true,
      sent: true,
      skipped: false,
      reason: "sent",
      appointmentDate,
      appointmentCount: appointments.length,
      providerMessageId: sendResult.providerMessageId
    };
  } catch (error) {
    console.error("[admin-calendar-reminder] Failed to send reminder email", {
      appointmentDate,
      recipient,
      appointmentCount: appointments.length,
      error
    });

    await saveReminderLog({
      appointmentDate,
      recipient,
      appointmentCount: appointments.length,
      deliveryStatus: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
      checkedAt: now
    });

    return {
      ok: false,
      sent: false,
      skipped: false,
      reason: "failed",
      appointmentDate,
      appointmentCount: appointments.length
    };
  }
}
