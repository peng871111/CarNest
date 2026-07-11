import "server-only";

import { Timestamp } from "firebase-admin/firestore";
import { AdminAppointment, AdminAppointmentReminderLog } from "@/types";
import {
  ADMIN_CALENDAR_REMINDER_HOUR,
  ADMIN_CALENDAR_REMINDER_RECIPIENT,
  formatMelbourneDateTime,
  filterReminderEligibleAppointments,
  getNextAdminCalendarReminderAttempts,
  getAdminAppointmentReminderLogId,
  getTomorrowMelbourneDateKey,
  hasSuccessfulReminderDelivery,
  isMelbourneReminderExecutionTime
} from "@/lib/admin-calendar-reminders";
import {
  ADMIN_CALENDAR_REMINDER_EMAIL_FROM,
  sendAdminCalendarReminderEmail
} from "@/lib/admin-calendar-reminder-email";
import { getAdminDb } from "@/lib/firebase-admin-server";

const ADMIN_APPOINTMENTS_COLLECTION = "adminAppointments";
const ADMIN_APPOINTMENT_REMINDER_LOGS_COLLECTION = "adminAppointmentReminderLogs";

type ReminderDataAccessOptions = {
  authAccessToken?: string;
};

function getFirestoreRestProjectId() {
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()
    || process.env.FIREBASE_ADMIN_PROJECT_ID?.trim()
    || "";
}

function getFirestoreRestBaseUrl() {
  const projectId = getFirestoreRestProjectId();
  if (!projectId) {
    throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing.");
  }
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

function decodeFirestoreRestValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const entry = value as Record<string, unknown>;
  if (typeof entry.stringValue === "string") return entry.stringValue;
  if (typeof entry.integerValue === "string") return Number(entry.integerValue);
  if (typeof entry.doubleValue === "number") return entry.doubleValue;
  if (typeof entry.booleanValue === "boolean") return entry.booleanValue;
  if (typeof entry.timestampValue === "string") return entry.timestampValue;
  if ("nullValue" in entry) return null;
  if (entry.mapValue && typeof entry.mapValue === "object") {
    return decodeFirestoreRestFields((entry.mapValue as { fields?: Record<string, unknown> }).fields ?? {});
  }
  if (entry.arrayValue && typeof entry.arrayValue === "object") {
    return ((entry.arrayValue as { values?: unknown[] }).values ?? []).map((item) => decodeFirestoreRestValue(item));
  }
  return entry;
}

function decodeFirestoreRestFields(fields: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeFirestoreRestValue(value)]));
}

function encodeFirestoreRestValue(value: unknown): Record<string, unknown> {
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (typeof value === "string") {
    return { stringValue: value };
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "boolean") {
    return { booleanValue: value };
  }
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => encodeFirestoreRestValue(item))
      }
    };
  }
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: encodeFirestoreRestFields(value as Record<string, unknown>)
      }
    };
  }
  return { stringValue: String(value) };
}

function encodeFirestoreRestFields(fields: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, encodeFirestoreRestValue(value)]));
}

function getRestAccessToken(options?: ReminderDataAccessOptions) {
  return options?.authAccessToken?.trim() ?? "";
}

function shouldUseFirestoreRestFallback(error: unknown, options?: ReminderDataAccessOptions) {
  if (!getRestAccessToken(options)) return false;
  if (!(error instanceof Error)) return true;

  const message = error.message.toLowerCase();
  return message.includes("default credentials")
    || message.includes("unable to detect a project id")
    || message.includes("credential")
    || message.includes("service account")
    || message.includes("project id");
}

function extractDocumentId(documentName: string) {
  const segments = documentName.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? documentName;
}

async function callFirestoreRest(
  path: string,
  authAccessToken: string,
  init?: RequestInit,
  options?: { allowNotFound?: boolean }
) {
  const response = await fetch(`${getFirestoreRestBaseUrl()}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${authAccessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  const rawText = await response.text();
  const payload = rawText ? JSON.parse(rawText) as unknown : null;

  if (response.status === 404 && options?.allowNotFound) {
    return null;
  }

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as { error?: unknown }).error
        : null;
    const message = typeof errorPayload === "object" && errorPayload && "message" in errorPayload
      ? String((errorPayload as { message?: string }).message)
      : `Firestore request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return payload;
}

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

async function getReminderLog(
  appointmentDate: string,
  recipient: string,
  options: ReminderDataAccessOptions = {}
) {
  const logId = getAdminAppointmentReminderLogId(appointmentDate, recipient);

  try {
    const db = getAdminDb();
    const snapshot = await db.collection(ADMIN_APPOINTMENT_REMINDER_LOGS_COLLECTION).doc(logId).get();
    if (!snapshot.exists) return null;
    return serializeReminderLogRecord(snapshot.id, snapshot.data() ?? {});
  } catch (error) {
    if (!shouldUseFirestoreRestFallback(error, options)) {
      throw error;
    }

    const authAccessToken = getRestAccessToken(options);
    const payload = await callFirestoreRest(
      `${ADMIN_APPOINTMENT_REMINDER_LOGS_COLLECTION}/${encodeURIComponent(logId)}`,
      authAccessToken,
      undefined,
      { allowNotFound: true }
    );
    if (!payload || typeof payload !== "object") return null;

    const document = payload as { fields?: Record<string, unknown>; name?: string };
    const id = typeof document.name === "string" ? extractDocumentId(document.name) : logId;
    return serializeReminderLogRecord(id, decodeFirestoreRestFields(document.fields ?? {}));
  }
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
}, options: ReminderDataAccessOptions = {}) {
  const logId = getAdminAppointmentReminderLogId(input.appointmentDate, input.recipient);
  const checkedAt = input.checkedAt ?? new Date();
  const logPayload = {
    appointmentDate: input.appointmentDate,
    recipient: input.recipient,
    appointmentCount: input.appointmentCount,
    deliveryStatus: input.deliveryStatus,
    providerMessageId: input.providerMessageId ?? "",
    errorMessage: input.errorMessage ?? "",
    ...(input.sentAt ? { sentAt: input.sentAt } : {}),
    checkedAt,
    updatedAt: checkedAt
  };

  try {
    const db = getAdminDb();
    await db.collection(ADMIN_APPOINTMENT_REMINDER_LOGS_COLLECTION).doc(logId).set({
      appointmentDate: input.appointmentDate,
      recipient: input.recipient,
      appointmentCount: input.appointmentCount,
      deliveryStatus: input.deliveryStatus,
      providerMessageId: input.providerMessageId ?? "",
      errorMessage: input.errorMessage ?? "",
      ...(input.sentAt ? { sentAt: Timestamp.fromDate(input.sentAt) } : {}),
      checkedAt: Timestamp.fromDate(checkedAt),
      updatedAt: Timestamp.fromDate(checkedAt)
    }, { merge: true });
  } catch (error) {
    if (!shouldUseFirestoreRestFallback(error, options)) {
      throw error;
    }

    const authAccessToken = getRestAccessToken(options);
    await callFirestoreRest(
      `${ADMIN_APPOINTMENT_REMINDER_LOGS_COLLECTION}/${encodeURIComponent(logId)}`,
      authAccessToken,
      {
        method: "PATCH",
        body: JSON.stringify({
          fields: encodeFirestoreRestFields(logPayload)
        })
      }
    );
  }
}

async function getAppointmentsForDate(dateKey: string, options: ReminderDataAccessOptions = {}) {
  try {
    const db = getAdminDb();
    const snapshot = await db.collection(ADMIN_APPOINTMENTS_COLLECTION).where("date", "==", dateKey).get();
    return snapshot.docs.map((doc) => serializeAdminAppointmentRecord(doc.id, doc.data() ?? {}));
  } catch (error) {
    if (!shouldUseFirestoreRestFallback(error, options)) {
      throw error;
    }

    const authAccessToken = getRestAccessToken(options);
    const payload = await callFirestoreRest(":runQuery", authAccessToken, {
      method: "POST",
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: ADMIN_APPOINTMENTS_COLLECTION }],
          where: {
            fieldFilter: {
              field: { fieldPath: "date" },
              op: "EQUAL",
              value: { stringValue: dateKey }
            }
          }
        }
      })
    });

    if (!Array.isArray(payload)) return [];

    return payload
      .map((entry) => {
        if (!entry || typeof entry !== "object" || !("document" in entry)) return null;
        const document = (entry as { document?: { name?: string; fields?: Record<string, unknown> } }).document;
        if (!document?.name) return null;
        return serializeAdminAppointmentRecord(
          extractDocumentId(document.name),
          decodeFirestoreRestFields(document.fields ?? {})
        );
      })
      .filter((appointment): appointment is AdminAppointment => Boolean(appointment));
  }
}

export interface AdminCalendarReminderRunOptions {
  now?: Date;
  force?: boolean;
  recipient?: string;
  authAccessToken?: string;
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

export interface AdminCalendarReminderDiagnostics {
  melbourneNow: string;
  appointmentDate: string;
  recipient: string;
  sender: string;
  cronSecretConfigured: boolean;
  reminderHourMelbourne: number;
  nextCronAttempts: Array<{
    schedule: string;
    utcHour: number;
    runAtIso: string;
    runAtMelbourne: string;
  }>;
  existingLog: AdminAppointmentReminderLog | null;
  appointmentCount: number;
  eligibleAppointmentCount: number;
  appointments: AdminAppointment[];
}

export async function getAdminCalendarReminderDiagnostics(options: {
  now?: Date;
  recipient?: string;
  authAccessToken?: string;
} = {}): Promise<AdminCalendarReminderDiagnostics> {
  const now = options.now ?? new Date();
  const recipient = options.recipient?.trim().toLowerCase() || ADMIN_CALENDAR_REMINDER_RECIPIENT;
  const appointmentDate = getTomorrowMelbourneDateKey(now);
  const [existingLog, appointments] = await Promise.all([
    getReminderLog(appointmentDate, recipient, options),
    getAppointmentsForDate(appointmentDate, options)
  ]);
  const eligibleAppointments = filterReminderEligibleAppointments(appointments);

  return {
    melbourneNow: formatMelbourneDateTime(now),
    appointmentDate,
    recipient,
    sender: ADMIN_CALENDAR_REMINDER_EMAIL_FROM,
    cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    reminderHourMelbourne: ADMIN_CALENDAR_REMINDER_HOUR,
    nextCronAttempts: getNextAdminCalendarReminderAttempts(now),
    existingLog,
    appointmentCount: appointments.length,
    eligibleAppointmentCount: eligibleAppointments.length,
    appointments: eligibleAppointments
  };
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

  const existingLog = await getReminderLog(appointmentDate, recipient, options);
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
    appointments = filterReminderEligibleAppointments(await getAppointmentsForDate(appointmentDate, options));
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
    }, options);
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
    }, options);

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
    }, options);

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
    }, options);

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
