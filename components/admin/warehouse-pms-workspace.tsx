"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ClipboardList,
  Download,
  Loader2,
  PackagePlus,
  RefreshCw,
  Settings2,
  Warehouse,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import {
  buildWarehouseBayBoard,
  buildWarehousePmsForecast,
  calculateWarehouseBilling,
  getEffectiveWarehouseBookingStatus,
  warehouseAddDays,
  warehouseDateKey
} from "@/lib/warehouse-pms";
import {
  WarehousePmsBooking,
  WarehousePmsBookingStatus,
  WarehousePmsSnapshot,
  WarehousePmsVehicleSummary
} from "@/lib/warehouse-pms-types";
import { cn, formatAccountingCurrency, formatAdminDateTime, formatCalendarDate } from "@/lib/utils";

type WarehouseView =
  | "overview"
  | "board"
  | "bookings"
  | "arrivals"
  | "departures"
  | "checked-in"
  | "extensions"
  | "billing"
  | "analytics";

type BookingDraft = {
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  vehicleId: string;
  vehicleSource: "vehicle" | "vehicle_record";
  vehicleTitle: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleVariant: string;
  vehicleRego: string;
  vehicleVin: string;
  vehicleReference: string;
  linkedStorageContractId: string;
  plannedCheckInAt: string;
  plannedCollectionAt: string;
  monthlyRate: string;
  dailyRate: string;
  additionalStorageCharges: string;
  notes: string;
  status: "draft" | "reserved" | "confirmed";
};

const VIEWS: Array<{ id: WarehouseView; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "board", label: "Bay board" },
  { id: "bookings", label: "Storage bookings" },
  { id: "arrivals", label: "Arrivals" },
  { id: "departures", label: "Departures" },
  { id: "checked-in", label: "Checked-in" },
  { id: "extensions", label: "Extensions / overdue" },
  { id: "billing", label: "Billing" },
  { id: "analytics", label: "Analytics" }
];

function datetimeInputValue(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function makeBookingDraft(snapshot?: WarehousePmsSnapshot): BookingDraft {
  const start = new Date();
  start.setHours(9, 0, 0, 0);
  if (start.getTime() < Date.now()) start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  return {
    customerId: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    vehicleId: "",
    vehicleSource: "vehicle",
    vehicleTitle: "",
    vehicleYear: "",
    vehicleMake: "",
    vehicleModel: "",
    vehicleVariant: "",
    vehicleRego: "",
    vehicleVin: "",
    vehicleReference: "",
    linkedStorageContractId: "",
    plannedCheckInAt: datetimeInputValue(start),
    plannedCollectionAt: datetimeInputValue(end),
    monthlyRate: String(snapshot?.settings.defaultMonthlyRate ?? 380),
    dailyRate: String(snapshot?.settings.defaultDailyRate ?? 12.67),
    additionalStorageCharges: "0",
    notes: "",
    status: "confirmed"
  };
}

function statusLabel(status: WarehousePmsBookingStatus) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status: WarehousePmsBookingStatus) {
  if (status === "overdue") return "bg-rose-100 text-rose-700";
  if (status === "checked_in" || status === "extended" || status === "due_out") return "bg-emerald-100 text-emerald-700";
  if (status === "reserved" || status === "confirmed") return "bg-amber-100 text-amber-800";
  return "bg-black/5 text-ink/65";
}

function vehicleHref(booking: WarehousePmsBooking) {
  if (!booking.vehicleId) return "";
  return booking.vehicleSource === "vehicle" ? `/admin/vehicles/${booking.vehicleId}` : "/admin/warehouse-intake";
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "whitespace-nowrap border-b-2 px-1 py-3 text-sm font-semibold transition",
        active ? "border-bronze text-ink" : "border-transparent text-ink/55 hover:text-ink"
      )}
    >
      {label}
    </button>
  );
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="border-l border-black/10 px-4 first:border-l-0 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink/55">{detail}</p>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="border border-dashed border-black/15 px-5 py-10 text-center text-sm text-ink/55">{children}</div>;
}

export function WarehousePmsWorkspace() {
  const { appUser, firebaseUser, loading: authLoading } = useAuth();
  const [snapshot, setSnapshot] = useState<WarehousePmsSnapshot | null>(null);
  const [activeView, setActiveView] = useState<WarehouseView>("overview");
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [bookingDraft, setBookingDraft] = useState<BookingDraft>(() => makeBookingDraft());
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [checkInBooking, setCheckInBooking] = useState<WarehousePmsBooking | null>(null);
  const [checkOutBooking, setCheckOutBooking] = useState<WarehousePmsBooking | null>(null);
  const [extensionBooking, setExtensionBooking] = useState<WarehousePmsBooking | null>(null);
  const [selectedBayId, setSelectedBayId] = useState("");
  const [extensionDate, setExtensionDate] = useState("");
  const [checkoutExtras, setCheckoutExtras] = useState("0");
  const [checkoutOverride, setCheckoutOverride] = useState("");
  const [defaultMonthlyRate, setDefaultMonthlyRate] = useState("380");
  const [defaultDailyRate, setDefaultDailyRate] = useState("12.67");
  const [managedVehicleSearch, setManagedVehicleSearch] = useState("");

  const canManageWarehouse = hasAdminPermission(appUser, "manageVehicles");

  const request = useCallback(async (method: "GET" | "POST", body?: Record<string, unknown>) => {
    if (!firebaseUser) throw new Error("Admin authentication is still loading. Please refresh and try again.");
    const idToken = await firebaseUser.getIdToken();
    const response = await fetch("/api/admin/warehouse", {
      method,
      headers: { Authorization: `Bearer ${idToken}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const result = await response.json().catch(() => ({})) as {
      success?: boolean;
      error?: string;
      details?: { affectedDates?: Array<{ date: string }> };
      snapshot?: WarehousePmsSnapshot;
    };
    if (!response.ok || !result.success) {
      const dates = result.details?.affectedDates?.map((entry) => formatCalendarDate(entry.date)).join(", ");
      throw new Error(dates ? `${result.error || "Warehouse capacity conflict."} Affected dates: ${dates}.` : result.error || "Warehouse request failed.");
    }
    return result;
  }, [firebaseUser]);

  const loadSnapshot = useCallback(async () => {
    const result = await request("GET");
    if (!result.snapshot) throw new Error("Warehouse data was unavailable.");
    setSnapshot(result.snapshot);
    setDefaultMonthlyRate(String(result.snapshot.settings.defaultMonthlyRate));
    setDefaultDailyRate(String(result.snapshot.settings.defaultDailyRate));
    setBookingDraft((current) => current.customerId || current.vehicleId ? current : makeBookingDraft(result.snapshot));
  }, [request]);

  useEffect(() => {
    let cancelled = false;
    async function loadWarehouse() {
      if (authLoading || !canManageWarehouse) return;
      setLoading(true);
      setErrorMessage("");
      try {
        await loadSnapshot();
      } catch (error) {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : "Warehouse data could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadWarehouse();
    return () => { cancelled = true; };
  }, [authLoading, canManageWarehouse, loadSnapshot, request]);

  const runAction = async (label: string, action: Record<string, unknown>, successMessage: string) => {
    setPendingAction(label);
    setErrorMessage("");
    setNotice("");
    try {
      await request("POST", action);
      await loadSnapshot();
      setNotice(successMessage);
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Warehouse request failed.");
      return false;
    } finally {
      setPendingAction("");
    }
  };

  const selectCustomer = (customerId: string) => {
    const customer = snapshot?.customers.find((entry) => entry.id === customerId);
    setBookingDraft((current) => ({
      ...current,
      customerId,
      customerName: customer?.fullName || "",
      customerEmail: customer?.email || "",
      customerPhone: customer?.phone || ""
    }));
  };

  const selectVehicle = (value: string) => {
    const [source, id] = value.split(":");
    const vehicle = snapshot?.vehicles.find((entry) => entry.id === id && entry.source === source);
    if (!vehicle) return;
    const contract = snapshot?.linkedContracts.find((entry) =>
      vehicle.source === "vehicle" ? entry.vehicleId === vehicle.id : entry.vehicleRecordId === vehicle.id
    );
    setBookingDraft((current) => ({
      ...current,
      vehicleId: vehicle.id,
      vehicleSource: vehicle.source,
      vehicleTitle: vehicle.title,
      vehicleYear: vehicle.year || "",
      vehicleMake: vehicle.make || "",
      vehicleModel: vehicle.model || "",
      vehicleVariant: vehicle.variant || "",
      vehicleRego: vehicle.rego || "",
      vehicleVin: vehicle.vin || "",
      vehicleReference: vehicle.vehicleReference || "",
      linkedStorageContractId: contract?.id || ""
    }));
  };

  const submitBooking = async (event: FormEvent) => {
    event.preventDefault();
    const succeeded = await runAction("create-booking", { action: "create_booking", ...bookingDraft }, "Storage booking created.");
    if (succeeded) {
      setBookingModalOpen(false);
      setBookingDraft(makeBookingDraft(snapshot || undefined));
    }
  };

  const submitCheckIn = async (event: FormEvent) => {
    event.preventDefault();
    if (!checkInBooking || !selectedBayId) return;
    const succeeded = await runAction("check-in", { action: "check_in", bookingId: checkInBooking.id, bayId: selectedBayId }, "Vehicle checked in and bay assigned.");
    if (succeeded) { setCheckInBooking(null); setSelectedBayId(""); }
  };

  const submitExtension = async (event: FormEvent) => {
    event.preventDefault();
    if (!extensionBooking || !extensionDate) return;
    const succeeded = await runAction("extend", { action: "extend", bookingId: extensionBooking.id, newPlannedCollectionAt: new Date(extensionDate).toISOString() }, "Storage extension approved and recorded.");
    if (succeeded) { setExtensionBooking(null); setExtensionDate(""); }
  };

  const submitCheckout = async (event: FormEvent) => {
    event.preventDefault();
    if (!checkOutBooking) return;
    const succeeded = await runAction("check-out", {
      action: "check_out",
      bookingId: checkOutBooking.id,
      additionalStorageCharges: checkoutExtras,
      manualBillingOverride: checkoutOverride
    }, "Vehicle checked out. Its physical bay is now available.");
    if (succeeded) { setCheckOutBooking(null); setCheckoutExtras("0"); setCheckoutOverride(""); }
  };

  const handleUpdateSettings = async (event: FormEvent) => {
    event.preventDefault();
    await runAction("settings", { action: "update_settings", defaultMonthlyRate, defaultDailyRate }, "Warehouse defaults updated for future bookings.");
  };

  const today = warehouseDateKey(new Date());
  const tomorrow = warehouseAddDays(new Date(), 1);
  const forecast = useMemo(() => snapshot ? buildWarehousePmsForecast({
    settings: snapshot.settings,
    bays: snapshot.bays,
    bookings: snapshot.bookings,
    occupancies: snapshot.occupancies,
    managedVehicles: snapshot.managedVehicles,
    startAt: new Date(),
    days: 30
  }) : [], [snapshot]);
  const board = useMemo(() => snapshot ? buildWarehouseBayBoard({
    bays: snapshot.bays,
    bookings: snapshot.bookings,
    occupancies: snapshot.occupancies,
    startAt: new Date(),
    days: 14
  }) : [], [snapshot]);
  const currentForecast = forecast[0];
  const bookingsByRecency = useMemo(() => snapshot ? [...snapshot.bookings].sort((left, right) => {
    const rightValue = right.actualCheckInAt || right.plannedCheckInAt;
    const leftValue = left.actualCheckInAt || left.plannedCheckInAt;
    return rightValue.localeCompare(leftValue);
  }) : [], [snapshot]);
  const activeBookings = bookingsByRecency.filter((booking) => !booking.actualCollectionAt && !["draft", "cancelled", "no_show"].includes(booking.status));
  const arrivalsToday = activeBookings.filter((booking) => warehouseDateKey(booking.plannedCheckInAt) === today && !booking.actualCheckInAt);
  const departuresToday = activeBookings.filter((booking) => warehouseDateKey(booking.plannedCollectionAt) === today);
  const overdue = activeBookings.filter((booking) => getEffectiveWarehouseBookingStatus(booking) === "overdue");
  const checkedIn = activeBookings.filter((booking) => Boolean(booking.actualCheckInAt));
  const departuresTomorrow = activeBookings.filter((booking) => warehouseDateKey(booking.plannedCollectionAt) === tomorrow);
  const activeManagedAssignments = snapshot?.occupancies.filter((occupancy) => occupancy.sourceType === "managed_vehicle" && !occupancy.releasedAt) || [];
  const unassignedManaged = snapshot?.managedVehicles.filter((vehicle) => !activeManagedAssignments.some((occupancy) => occupancy.sourceId === vehicle.id)) || [];
  const filteredUnassignedManaged = unassignedManaged.filter((vehicle) => [vehicle.title, vehicle.rego, vehicle.vehicleReference].filter(Boolean).join(" ").toLowerCase().includes(managedVehicleSearch.trim().toLowerCase()));
  const availableBays = snapshot?.bays.filter((bay) => {
    if (bay.baseState !== "available") return false;
    const physicalBooking = checkedIn.some((booking) => booking.assignedBayId === bay.id);
    const physicalOccupancy = snapshot.occupancies.some((occupancy) => occupancy.bayId === bay.id && occupancy.occupiedFrom && !occupancy.releasedAt);
    return !physicalBooking && !physicalOccupancy;
  }) || [];

  if (!canManageWarehouse) {
    return <EmptyState>You need vehicle-management permission to use the Warehouse PMS.</EmptyState>;
  }

  if (loading && !snapshot) {
    return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-bronze" /></div>;
  }

  if (!snapshot) {
    return <EmptyState>{errorMessage || "Warehouse data is currently unavailable."}</EmptyState>;
  }

  const renderBookingRows = (items: WarehousePmsBooking[], empty: string) => items.length ? (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[850px] text-left text-sm">
        <thead className="border-b border-black/10 text-xs uppercase tracking-[0.12em] text-ink/45">
          <tr><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Schedule</th><th className="px-4 py-3">Bay</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr>
        </thead>
        <tbody>
          {items.map((booking) => {
            const status = getEffectiveWarehouseBookingStatus(booking);
            const href = vehicleHref(booking);
            return <tr key={booking.id} className="border-b border-black/5 last:border-0">
              <td className="px-4 py-4">
                {href ? <Link href={href} className="font-semibold text-ink hover:text-bronze">{booking.vehicleTitle}</Link> : <span className="font-semibold text-ink">{booking.vehicleTitle}</span>}
                <p className="mt-1 text-xs text-ink/50">{booking.vehicleRego || "No rego"} · {booking.vehicleReference || booking.reference}</p>
              </td>
              <td className="px-4 py-4"><p className="font-medium text-ink">{booking.customerName}</p><p className="mt-1 text-xs text-ink/50">{booking.reference}</p></td>
              <td className="px-4 py-4 text-ink/65"><p>{formatAdminDateTime(booking.plannedCheckInAt)}</p><p className="mt-1 text-xs">Due {formatAdminDateTime(booking.plannedCollectionAt)}</p></td>
              <td className="px-4 py-4 font-medium text-ink">{snapshot.bays.find((bay) => bay.id === booking.assignedBayId)?.label || "Unassigned"}</td>
              <td className="px-4 py-4"><span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", statusClass(status))}>{statusLabel(status)}</span></td>
              <td className="px-4 py-4"><div className="flex flex-wrap gap-2">
                {!booking.actualCheckInAt && !booking.actualCollectionAt && !["draft", "cancelled", "no_show"].includes(booking.status) && <button type="button" className="text-xs font-semibold text-ink underline-offset-4 hover:underline" onClick={() => { setCheckInBooking(booking); setSelectedBayId(""); }}>Check in</button>}
                {booking.actualCheckInAt && !booking.actualCollectionAt && <><button type="button" className="text-xs font-semibold text-ink underline-offset-4 hover:underline" onClick={() => { setExtensionBooking(booking); setExtensionDate(""); }}>Extend</button><button type="button" className="text-xs font-semibold text-ink underline-offset-4 hover:underline" onClick={() => { setCheckOutBooking(booking); setCheckoutExtras(String(booking.additionalStorageCharges)); setCheckoutOverride(booking.manualBillingOverride === undefined ? "" : String(booking.manualBillingOverride)); }}>Check out</button></>}
              </div></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  ) : <EmptyState>{empty}</EmptyState>;

  return (
    <div className="space-y-6">
      <section className="border border-black/5 bg-white p-5 shadow-panel sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-bronze"><Warehouse className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-[0.16em]">Warehouse PMS</span></div>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Vehicle storage operations</h2>
            <p className="mt-1 text-sm text-ink/60">Reservations protect capacity. Physical bays are assigned only when a vehicle checks in.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => { setBookingDraft(makeBookingDraft(snapshot)); setBookingModalOpen(true); }}><PackagePlus className="mr-2 h-4 w-4" />New booking</Button>
            <button type="button" onClick={() => void runAction("refresh", { action: "bootstrap" }, "Warehouse refreshed.")} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 text-ink transition hover:border-bronze hover:text-bronze" title="Refresh Warehouse data"><RefreshCw className={cn("h-4 w-4", pendingAction === "refresh" && "animate-spin")} /></button>
          </div>
        </div>
        <div className="mt-6 overflow-x-auto"><div className="flex min-w-max gap-5 border-b border-black/10">{VIEWS.map((view) => <TabButton key={view.id} active={activeView === view.id} label={view.label} onClick={() => setActiveView(view.id)} />)}</div></div>
      </section>

      {errorMessage && <div className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>}
      {notice && <div className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      {activeView === "overview" && <div className="space-y-6">
        <section className="border border-black/5 bg-white py-5 shadow-panel sm:py-6"><div className="grid grid-cols-2 divide-x divide-y divide-black/10 sm:grid-cols-5 sm:divide-y-0">
          <Metric label="Occupied" value={`${currentForecast?.physicalOccupied || 0} / ${snapshot.settings.bayCapacity}`} detail="Physical vehicles" />
          <Metric label="Reserved" value={currentForecast?.reserved || 0} detail="Capacity only" />
          <Metric label="Available" value={currentForecast?.availableCapacity || 0} detail="After blocked bays" />
          <Metric label="Managed" value={currentForecast?.managedOccupied || 0} detail="Explicit PMS bay assignments" />
              <Metric label="Unavailable" value={currentForecast?.unavailable || 0} detail="Blocked or maintenance" />
        </div></section>
        <section className="grid gap-4 lg:grid-cols-5">
          {[
            ["Today’s arrivals", arrivalsToday.length, "Vehicles expected to arrive"],
            ["Today’s departures", departuresToday.length, "Planned collections"],
            ["Overdue", overdue.length, "Still physically occupied"],
            ["Expected tomorrow", departuresTomorrow.length, "Planned departures"],
            ["Available bays", availableBays.length, "Physical bays now"]
          ].map(([label, value, detail]) => <div key={String(label)} className="border border-black/5 bg-white p-5 shadow-panel"><p className="text-sm font-semibold text-ink">{label}</p><p className="mt-3 text-3xl font-semibold text-ink">{value}</p><p className="mt-2 text-xs text-ink/55">{detail}</p></div>)}
        </section>
        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="border border-black/5 bg-white p-5 shadow-panel"><div className="flex items-center justify-between"><div><h3 className="font-semibold text-ink">Operational queue</h3><p className="mt-1 text-sm text-ink/55">Arrivals, planned departures and overdue storage.</p></div><button type="button" title="Open arrivals" onClick={() => setActiveView("arrivals")} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 text-ink hover:text-bronze"><ArrowUpRight className="h-4 w-4" /></button></div><div className="mt-5 divide-y divide-black/5">{[...arrivalsToday, ...departuresToday, ...overdue].slice(0, 6).map((booking) => <div key={booking.id} className="flex items-center justify-between gap-4 py-3"><div><p className="font-medium text-ink">{booking.vehicleTitle}</p><p className="mt-1 text-xs text-ink/55">{booking.customerName} · {booking.reference}</p></div><span className={cn("rounded-full px-3 py-1 text-xs font-semibold", statusClass(getEffectiveWarehouseBookingStatus(booking)))}>{statusLabel(getEffectiveWarehouseBookingStatus(booking))}</span></div>)}{![...arrivalsToday, ...departuresToday, ...overdue].length && <p className="py-8 text-center text-sm text-ink/55">No immediate warehouse actions.</p>}</div></div>
          <form onSubmit={handleUpdateSettings} className="border border-black/5 bg-white p-5 shadow-panel"><div className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-bronze" /><h3 className="font-semibold text-ink">Storage defaults</h3></div><p className="mt-1 text-sm text-ink/55">These are applied to future bookings only.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-ink">Monthly rate<Input type="number" min="0" step="0.01" className="mt-1" value={defaultMonthlyRate} onChange={(event) => setDefaultMonthlyRate(event.target.value)} /></label><label className="text-sm font-medium text-ink">Daily rate<Input type="number" min="0" step="0.01" className="mt-1" value={defaultDailyRate} onChange={(event) => setDefaultDailyRate(event.target.value)} /></label></div><Button className="mt-5" disabled={pendingAction === "settings"}><Check className="mr-2 h-4 w-4" />Save defaults</Button></form>
        </section>
        <section className="border border-black/5 bg-white p-5 shadow-panel"><div><h3 className="font-semibold text-ink">Warehouse Managed vehicle arrivals</h3><p className="mt-1 text-sm text-ink/55">Managed vehicles remain off-site until an Admin explicitly checks them into a Warehouse PMS bay. Assignment writes only new PMS occupancy data.</p></div>{unassignedManaged.length ? <><Input aria-label="Search Warehouse Managed vehicles" className="mt-5 max-w-md" placeholder="Search Managed vehicles by vehicle, rego or reference" value={managedVehicleSearch} onChange={(event) => setManagedVehicleSearch(event.target.value)} /><div className="mt-3 divide-y divide-black/5">{filteredUnassignedManaged.map((vehicle) => <div key={vehicle.id} className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between"><div><p className="font-medium text-ink">{vehicle.title}</p><p className="mt-1 text-xs text-ink/55">{vehicle.rego || "No rego"} · {vehicle.vehicleReference || vehicle.id}</p></div><div className="flex gap-2"><select aria-label={`Assign ${vehicle.title} to a warehouse bay`} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" defaultValue="" onChange={(event) => { if (event.target.value) void runAction(`managed-${vehicle.id}`, { action: "assign_managed_bay", sourceId: vehicle.id, bayId: event.target.value }, `${vehicle.title} checked in to a Warehouse PMS bay.`); }}><option value="">Assign Managed Vehicle</option>{availableBays.map((bay) => <option key={bay.id} value={bay.id}>{bay.label}</option>)}</select></div></div>)}{!filteredUnassignedManaged.length && <p className="py-5 text-sm text-ink/55">No unassigned Warehouse Managed vehicles match that search.</p>}</div></> : <p className="mt-5 text-sm text-ink/55">Every currently managed vehicle is either checked into a PMS bay or there are no active managed vehicles.</p>}{activeManagedAssignments.length ? <div className="mt-5 border-t border-black/10 pt-4"><p className="text-sm font-semibold text-ink">Active Managed Vehicle Bays</p><div className="mt-3 divide-y divide-black/5">{activeManagedAssignments.map((assignment) => <div key={assignment.id} className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between"><div><p className="font-medium text-ink">{assignment.label}</p><p className="mt-1 text-xs text-ink/55">{snapshot.bays.find((bay) => bay.id === assignment.bayId)?.label || "Assigned bay"} · Checked in {formatAdminDateTime(assignment.occupiedFrom)}</p></div><button type="button" className="text-sm font-semibold text-ink underline-offset-4 hover:underline" onClick={() => void runAction(`release-managed-${assignment.id}`, { action: "release_managed_bay", occupancyId: assignment.id }, `${assignment.label} released from its bay.`)}>Release Bay</button></div>)}</div></div> : null}</section>
      </div>}

      {activeView === "board" && <section className="border border-black/5 bg-white p-5 shadow-panel"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="font-semibold text-ink">Bay board</h3><p className="mt-1 text-sm text-ink/55">Fourteen-day physical bay view. Unassigned reservations remain in capacity, not a bay.</p></div><div className="flex gap-4 text-xs text-ink/55"><span><b className="mr-1 inline-block h-2 w-2 bg-emerald-500" />Occupied</span><span><b className="mr-1 inline-block h-2 w-2 bg-amber-400" />Reserved</span><span><b className="mr-1 inline-block h-2 w-2 bg-black/30" />Unavailable</span></div></div><div className="mt-5 overflow-x-auto"><table className="min-w-[1100px] border-collapse text-left text-xs"><thead><tr><th className="sticky left-0 z-10 min-w-32 border-b border-r border-black/10 bg-white px-3 py-3 font-semibold text-ink">Bay</th>{board[0]?.cells.map((cell) => <th key={cell.date} className="min-w-32 border-b border-black/10 px-3 py-3 font-semibold text-ink">{formatCalendarDate(cell.date)}</th>)}</tr></thead><tbody>{board.map((row) => <tr key={row.bay.id}><td className="sticky left-0 z-10 border-b border-r border-black/10 bg-white px-3 py-3 font-semibold text-ink"><p>{row.bay.label}</p><select aria-label={`${row.bay.label} state`} className="mt-1 w-full border border-black/10 bg-white px-1 py-1 text-[11px] font-medium text-ink/65" value={row.bay.baseState} onChange={(event) => void runAction(`bay-${row.bay.id}`, { action: "update_bay", bayId: row.bay.id, baseState: event.target.value }, `${row.bay.label} updated.`)}><option value="available">Available</option><option value="temporarily_blocked">Temporarily blocked</option><option value="maintenance">Maintenance</option></select></td>{row.cells.map((cell) => <td key={cell.date} className="border-b border-r border-black/5 p-1"><div className={cn("min-h-14 px-2 py-2", cell.state === "occupied" && "bg-emerald-50 text-emerald-800", cell.state === "temporarily_blocked" && "bg-amber-50 text-amber-800", cell.state === "maintenance" && "bg-black/5 text-ink/55", cell.state === "available" && "text-ink/45")}><p>{cell.label}</p>{cell.state === "occupied" && <div className="mt-1 space-y-0.5 text-[10px] leading-tight"><p className="font-semibold">{cell.vehicleType === "managed" ? "Managed vehicle" : cell.vehicleType === "storage" ? "Storage vehicle" : "Internal vehicle"}</p><p>Check-in {formatCalendarDate(cell.checkInAt)}</p>{cell.expectedDepartureAt && <p>Expected {formatCalendarDate(cell.expectedDepartureAt)}</p>}{cell.occupancyId && cell.vehicleType === "managed" && cell.date === today && <button type="button" className="pt-1 text-[10px] font-semibold underline underline-offset-2" onClick={() => void runAction(`release-managed-${cell.occupancyId}`, { action: "release_managed_bay", occupancyId: cell.occupancyId }, "Managed vehicle bay released.")}>Release Bay</button>}</div>}</div></td>)}</tr>)}</tbody></table></div><div className="mt-5 flex flex-wrap gap-2 border-t border-black/10 pt-4 text-sm"><span className="font-semibold text-ink">Unassigned reservations</span>{forecast.slice(0, 14).map((entry) => <span key={entry.date} className="border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">{formatCalendarDate(entry.date)}: {entry.reserved}</span>)}</div></section>}

      {activeView === "bookings" && <section className="border border-black/5 bg-white shadow-panel"><div className="flex items-center justify-between gap-4 p-5"><div><h3 className="font-semibold text-ink">Storage bookings</h3><p className="mt-1 text-sm text-ink/55">Reservation capacity and physical check-in are separate.</p></div><Button onClick={() => { setBookingDraft(makeBookingDraft(snapshot)); setBookingModalOpen(true); }}><PackagePlus className="mr-2 h-4 w-4" />New booking</Button></div>{renderBookingRows(bookingsByRecency, "No storage bookings yet.")}</section>}

      {activeView === "arrivals" && <section className="border border-black/5 bg-white shadow-panel"><div className="p-5"><h3 className="font-semibold text-ink">Today’s arrivals</h3><p className="mt-1 text-sm text-ink/55">Planned to arrive today and not yet physically checked in.</p></div>{renderBookingRows(arrivalsToday, "No arrivals are scheduled today.")}</section>}
      {activeView === "departures" && <section className="border border-black/5 bg-white shadow-panel"><div className="p-5"><h3 className="font-semibold text-ink">Today’s departures</h3><p className="mt-1 text-sm text-ink/55">A planned departure does not free the bay until check-out is completed.</p></div>{renderBookingRows(departuresToday, "No departures are planned today.")}</section>}
      {activeView === "checked-in" && <section className="border border-black/5 bg-white shadow-panel"><div className="p-5"><h3 className="font-semibold text-ink">Checked-in vehicles</h3><p className="mt-1 text-sm text-ink/55">Physical occupancy remains active until actual check-out.</p></div>{renderBookingRows(checkedIn, "No storage vehicles are currently checked in.")}</section>}
      {activeView === "extensions" && <section className="border border-black/5 bg-white shadow-panel"><div className="p-5"><h3 className="font-semibold text-ink">Extensions and overdue vehicles</h3><p className="mt-1 text-sm text-ink/55">Extensions are recorded as history and capacity is validated before approval.</p></div>{renderBookingRows([...overdue, ...checkedIn.filter((booking) => getEffectiveWarehouseBookingStatus(booking) === "extended")], "No extensions or overdue vehicles.")}<div className="border-t border-black/10 p-5"><h4 className="text-sm font-semibold text-ink">Extension history</h4>{snapshot.extensions.length ? <div className="mt-3 divide-y divide-black/5">{snapshot.extensions.map((extension) => <div key={extension.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><span className="font-medium text-ink">{extension.bookingReference}</span><span className="text-ink/60">{formatCalendarDate(extension.previousPlannedCollectionAt)} to {formatCalendarDate(extension.newPlannedCollectionAt)}</span><span className="text-ink/60">{extension.extensionDays} days · {formatAccountingCurrency(extension.additionalEstimatedCharge)}</span></div>)}</div> : <p className="mt-3 text-sm text-ink/55">No extension history yet.</p>}</div></section>}

      {activeView === "billing" && <section className="border border-black/5 bg-white shadow-panel"><div className="flex items-center justify-between p-5"><div><h3 className="font-semibold text-ink">Storage billing</h3><p className="mt-1 text-sm text-ink/55">Calculation only. No Accounting entries are created.</p></div><button type="button" title="Print storage statement" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 text-ink hover:text-bronze" onClick={() => window.print()}><Download className="h-4 w-4" /></button></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-black/10 text-xs uppercase tracking-[0.12em] text-ink/45"><tr><th className="px-4 py-3">Booking</th><th className="px-4 py-3">Days</th><th className="px-4 py-3">Monthly</th><th className="px-4 py-3">Extra days</th><th className="px-4 py-3">Additional</th><th className="px-4 py-3">Final total</th></tr></thead><tbody>{bookingsByRecency.map((booking) => { const billing = calculateWarehouseBilling({ startAt: booking.actualCheckInAt || booking.plannedCheckInAt, endAt: booking.actualCollectionAt || booking.plannedCollectionAt, monthlyRate: booking.monthlyRate, dailyRate: booking.dailyRate, additionalStorageCharges: booking.additionalStorageCharges, manualBillingOverride: booking.manualBillingOverride }); return <tr key={booking.id} className="border-b border-black/5"><td className="px-4 py-4"><p className="font-medium text-ink">{booking.vehicleTitle}</p><p className="mt-1 text-xs text-ink/50">{booking.reference}</p></td><td className="px-4 py-4">{billing.totalDays}</td><td className="px-4 py-4">{formatAccountingCurrency(billing.monthlyCharge)}</td><td className="px-4 py-4">{billing.extraDays} · {formatAccountingCurrency(billing.dailyCharge)}</td><td className="px-4 py-4">{formatAccountingCurrency(billing.additionalCharges)}</td><td className="px-4 py-4 font-semibold text-ink">{formatAccountingCurrency(billing.finalTotal)}</td></tr>; })}</tbody></table></div></section>}

      {activeView === "analytics" && <section className="space-y-6"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{(() => { const averageOccupancy = forecast.length ? forecast.reduce((sum, day) => sum + day.physicalOccupied, 0) / forecast.length : 0; const storageRevenue = checkedIn.reduce((sum, booking) => sum + booking.monthlyRate, 0); const averageStay = checkedIn.length ? checkedIn.reduce((sum, booking) => sum + calculateWarehouseBilling({ startAt: booking.actualCheckInAt || booking.plannedCheckInAt, endAt: booking.actualCollectionAt || booking.plannedCollectionAt, monthlyRate: booking.monthlyRate, dailyRate: booking.dailyRate }).totalDays, 0) / checkedIn.length : 0; return <><div className="border border-black/5 bg-white p-5 shadow-panel"><p className="text-sm font-semibold text-ink">Occupancy rate</p><p className="mt-3 text-3xl font-semibold text-ink">{snapshot.settings.bayCapacity ? Math.round(((currentForecast?.physicalOccupied || 0) / snapshot.settings.bayCapacity) * 100) : 0}%</p><p className="mt-2 text-xs text-ink/55">Physical vehicles only</p></div><div className="border border-black/5 bg-white p-5 shadow-panel"><p className="text-sm font-semibold text-ink">Average occupancy</p><p className="mt-3 text-3xl font-semibold text-ink">{averageOccupancy.toFixed(1)}</p><p className="mt-2 text-xs text-ink/55">Physical bays across 30 days</p></div><div className="border border-black/5 bg-white p-5 shadow-panel"><p className="text-sm font-semibold text-ink">Storage revenue estimate</p><p className="mt-3 text-3xl font-semibold text-ink">{formatAccountingCurrency(storageRevenue)}</p><p className="mt-2 text-xs text-ink/55">Revenue-generating storage only</p></div><div className="border border-black/5 bg-white p-5 shadow-panel"><p className="text-sm font-semibold text-ink">Average stay length</p><p className="mt-3 text-3xl font-semibold text-ink">{averageStay.toFixed(0)} days</p><p className="mt-2 text-xs text-ink/55">Current storage bookings</p></div></>; })()}</div><div className="grid gap-6 lg:grid-cols-2"><div className="border border-black/5 bg-white p-5 shadow-panel"><h3 className="font-semibold text-ink">Capacity forecast</h3><div className="mt-4 divide-y divide-black/5">{forecast.slice(0, 16).map((day) => <div key={day.date} className="flex items-center justify-between py-2 text-sm"><span className="text-ink/65">{formatCalendarDate(day.date)}</span><span className="font-medium text-ink">{day.capacityUsed + day.unavailable} / {snapshot.settings.bayCapacity}{day.isFull ? " FULL" : ""}</span></div>)}</div></div><div className="border border-black/5 bg-white p-5 shadow-panel"><h3 className="font-semibold text-ink">Occupancy mix</h3><div className="mt-4 divide-y divide-black/5 text-sm"><div className="flex justify-between py-2"><span className="text-ink/65">Storage customer vehicles</span><span className="font-semibold text-ink">{checkedIn.length}</span></div><div className="flex justify-between py-2"><span className="text-ink/65">Managed vehicle bay usage</span><span className="font-semibold text-ink">{currentForecast?.managedOccupied || 0}</span></div><div className="flex justify-between py-2"><span className="text-ink/65">Internal / listing occupancy</span><span className="font-semibold text-ink">{currentForecast?.internalOccupied || 0}</span></div><div className="flex justify-between py-2"><span className="text-ink/65">Available capacity</span><span className="font-semibold text-ink">{currentForecast?.availableCapacity || 0}</span></div><div className="flex justify-between py-2"><span className="text-ink/65">Theoretical monthly storage capacity</span><span className="font-semibold text-ink">{formatAccountingCurrency(snapshot.settings.bayCapacity * snapshot.settings.defaultMonthlyRate)}</span></div></div></div></div></section>}

      {bookingModalOpen && <Modal title="New storage booking" onClose={() => setBookingModalOpen(false)}><form onSubmit={submitBooking} className="space-y-5"><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium text-ink">Customer<select required className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm" value={bookingDraft.customerId} onChange={(event) => selectCustomer(event.target.value)}><option value="">Select registered customer</option>{snapshot.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.fullName}{customer.email ? ` · ${customer.email}` : ""}</option>)}</select></label><label className="text-sm font-medium text-ink">Vehicle<select required className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm" value={bookingDraft.vehicleId ? `${bookingDraft.vehicleSource}:${bookingDraft.vehicleId}` : ""} onChange={(event) => selectVehicle(event.target.value)}><option value="">Select CarNest vehicle / record</option>{snapshot.vehicles.map((vehicle) => <option key={`${vehicle.source}:${vehicle.id}`} value={`${vehicle.source}:${vehicle.id}`}>{vehicle.title}{vehicle.rego ? ` · ${vehicle.rego}` : ""}</option>)}</select></label><label className="text-sm font-medium text-ink">Planned check-in<Input required type="datetime-local" className="mt-1" value={bookingDraft.plannedCheckInAt} onChange={(event) => setBookingDraft((current) => ({ ...current, plannedCheckInAt: event.target.value }))} /></label><label className="text-sm font-medium text-ink">Planned collection<Input required type="datetime-local" className="mt-1" value={bookingDraft.plannedCollectionAt} onChange={(event) => setBookingDraft((current) => ({ ...current, plannedCollectionAt: event.target.value }))} /></label><label className="text-sm font-medium text-ink">Booking status<select className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm" value={bookingDraft.status} onChange={(event) => setBookingDraft((current) => ({ ...current, status: event.target.value as BookingDraft["status"] }))}><option value="draft">Draft</option><option value="reserved">Reserved</option><option value="confirmed">Confirmed</option></select></label><label className="text-sm font-medium text-ink">Monthly rate<Input required type="number" min="0" step="0.01" className="mt-1" value={bookingDraft.monthlyRate} onChange={(event) => setBookingDraft((current) => ({ ...current, monthlyRate: event.target.value }))} /></label><label className="text-sm font-medium text-ink">Daily rate<Input required type="number" min="0" step="0.01" className="mt-1" value={bookingDraft.dailyRate} onChange={(event) => setBookingDraft((current) => ({ ...current, dailyRate: event.target.value }))} /></label><label className="text-sm font-medium text-ink">Additional charges<Input type="number" min="0" step="0.01" className="mt-1" value={bookingDraft.additionalStorageCharges} onChange={(event) => setBookingDraft((current) => ({ ...current, additionalStorageCharges: event.target.value }))} /></label></div>{bookingDraft.linkedStorageContractId && <div className="border border-black/10 bg-black/[0.02] px-4 py-3 text-sm text-ink/65">Linked existing Storage Contract: {snapshot.linkedContracts.find((contract) => contract.id === bookingDraft.linkedStorageContractId)?.reference || bookingDraft.linkedStorageContractId} (read-only)</div>}<label className="block text-sm font-medium text-ink">Notes<textarea className="mt-1 min-h-24 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-bronze" value={bookingDraft.notes} onChange={(event) => setBookingDraft((current) => ({ ...current, notes: event.target.value }))} /></label><div className="flex justify-end gap-3"><button type="button" className="px-4 py-3 text-sm font-semibold text-ink/65" onClick={() => setBookingModalOpen(false)}>Cancel</button><Button disabled={pendingAction === "create-booking"}>{pendingAction === "create-booking" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create booking</Button></div></form></Modal>}

      {checkInBooking && <Modal title={`Check in ${checkInBooking.vehicleTitle}`} onClose={() => setCheckInBooking(null)}><form onSubmit={submitCheckIn} className="space-y-5"><div className="border border-black/10 bg-black/[0.02] px-4 py-3 text-sm text-ink/65"><p>Customer: {checkInBooking.customerName}</p><p className="mt-1">Planned collection: {formatAdminDateTime(checkInBooking.plannedCollectionAt)}</p></div><label className="block text-sm font-medium text-ink">Physical bay<select required className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm" value={selectedBayId} onChange={(event) => setSelectedBayId(event.target.value)}><option value="">Select available bay</option>{availableBays.map((bay) => <option key={bay.id} value={bay.id}>{bay.label}</option>)}</select></label><div className="flex justify-end gap-3"><button type="button" className="px-4 py-3 text-sm font-semibold text-ink/65" onClick={() => setCheckInBooking(null)}>Cancel</button><Button disabled={!selectedBayId || pendingAction === "check-in"}>Check in</Button></div></form></Modal>}

      {extensionBooking && <Modal title={`Extend ${extensionBooking.vehicleTitle}`} onClose={() => setExtensionBooking(null)}><form onSubmit={submitExtension} className="space-y-5"><p className="text-sm text-ink/65">Current collection: {formatAdminDateTime(extensionBooking.plannedCollectionAt)}. Approval validates capacity on every added date and preserves extension history.</p><label className="block text-sm font-medium text-ink">New planned collection<Input required type="datetime-local" min={datetimeInputValue(new Date(extensionBooking.plannedCollectionAt))} className="mt-1" value={extensionDate} onChange={(event) => setExtensionDate(event.target.value)} /></label><div className="flex justify-end gap-3"><button type="button" className="px-4 py-3 text-sm font-semibold text-ink/65" onClick={() => setExtensionBooking(null)}>Cancel</button><Button disabled={!extensionDate || pendingAction === "extend"}>Approve extension</Button></div></form></Modal>}

      {checkOutBooking && <Modal title={`Check out ${checkOutBooking.vehicleTitle}`} onClose={() => setCheckOutBooking(null)}><form onSubmit={submitCheckout} className="space-y-5">{(() => { const billing = calculateWarehouseBilling({ startAt: checkOutBooking.actualCheckInAt || checkOutBooking.plannedCheckInAt, endAt: new Date().toISOString(), monthlyRate: checkOutBooking.monthlyRate, dailyRate: checkOutBooking.dailyRate, additionalStorageCharges: Number(checkoutExtras || 0), manualBillingOverride: checkoutOverride === "" ? undefined : Number(checkoutOverride) }); return <div className="grid grid-cols-2 gap-3 border border-black/10 bg-black/[0.02] p-4 text-sm text-ink/65"><p>Planned check-in <span className="block font-semibold text-ink">{formatAdminDateTime(checkOutBooking.plannedCheckInAt)}</span></p><p>Planned collection <span className="block font-semibold text-ink">{formatAdminDateTime(checkOutBooking.plannedCollectionAt)}</span></p><p>Actual check-in <span className="block font-semibold text-ink">{formatAdminDateTime(checkOutBooking.actualCheckInAt)}</span></p><p>Total days <span className="block font-semibold text-ink">{billing.totalDays}</span></p><p>Monthly charge <span className="block font-semibold text-ink">{formatAccountingCurrency(billing.monthlyCharge)}</span></p><p>Extra days <span className="block font-semibold text-ink">{billing.extraDays} · {formatAccountingCurrency(billing.dailyCharge)}</span></p><p className="col-span-2 text-base font-semibold text-ink">Final total <span className="ml-2">{formatAccountingCurrency(billing.finalTotal)}</span></p></div>; })()}<div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium text-ink">Additional storage charges<Input type="number" min="0" step="0.01" className="mt-1" value={checkoutExtras} onChange={(event) => setCheckoutExtras(event.target.value)} /></label><label className="text-sm font-medium text-ink">Manual storage charge override<Input type="number" min="0" step="0.01" placeholder="Calculated rate" className="mt-1" value={checkoutOverride} onChange={(event) => setCheckoutOverride(event.target.value)} /></label></div><p className="text-xs text-ink/55">This finalizes Warehouse PMS history only. It does not create an Accounting entry.</p><div className="flex justify-end gap-3"><button type="button" className="px-4 py-3 text-sm font-semibold text-ink/65" onClick={() => setCheckOutBooking(null)}>Cancel</button><Button disabled={pendingAction === "check-out"}>Check out and release bay</Button></div></form></Modal>}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto bg-white shadow-2xl"><div className="sticky top-0 flex items-center justify-between border-b border-black/10 bg-white px-5 py-4"><h3 className="font-semibold text-ink">{title}</h3><button type="button" title="Close" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink/55 hover:bg-black/5 hover:text-ink"><X className="h-4 w-4" /></button></div><div className="p-5 sm:p-6">{children}</div></div></div>;
}
