"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import {
  createEmptyAdminAppointment,
  deleteAdminAppointment,
  getAdminAppointmentsData,
  saveAdminAppointment
} from "@/lib/data";
import { getTodayMelbourneDateKey } from "@/lib/admin-accounting-utils";
import { hasAdminPermission } from "@/lib/permissions";
import { AdminAppointment, VehicleActor } from "@/types";

const MELBOURNE_TIMEZONE = "Australia/Melbourne";
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type AppointmentDraft = Omit<AdminAppointment, "id" | "createdAt" | "updatedAt">;

function createActorFromUser(user: ReturnType<typeof useAuth>["appUser"]): VehicleActor | null {
  if (!user) return null;
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    displayName: user.displayName,
    name: user.name,
    adminPermissions: user.adminPermissions
  };
}

function buildEmptyAppointmentDraft(date: string): AppointmentDraft {
  return {
    ...createEmptyAdminAppointment(),
    date
  };
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    return new Date();
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function sortAppointments(appointments: AdminAppointment[]) {
  return [...appointments].sort((left, right) => {
    const leftKey = `${left.date} ${left.time}`;
    const rightKey = `${right.date} ${right.time}`;
    return leftKey.localeCompare(rightKey);
  });
}

function formatMonthLabel(date: Date) {
  const anchored = new Date(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-15T12:00:00+10:00`);
  return new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: MELBOURNE_TIMEZONE
  }).format(anchored);
}

function formatSelectedDate(dateKey: string) {
  const parsed = new Date(`${dateKey}T12:00:00+10:00`);
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: MELBOURNE_TIMEZONE
  }).format(parsed);
}

function formatAppointmentInputDate(dateKey: string) {
  if (!dateKey) return "YYYY-MM-DD";
  const parsed = new Date(`${dateKey}T12:00:00+10:00`);
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: MELBOURNE_TIMEZONE
  }).format(parsed);
}

function formatTimeLabel(time: string) {
  if (!time) return "Time not set";
  const [hourText, minuteText = "00"] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time;
  const suffix = hour >= 12 ? "pm" : "am";
  const twelveHour = hour % 12 || 12;
  return `${twelveHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function getCalendarDays(monthDate: Date) {
  const firstDay = startOfMonth(monthDate);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return date;
  });
}

function AppointmentFormModal({
  draft,
  saving,
  onChange,
  onClose,
  onSubmit,
  editing
}: {
  draft: AppointmentDraft;
  saving: boolean;
  onChange: <K extends keyof AppointmentDraft>(field: K, value: AppointmentDraft[K]) => void;
  onClose: () => void;
  onSubmit: () => void;
  editing: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[90] bg-black/35 md:px-4 md:py-6">
      <div className="flex h-full w-full items-end md:items-center md:justify-center">
        <div className="flex h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-h-[100dvh] w-full min-h-0 flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_24px_80px_rgba(15,15,15,0.18)] md:h-auto md:max-h-[calc(100vh-48px)] md:w-[calc(100vw-32px)] md:max-w-[480px] md:rounded-[28px] md:border md:border-black/5">
          <div className="sticky top-0 z-10 relative shrink-0 border-b border-black/6 bg-white px-5 pb-4 pt-[calc(env(safe-area-inset-top)+20px)] md:px-8 md:pb-5 md:pt-8">
            <div className="pr-20">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-bronze">{editing ? "EDIT APPOINTMENT" : "ADD APPOINTMENT"}</p>
              <h2 className="mt-2 text-[27px] font-semibold leading-[0.98] text-ink md:text-2xl">
                {editing ? "Update calendar event" : "Create calendar event"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="absolute right-5 top-[calc(env(safe-area-inset-top)+20px)] shrink-0 rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze md:right-8 md:top-8"
            >
              Close
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 md:px-8 md:py-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Date</label>
                <Input
                  type="date"
                  lang="en-AU"
                  value={draft.date}
                  onChange={(event) => onChange("date", event.target.value)}
                  className="min-h-[48px] min-w-0 max-w-full box-border"
                />
                <p className="text-xs text-ink/55">Selected date: {formatAppointmentInputDate(draft.date)}</p>
              </div>
              <div className="min-w-0 space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Time</label>
                <Input
                  type="time"
                  value={draft.time}
                  onChange={(event) => onChange("time", event.target.value)}
                  className="min-h-[48px] min-w-0 max-w-full box-border"
                />
              </div>
              <div className="min-w-0 space-y-2 md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Title</label>
                <Input
                  value={draft.title}
                  onChange={(event) => onChange("title", event.target.value)}
                  placeholder="Vehicle inspection, customer handover, collection..."
                  className="min-h-[48px] min-w-0 max-w-full box-border"
                />
              </div>
              <div className="min-w-0 space-y-2 md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Notes / Description</label>
                <Textarea
                  value={draft.description}
                  onChange={(event) => onChange("description", event.target.value)}
                  placeholder="Add any useful context for the team."
                  className="min-h-[132px] min-w-0 max-w-full box-border"
                />
              </div>
              <div className="min-w-0 space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Customer name</label>
                <Input
                  value={draft.customerName ?? ""}
                  onChange={(event) => onChange("customerName", event.target.value)}
                  placeholder="Optional"
                  className="min-h-[48px] min-w-0 max-w-full box-border"
                />
              </div>
              <div className="min-w-0 space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/55">Vehicle / Rego</label>
                <Input
                  value={draft.vehicleInfo ?? ""}
                  onChange={(event) => onChange("vehicleInfo", event.target.value)}
                  placeholder="Optional"
                  className="min-h-[48px] min-w-0 max-w-full box-border"
                />
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 shrink-0 border-t border-black/6 bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 md:px-8 md:py-6">
            <div className="flex flex-col-reverse gap-3 min-[430px]:flex-row min-[430px]:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze min-[430px]:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={saving}
                className="w-full rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/92 disabled:opacity-50 min-[430px]:w-auto"
              >
                {saving ? "Saving..." : editing ? "Save changes" : "Add appointment"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminCalendarPanel() {
  const { appUser, firebaseUser, loading: authLoading } = useAuth();
  const actor = useMemo(() => createActorFromUser(appUser), [appUser]);
  const canManageCalendar = hasAdminPermission(appUser, "manageVehicles");
  const todayKey = useMemo(() => getTodayMelbourneDateKey(), []);
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(parseDateKey(todayKey)));
  const [draft, setDraft] = useState<AppointmentDraft>(buildEmptyAppointmentDraft(todayKey));
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [reminderBusy, setReminderBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAppointments() {
      if (authLoading) return;
      if (!canManageCalendar || !firebaseUser) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        await firebaseUser.getIdToken();
        const result = await getAdminAppointmentsData();
        if (cancelled) return;
        setAppointments(sortAppointments(result.items));
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "We couldn't load calendar appointments.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAppointments();
    return () => {
      cancelled = true;
    };
  }, [authLoading, canManageCalendar, firebaseUser]);

  const appointmentCountByDate = useMemo(() => {
    const counts = new Map<string, number>();
    appointments.forEach((appointment) => {
      counts.set(appointment.date, (counts.get(appointment.date) ?? 0) + 1);
    });
    return counts;
  }, [appointments]);

  const selectedDateAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.date === selectedDateKey).sort((left, right) => left.time.localeCompare(right.time)),
    [appointments, selectedDateKey]
  );

  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);

  function openCreateModal() {
    setDraft(buildEmptyAppointmentDraft(selectedDateKey));
    setEditingAppointmentId(null);
    setFormOpen(true);
    setErrorMessage("");
    setNotice("");
  }

  function openEditModal(appointment: AdminAppointment) {
    setDraft({
      date: appointment.date,
      time: appointment.time,
      title: appointment.title,
      description: appointment.description,
      customerName: appointment.customerName ?? "",
      vehicleInfo: appointment.vehicleInfo ?? ""
    });
    setEditingAppointmentId(appointment.id);
    setFormOpen(true);
    setErrorMessage("");
    setNotice("");
  }

  function closeModal() {
    setFormOpen(false);
    setEditingAppointmentId(null);
    setDraft(buildEmptyAppointmentDraft(selectedDateKey));
  }

  function updateDraft<K extends keyof AppointmentDraft>(field: K, value: AppointmentDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSaveAppointment() {
    if (!actor) return;

    try {
      setSaving(true);
      setErrorMessage("");
      setNotice("");
      const result = await saveAdminAppointment(draft, actor, editingAppointmentId || undefined);
      setAppointments((current) => {
        const previous = current.find((appointment) => appointment.id === result.appointment.id);
        return sortAppointments(
          current
            .filter((appointment) => appointment.id !== result.appointment.id)
            .concat({
              ...result.appointment,
              createdAt: previous?.createdAt ?? result.appointment.createdAt
            })
        );
      });
      setSelectedDateKey(draft.date);
      setVisibleMonth(startOfMonth(parseDateKey(draft.date)));
      setNotice(editingAppointmentId ? "Appointment updated." : "Appointment added.");
      closeModal();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't save the appointment.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAppointment(appointment: AdminAppointment) {
    if (!actor) return;
    const confirmed = window.confirm(`Delete the appointment "${appointment.title}" on ${formatSelectedDate(appointment.date)}?`);
    if (!confirmed) return;

    try {
      setDeletingId(appointment.id);
      setErrorMessage("");
      setNotice("");
      await deleteAdminAppointment(appointment.id, actor);
      setAppointments((current) => current.filter((item) => item.id !== appointment.id));
      setNotice("Appointment deleted.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't delete the appointment.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSendTomorrowReminder() {
    if (!firebaseUser) {
      setErrorMessage("Please sign in again before sending the tomorrow reminder.");
      return;
    }

    try {
      setReminderBusy(true);
      setErrorMessage("");
      setNotice("");
      const authAccessToken = await firebaseUser.getIdToken();

      const response = await fetch("/api/admin/calendar/reminders/next-day", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authAccessToken}`
        }
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        const diagnostics = payload?.diagnostics;
        const appointmentCount =
          typeof diagnostics?.eligibleAppointmentCount === "number"
            ? diagnostics.eligibleAppointmentCount
            : typeof diagnostics?.appointmentCount === "number"
              ? diagnostics.appointmentCount
              : null;
        const context =
          appointmentCount == null
            ? ""
            : ` Tomorrow has ${appointmentCount} eligible appointment${appointmentCount === 1 ? "" : "s"}.`;
        throw new Error(`${payload?.error || "We couldn't send the tomorrow reminder."}${context}`);
      }

      const result = payload.result;
      if (result?.reason === "already_sent") {
        setNotice("Tomorrow reminder already sent. No duplicate email was created.");
        return;
      }

      if (result?.reason === "no_appointments") {
        setNotice("No eligible appointments were found for tomorrow, so no reminder email was sent.");
        return;
      }

      if (result?.reason === "sent") {
        const providerMessageId = result.providerMessageId ? ` Message ID: ${result.providerMessageId}` : "";
        setNotice(`Tomorrow reminder email sent successfully to info@carnest.au.${providerMessageId}`);
        return;
      }

      setNotice("Tomorrow reminder check completed.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't send the tomorrow reminder.");
    } finally {
      setReminderBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {notice ? <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
      {errorMessage ? <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{errorMessage}</div> : null}

      <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-bronze">Schedule</p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-ink">
              <CalendarDays className="h-6 w-6 text-bronze" />
              Monthly view
            </h2>
            <p className="mt-2 text-sm text-ink/60">Pick a date to review appointments, customer meetings, inspections, and collection events.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setVisibleMonth((current) => shiftMonth(current, -1))}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous month
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedDateKey(todayKey);
                setVisibleMonth(startOfMonth(parseDateKey(todayKey)));
              }}
              className="inline-flex min-h-[42px] items-center rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setVisibleMonth((current) => shiftMonth(current, 1))}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
            >
              Next month
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void handleSendTomorrowReminder()}
              disabled={reminderBusy}
              className="inline-flex min-h-[42px] items-center rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze disabled:opacity-50"
            >
              {reminderBusy ? "Sending reminder..." : "Send tomorrow reminder now"}
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink/92"
            >
              <Plus className="h-4 w-4" />
              Add Appointment
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-black/6 bg-shell/60 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-ink/48">Current month</p>
              <h3 className="mt-1 text-xl font-semibold text-ink">{formatMonthLabel(visibleMonth)}</h3>
            </div>
            <p className="text-sm text-ink/56">
              {loading ? "Loading appointments..." : `${appointments.length} appointment${appointments.length === 1 ? "" : "s"} scheduled`}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-2 text-center">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">
                {label}
              </div>
            ))}
            {calendarDays.map((day) => {
              const dateKey = toDateKey(day);
              const isSelected = dateKey === selectedDateKey;
              const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
              const isToday = dateKey === todayKey;
              const hasAppointments = (appointmentCountByDate.get(dateKey) ?? 0) > 0;

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => {
                    setSelectedDateKey(dateKey);
                    if (!isCurrentMonth) {
                      setVisibleMonth(startOfMonth(day));
                    }
                  }}
                  className={[
                    "flex min-h-[76px] flex-col items-center justify-start rounded-[20px] border px-2 py-3 text-sm transition",
                    isSelected
                      ? "border-[#C6A87D] bg-white text-ink shadow-[0_8px_24px_rgba(15,15,15,0.08)]"
                      : "border-transparent bg-white/70 text-ink hover:border-[#C6A87D]/45",
                    isToday && !isSelected ? "border-black/10" : "",
                    !isCurrentMonth ? "text-ink/35" : ""
                  ].join(" ")}
                >
                  <span className="font-semibold">{day.getDate()}</span>
                  <span className="mt-2 h-2 w-2 rounded-full" style={{ backgroundColor: hasAppointments ? "#B42318" : "transparent" }} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-bronze">Selected date</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">{formatSelectedDate(selectedDateKey)}</h2>
          </div>
          <p className="text-sm text-ink/56">
            {loading ? "Loading appointments..." : `${selectedDateAppointments.length} appointment${selectedDateAppointments.length === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {loading ? (
            <div className="rounded-[22px] border border-dashed border-black/10 bg-shell px-4 py-6 text-sm text-ink/58">
              Loading appointments...
            </div>
          ) : selectedDateAppointments.length ? (
            selectedDateAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="rounded-[24px] border border-black/6 bg-shell/55 p-4 transition hover:border-[#C6A87D]/45"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-bronze">
                        {formatTimeLabel(appointment.time)}
                      </span>
                      <h3 className="text-lg font-semibold text-ink">{appointment.title}</h3>
                    </div>
                    {appointment.description ? <p className="mt-3 text-sm leading-6 text-ink/68">{appointment.description}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink/58">
                      {appointment.customerName ? <span>Customer: {appointment.customerName}</span> : null}
                      {appointment.vehicleInfo ? <span>Vehicle / Rego: {appointment.vehicleInfo}</span> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(appointment)}
                      className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteAppointment(appointment)}
                      disabled={deletingId === appointment.id}
                      className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-[#B42318] transition hover:border-[#B42318]/35 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deletingId === appointment.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[22px] border border-dashed border-black/10 bg-shell px-4 py-6 text-sm text-ink/58">
              No appointments for this date.
            </div>
          )}
        </div>
      </div>

      {formOpen ? (
        <AppointmentFormModal
          draft={draft}
          saving={saving}
          onChange={updateDraft}
          onClose={closeModal}
          onSubmit={() => void handleSaveAppointment()}
          editing={Boolean(editingAppointmentId)}
        />
      ) : null}
    </div>
  );
}
