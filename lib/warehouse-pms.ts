import {
  WarehousePmsBay,
  WarehousePmsBooking,
  WarehousePmsBookingStatus,
  WarehousePmsManagedVehicle,
  WarehousePmsOccupancy,
  WarehousePmsSettings
} from "@/lib/warehouse-pms-types";

export const WAREHOUSE_PMS_DEFAULT_SETTINGS: WarehousePmsSettings = {
  id: "default",
  defaultMonthlyRate: 380,
  defaultDailyRate: 12.67,
  bayCapacity: 20
};

const DAY_MS = 24 * 60 * 60 * 1000;

export interface WarehousePmsBilling {
  totalDays: number;
  completeThirtyDayCycles: number;
  extraDays: number;
  monthlyCharge: number;
  dailyCharge: number;
  additionalCharges: number;
  storageCharge: number;
  finalTotal: number;
}

export interface WarehousePmsForecastDay {
  date: string;
  physicalOccupied: number;
  managedOccupied: number;
  internalOccupied: number;
  reserved: number;
  unavailable: number;
  capacityUsed: number;
  availableCapacity: number;
  isFull: boolean;
}

export interface WarehousePmsCapacityConflict {
  date: string;
  capacityUsed: number;
  bayCapacity: number;
}

export interface WarehousePmsBayBoardCell {
  date: string;
  label: string;
  state: "available" | "occupied" | "temporarily_blocked" | "maintenance";
  bookingId?: string;
  occupancyId?: string;
  vehicleType?: "storage" | "managed" | "internal" | "listing";
  checkInAt?: string;
  expectedDepartureAt?: string;
}

export interface WarehousePmsBayBoardRow {
  bay: WarehousePmsBay;
  cells: WarehousePmsBayBoardCell[];
}

function validDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function warehouseDateKey(value: Date | string) {
  const date = typeof value === "string" ? validDate(value) : value;
  if (!date) return "";
  const local = startOfDay(date);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}

export function warehouseAddDays(value: Date | string, days: number) {
  const date = typeof value === "string" ? validDate(value) : value;
  if (!date) return "";
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return warehouseDateKey(next);
}

export function warehouseDateRange(start: Date | string, end: Date | string) {
  const first = typeof start === "string" ? validDate(start) : start;
  const last = typeof end === "string" ? validDate(end) : end;
  if (!first || !last || startOfDay(last).getTime() < startOfDay(first).getTime()) return [];

  const dates: string[] = [];
  const cursor = startOfDay(first);
  const finish = startOfDay(last);
  while (cursor.getTime() <= finish.getTime()) {
    dates.push(warehouseDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function isOnOrBefore(left: string, right: string) {
  return left <= right;
}

function isActiveBooking(booking: WarehousePmsBooking) {
  return !["draft", "cancelled", "no_show", "checked_out"].includes(booking.status) && !booking.actualCollectionAt;
}

function isBookingPhysicallyPresent(booking: WarehousePmsBooking, date: string) {
  if (!isActiveBooking(booking) || !booking.actualCheckInAt || !booking.assignedBayId) return false;
  const checkInDate = warehouseDateKey(booking.actualCheckInAt);
  return Boolean(checkInDate) && isOnOrBefore(checkInDate, date);
}

function isBookingReserved(booking: WarehousePmsBooking, date: string) {
  if (!isActiveBooking(booking) || booking.actualCheckInAt) return false;
  const start = warehouseDateKey(booking.plannedCheckInAt);
  const end = warehouseDateKey(booking.plannedCollectionAt);
  return Boolean(start && end && isOnOrBefore(start, date) && isOnOrBefore(date, end));
}

function isOccupancyActive(occupancy: WarehousePmsOccupancy, date: string) {
  const start = warehouseDateKey(occupancy.occupiedFrom);
  const releasedAt = occupancy.releasedAt ? warehouseDateKey(occupancy.releasedAt) : "";
  return Boolean(start && isOnOrBefore(start, date) && (!releasedAt || date < releasedAt));
}

export function getEffectiveWarehouseBookingStatus(booking: WarehousePmsBooking, now = new Date()): WarehousePmsBookingStatus {
  if (booking.actualCollectionAt || booking.status === "checked_out") return "checked_out";
  if (["draft", "cancelled", "no_show", "reserved", "confirmed"].includes(booking.status)) return booking.status;

  if (booking.actualCheckInAt) {
    const today = warehouseDateKey(now);
    const plannedCollection = warehouseDateKey(booking.plannedCollectionAt);
    if (plannedCollection && plannedCollection < today) return "overdue";
    if (plannedCollection === today) return "due_out";
  }

  return booking.status === "extended" ? "extended" : "checked_in";
}

export function calculateWarehouseBilling(input: {
  startAt: string;
  endAt: string;
  monthlyRate: number;
  dailyRate: number;
  additionalStorageCharges?: number;
  manualBillingOverride?: number;
}): WarehousePmsBilling {
  const start = validDate(input.startAt);
  const end = validDate(input.endAt);
  const rawDays = start && end ? Math.ceil(Math.max(0, end.getTime() - start.getTime()) / DAY_MS) : 0;
  const totalDays = Math.max(1, rawDays);
  const completeThirtyDayCycles = Math.floor(totalDays / 30);
  const extraDays = totalDays % 30;
  const monthlyCharge = Number((completeThirtyDayCycles * input.monthlyRate).toFixed(2));
  const dailyCharge = Number((extraDays * input.dailyRate).toFixed(2));
  const calculatedStorageCharge = Number((monthlyCharge + dailyCharge).toFixed(2));
  const storageCharge = Number.isFinite(input.manualBillingOverride)
    ? Number(input.manualBillingOverride!.toFixed(2))
    : calculatedStorageCharge;
  const additionalCharges = Number((input.additionalStorageCharges ?? 0).toFixed(2));

  return {
    totalDays,
    completeThirtyDayCycles,
    extraDays,
    monthlyCharge,
    dailyCharge,
    additionalCharges,
    storageCharge,
    finalTotal: Number((storageCharge + additionalCharges).toFixed(2))
  };
}

export function buildWarehousePmsForecast(input: {
  settings: WarehousePmsSettings;
  bays: WarehousePmsBay[];
  bookings: WarehousePmsBooking[];
  occupancies: WarehousePmsOccupancy[];
  managedVehicles: WarehousePmsManagedVehicle[];
  startAt: Date | string;
  days: number;
}) {
  const start = typeof input.startAt === "string" ? validDate(input.startAt) : input.startAt;
  if (!start || input.days < 1) return [] as WarehousePmsForecastDay[];
  const managedVehicleIdsWithActiveStorage = new Set(
    input.bookings
      .filter((booking) => isActiveBooking(booking) && Boolean(booking.actualCheckInAt) && Boolean(booking.assignedBayId) && booking.vehicleId)
      .map((booking) => booking.vehicleId!)
  );
  const unavailable = input.bays.filter((bay) => bay.baseState === "temporarily_blocked" || bay.baseState === "maintenance").length;
  const capacity = Math.max(0, input.settings.bayCapacity - unavailable);

  return Array.from({ length: input.days }, (_, index) => {
    const date = warehouseAddDays(start, index);
    const storageOccupied = input.bookings.filter((booking) => isBookingPhysicallyPresent(booking, date)).length;
    const managedOccupied = input.occupancies.filter((occupancy) =>
      occupancy.sourceType === "managed_vehicle"
      && !managedVehicleIdsWithActiveStorage.has(occupancy.sourceId)
      && isOccupancyActive(occupancy, date)
    ).length;
    const internalOccupied = input.occupancies.filter((occupancy) => {
      if (occupancy.sourceType === "managed_vehicle") return false;
      return isOccupancyActive(occupancy, date);
    }).length;
    const reserved = input.bookings.filter((booking) => isBookingReserved(booking, date)).length;
    const capacityUsed = storageOccupied + managedOccupied + internalOccupied + reserved;

    return {
      date,
      physicalOccupied: storageOccupied + managedOccupied + internalOccupied,
      managedOccupied,
      internalOccupied,
      reserved,
      unavailable,
      capacityUsed,
      availableCapacity: Math.max(0, capacity - capacityUsed),
      isFull: capacityUsed >= capacity
    };
  });
}

export function findWarehouseCapacityConflicts(input: {
  settings: WarehousePmsSettings;
  bays: WarehousePmsBay[];
  bookings: WarehousePmsBooking[];
  occupancies: WarehousePmsOccupancy[];
  managedVehicles: WarehousePmsManagedVehicle[];
  startAt: string;
  endAt: string;
}) {
  const dates = warehouseDateRange(input.startAt, input.endAt);
  if (!dates.length) return [] as WarehousePmsCapacityConflict[];
  const forecast = buildWarehousePmsForecast({ ...input, startAt: dates[0], days: dates.length });
  return forecast
    .filter((entry) => entry.isFull && entry.capacityUsed > Math.max(0, input.settings.bayCapacity - entry.unavailable))
    .map((entry) => ({
      date: entry.date,
      capacityUsed: entry.capacityUsed,
      bayCapacity: Math.max(0, input.settings.bayCapacity - entry.unavailable)
    }));
}

export function buildWarehouseBayBoard(input: {
  bays: WarehousePmsBay[];
  bookings: WarehousePmsBooking[];
  occupancies: WarehousePmsOccupancy[];
  startAt: Date | string;
  days: number;
}) {
  const start = typeof input.startAt === "string" ? validDate(input.startAt) : input.startAt;
  if (!start) return [] as WarehousePmsBayBoardRow[];
  const dates = Array.from({ length: input.days }, (_, index) => warehouseAddDays(start, index));

  return [...input.bays]
    .sort((left, right) => left.sequence - right.sequence)
    .map((bay) => ({
      bay,
      cells: dates.map((date) => {
        if (bay.baseState === "temporarily_blocked" || bay.baseState === "maintenance") {
          return {
            date,
            label: bay.baseState === "maintenance" ? "Maintenance" : "Temporarily blocked",
            state: bay.baseState
          };
        }
        const booking = input.bookings.find(
          (entry) => entry.assignedBayId === bay.id && isBookingPhysicallyPresent(entry, date)
        );
        if (booking) {
          const dueOut = warehouseDateKey(booking.plannedCollectionAt) === date;
          return {
            date,
            label: dueOut ? `Due out: ${booking.vehicleTitle}` : booking.vehicleTitle,
            state: "occupied",
            bookingId: booking.id,
            vehicleType: "storage",
            checkInAt: booking.actualCheckInAt,
            expectedDepartureAt: booking.plannedCollectionAt
          };
        }
        const occupancy = input.occupancies.find(
          (entry) => entry.bayId === bay.id && isOccupancyActive(entry, date)
        );
        if (occupancy) {
          return {
            date,
            label: occupancy.label,
            state: "occupied",
            occupancyId: occupancy.id,
            vehicleType: occupancy.sourceType === "managed_vehicle" ? "managed" : occupancy.sourceType,
            checkInAt: occupancy.occupiedFrom,
            expectedDepartureAt: occupancy.plannedDepartureAt || undefined
          };
        }
        return { date, label: "Available", state: "available" };
      })
    }));
}

export function getWarehouseBookingExtensionEstimate(booking: WarehousePmsBooking, newPlannedCollectionAt: string) {
  const before = calculateWarehouseBilling({
    startAt: booking.actualCheckInAt || booking.plannedCheckInAt,
    endAt: booking.plannedCollectionAt,
    monthlyRate: booking.monthlyRate,
    dailyRate: booking.dailyRate
  });
  const after = calculateWarehouseBilling({
    startAt: booking.actualCheckInAt || booking.plannedCheckInAt,
    endAt: newPlannedCollectionAt,
    monthlyRate: booking.monthlyRate,
    dailyRate: booking.dailyRate
  });
  return Number((after.storageCharge - before.storageCharge).toFixed(2));
}
