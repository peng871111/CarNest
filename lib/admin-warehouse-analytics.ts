import type {
  AdminAccountingEntry,
  AdminWarehouseAnalyticsSettings,
  Vehicle,
  VehicleRecord,
  WarehouseIntakeRecord,
} from "@/types";

const DAY_MS = 1000 * 60 * 60 * 24;

export type WarehouseVehicleTableSort =
  | "longest_storage"
  | "highest_storage_cost"
  | "lowest_storage_cost"
  | "newest_arrival";

export interface WarehouseCurrentVehicleRow {
  vehicleId: string;
  vehicleRecordId: string;
  title: string;
  reference: string;
  rego: string;
  daysInStorage: number | null;
  dailyStorageCost: number | null;
  totalAccumulatedStorageCost: number | null;
  listingStatus: string;
  rowTone: "default" | "warning" | "alert" | "critical";
}

export interface WarehouseRankingRow {
  vehicleId: string;
  vehicleRecordId: string;
  title: string;
  reference: string;
  rego: string;
  warehouseIntakeDate: string;
  soldDate: string;
  daysToSell: number | null;
  totalStorageCost: number | null;
  listingStatus: string;
  platformRevenue: number | null;
  estimatedUsingCurrentCost: boolean;
}

export interface WarehouseAnalyticsSummary {
  currentWarehouseVehicles: number;
  warehouseCapacity: number;
  occupancyRate: number | null;
  warehouseOperatingCostPerDay: number;
  currentCostPerVehiclePerDay: number | null;
  averageStorageDays: number | null;
  totalAccumulatedStorageCost: number | null;
  highestCostVehicleLabel: string;
  longestHoldingVehicleLabel: string;
}

export interface WarehouseAnalyticsReport {
  summary: WarehouseAnalyticsSummary;
  currentVehicles: WarehouseCurrentVehicleRow[];
  longestHoldingVehicles: WarehouseCurrentVehicleRow[];
  fastestTurnoverVehicles: WarehouseRankingRow[];
  lowestManagementCostSoldVehicles: WarehouseRankingRow[];
}

type WarehouseLifecycle = {
  warehouseIntakeDate: Date | null;
  warehouseIntakeDateLabel: string;
  effectiveStartDate: Date | null;
  knownEndDate: Date | null;
  soldDate: Date | null;
  soldDateLabel: string;
  isCurrentActive: boolean;
  hasUnknownHistoricalEnd: boolean;
};

type WarehouseVehicleContext = {
  vehicle: Vehicle;
  vehicleRecord: VehicleRecord | null;
  intakes: WarehouseIntakeRecord[];
  lifecycle: WarehouseLifecycle;
  title: string;
  reference: string;
  rego: string;
  listedDays: number | null;
  accountingPlatformRevenue: number | null;
  listingStatus: string;
};

function parseIsoDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateInput(date: Date | null) {
  if (!date) return "Not available";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function diffWholeDays(later: Date, earlier: Date) {
  const diff = startOfDay(later).getTime() - startOfDay(earlier).getTime();
  return Math.max(0, Math.floor(diff / DAY_MS));
}

function maxDate(left: Date | null, right: Date | null) {
  if (!left) return right;
  if (!right) return left;
  return left.getTime() >= right.getTime() ? left : right;
}

function minDate(values: Array<Date | null>) {
  const filtered = values.filter((value): value is Date => Boolean(value));
  if (!filtered.length) return null;
  return filtered.reduce((earliest, current) => (current.getTime() < earliest.getTime() ? current : earliest));
}

function maxDateFromList(values: Array<Date | null>) {
  const filtered = values.filter((value): value is Date => Boolean(value));
  if (!filtered.length) return null;
  return filtered.reduce((latest, current) => (current.getTime() > latest.getTime() ? current : latest));
}

function isWarehouseManaged(vehicle: Vehicle) {
  return vehicle.listingType === "warehouse" || vehicle.storedInWarehouse || vehicle.isManagedByCarnest === true;
}

function getVehicleListedAt(vehicle: Vehicle) {
  return vehicle.approvedAt || vehicle.createdAt || "";
}

function getDaysBetweenIsoDates(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return null;
  const startTime = new Date(startDate).getTime();
  const endTime = new Date(endDate).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) return null;
  return Math.max(Math.ceil((endTime - startTime) / DAY_MS), 0);
}

function isCurrentWarehouseListing(vehicle: Vehicle, vehicleRecord: VehicleRecord | null) {
  if (!isWarehouseManaged(vehicle) || vehicle.deleted) return false;
  if (vehicle.status !== "approved") return false;
  if (vehicle.sellerStatus !== "ACTIVE" && vehicle.sellerStatus !== "UNDER_OFFER") return false;
  if (vehicleRecord?.status === "archived" || vehicleRecord?.status === "sold" || vehicleRecord?.status === "withdrawn") return false;
  return true;
}

function buildVehicleTitle(vehicle: Vehicle, vehicleRecord: VehicleRecord | null) {
  const listingTitle = [vehicle.year, vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(" ").trim();
  const recordTitle = [vehicleRecord?.year, vehicleRecord?.make, vehicleRecord?.model, vehicleRecord?.variant].filter(Boolean).join(" ").trim();
  return listingTitle || recordTitle || vehicleRecord?.title || "Unknown vehicle";
}

function buildListingStatus(vehicle: Vehicle, vehicleRecord: VehicleRecord | null) {
  if (vehicle.deleted) return "Archived";
  if (vehicle.sellerStatus === "SOLD" || vehicle.soldAt) return "Sold";
  if (vehicle.sellerStatus === "UNDER_OFFER") return "Under offer";
  if (vehicle.sellerStatus === "PAUSED") return "Paused";
  if (vehicle.sellerStatus === "WITHDRAWN") return "Withdrawn";
  if (vehicle.status !== "approved") return "Pending";
  if (vehicleRecord?.status === "archived") return "Archived";
  return "Active";
}

function buildRevenueMaps(accountingEntries: AdminAccountingEntry[]) {
  const byVehicleId = new Map<string, number>();
  const byVehicleRecordId = new Map<string, number>();

  for (const entry of accountingEntries) {
    if (entry.type !== "income") continue;
    if (entry.relatedVehicleId) {
      byVehicleId.set(entry.relatedVehicleId, (byVehicleId.get(entry.relatedVehicleId) ?? 0) + entry.amount);
    }
    if (entry.relatedVehicleRecordId) {
      byVehicleRecordId.set(entry.relatedVehicleRecordId, (byVehicleRecordId.get(entry.relatedVehicleRecordId) ?? 0) + entry.amount);
    }
  }

  return { byVehicleId, byVehicleRecordId };
}

function resolveWarehouseLifecycle(
  vehicle: Vehicle,
  intakes: WarehouseIntakeRecord[],
  analyticsStartDate: Date,
  today: Date,
  isCurrentActive: boolean
): WarehouseLifecycle {
  const intakeStartCandidates = intakes.map((intake) => (
    parseIsoDate(intake.storageStartDate)
    ?? parseIsoDate(intake.intakeDate)
    ?? parseIsoDate(intake.createdAt)
  ));
  const endCandidates = intakes.map((intake) => parseIsoDate(intake.storageEndDate));
  const warehouseIntakeDate = minDate(intakeStartCandidates);
  const soldDate = parseIsoDate(vehicle.soldAt);
  const knownEndDate = soldDate ?? maxDateFromList(endCandidates);
  const effectiveStartDate = warehouseIntakeDate ? maxDate(warehouseIntakeDate, analyticsStartDate) : analyticsStartDate;
  const hasUnknownHistoricalEnd = !isCurrentActive && !soldDate && !knownEndDate;

  return {
    warehouseIntakeDate,
    warehouseIntakeDateLabel: formatDateInput(warehouseIntakeDate),
    effectiveStartDate,
    knownEndDate,
    soldDate,
    soldDateLabel: formatDateInput(soldDate),
    isCurrentActive,
    hasUnknownHistoricalEnd: hasUnknownHistoricalEnd && Boolean(warehouseIntakeDate && warehouseIntakeDate.getTime() <= today.getTime()),
  };
}

function resolveHistoricalActiveVehicleCount(
  contexts: WarehouseVehicleContext[],
  targetDate: Date
) {
  const unknownHistoricalWindow = contexts.some((context) => {
    const { lifecycle } = context;
    return Boolean(
      lifecycle.hasUnknownHistoricalEnd
      && lifecycle.effectiveStartDate
      && lifecycle.effectiveStartDate.getTime() <= targetDate.getTime()
    );
  });

  if (unknownHistoricalWindow) {
    return null;
  }

  const count = contexts.filter((context) => {
    const { lifecycle } = context;
    if (!lifecycle.effectiveStartDate) return false;
    if (lifecycle.effectiveStartDate.getTime() > targetDate.getTime()) return false;
    if (!lifecycle.knownEndDate) return lifecycle.isCurrentActive;
    return lifecycle.knownEndDate.getTime() >= targetDate.getTime();
  }).length;

  return count > 0 ? count : null;
}

function buildRowTone(daysInStorage: number | null) {
  if (daysInStorage === null) return "default";
  if (daysInStorage > 90) return "critical";
  if (daysInStorage > 60) return "alert";
  if (daysInStorage > 30) return "warning";
  return "default";
}

function compareNullableNumber(left: number | null, right: number | null, direction: "asc" | "desc") {
  const leftValue = left ?? (direction === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
  const rightValue = right ?? (direction === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
  return direction === "asc" ? leftValue - rightValue : rightValue - leftValue;
}

export function sortCurrentWarehouseRows(rows: WarehouseCurrentVehicleRow[], sort: WarehouseVehicleTableSort) {
  return [...rows].sort((left, right) => {
    switch (sort) {
      case "highest_storage_cost":
        return compareNullableNumber(left.totalAccumulatedStorageCost, right.totalAccumulatedStorageCost, "desc");
      case "lowest_storage_cost":
        return compareNullableNumber(left.totalAccumulatedStorageCost, right.totalAccumulatedStorageCost, "asc");
      case "newest_arrival":
        return compareNullableNumber(left.daysInStorage, right.daysInStorage, "asc");
      case "longest_storage":
      default:
        return compareNullableNumber(left.daysInStorage, right.daysInStorage, "desc");
    }
  });
}

export function buildWarehouseAnalyticsReport(
  vehicles: Vehicle[],
  vehicleRecords: VehicleRecord[],
  intakes: WarehouseIntakeRecord[],
  accountingEntries: AdminAccountingEntry[],
  settings: AdminWarehouseAnalyticsSettings,
  today = new Date()
): WarehouseAnalyticsReport {
  const analyticsStartDate = parseIsoDate(settings.analyticsStartDate) ?? new Date("2026-07-01T00:00:00");
  const vehicleRecordsByListingId = new Map(vehicleRecords.filter((record) => record.publicListingId).map((record) => [record.publicListingId as string, record]));
  const intakesByVehicleId = new Map<string, WarehouseIntakeRecord[]>();
  const intakesByVehicleRecordId = new Map<string, WarehouseIntakeRecord[]>();
  const revenueMaps = buildRevenueMaps(accountingEntries);

  for (const intake of intakes) {
    if (intake.vehicleId) {
      intakesByVehicleId.set(intake.vehicleId, [...(intakesByVehicleId.get(intake.vehicleId) ?? []), intake]);
    }
    if (intake.vehicleRecordId) {
      intakesByVehicleRecordId.set(intake.vehicleRecordId, [...(intakesByVehicleRecordId.get(intake.vehicleRecordId) ?? []), intake]);
    }
  }

  const warehouseContexts = vehicles
    .filter((vehicle) => isWarehouseManaged(vehicle))
    .map((vehicle) => {
      const vehicleRecord = vehicleRecordsByListingId.get(vehicle.id)
        ?? (vehicle.id ? vehicleRecords.find((record) => record.publicListingId === vehicle.id) ?? null : null);
      const intakeList = [
        ...(vehicle.id ? intakesByVehicleId.get(vehicle.id) ?? [] : []),
        ...(vehicleRecord?.id ? intakesByVehicleRecordId.get(vehicleRecord.id) ?? [] : []),
      ];
      const dedupedIntakes = Array.from(new Map(intakeList.map((intake) => [intake.id, intake])).values());
      const isCurrentActive = isCurrentWarehouseListing(vehicle, vehicleRecord);
      const lifecycle = resolveWarehouseLifecycle(vehicle, dedupedIntakes, analyticsStartDate, today, isCurrentActive);
      const listingEndDate = vehicle.soldAt || today.toISOString();
      const listedDays = getDaysBetweenIsoDates(getVehicleListedAt(vehicle), listingEndDate);
      const accountingPlatformRevenue = revenueMaps.byVehicleRecordId.get(vehicleRecord?.id ?? "")
        ?? revenueMaps.byVehicleId.get(vehicle.id)
        ?? null;

      return {
        vehicle,
        vehicleRecord: vehicleRecord ?? null,
        intakes: dedupedIntakes,
        lifecycle,
        title: buildVehicleTitle(vehicle, vehicleRecord ?? null),
        reference: vehicle.displayReference || vehicleRecord?.displayReference || vehicle.id,
        rego: vehicle.rego || vehicleRecord?.registrationPlate || "Not available",
        listedDays,
        accountingPlatformRevenue,
        listingStatus: buildListingStatus(vehicle, vehicleRecord ?? null),
      } satisfies WarehouseVehicleContext;
    });

  const currentWarehouseContexts = warehouseContexts.filter((context) => context.lifecycle.isCurrentActive);
  const currentVehicleCount = currentWarehouseContexts.length;
  const currentCostPerVehiclePerDay = currentVehicleCount > 0
    ? settings.warehouseOperatingCostPerDay / currentVehicleCount
    : null;

  const currentVehicles = currentWarehouseContexts.map((context) => {
    const daysInStorage = context.listedDays;
    const totalAccumulatedStorageCost = currentCostPerVehiclePerDay !== null && daysInStorage !== null
      ? currentCostPerVehiclePerDay * daysInStorage
      : null;

    return {
      vehicleId: context.vehicle.id,
      vehicleRecordId: context.vehicleRecord?.id || "",
      title: context.title,
      reference: context.reference,
      rego: context.rego,
      daysInStorage,
      dailyStorageCost: currentCostPerVehiclePerDay,
      totalAccumulatedStorageCost,
      listingStatus: context.listingStatus,
      rowTone: buildRowTone(daysInStorage),
    } satisfies WarehouseCurrentVehicleRow;
  });

  const soldWarehouseContexts = warehouseContexts.filter((context) => Boolean(context.lifecycle.soldDate));
  const soldVehicleRows = soldWarehouseContexts.map((context) => {
    const soldDate = context.lifecycle.soldDate;
    const daysToSell = context.listedDays;
    const historicalActiveCount = soldDate ? resolveHistoricalActiveVehicleCount(warehouseContexts, soldDate) : null;
    const soldCostPerVehiclePerDay = historicalActiveCount
      ? settings.warehouseOperatingCostPerDay / historicalActiveCount
      : currentCostPerVehiclePerDay;
    const totalStorageCost = soldCostPerVehiclePerDay !== null && daysToSell !== null
      ? soldCostPerVehiclePerDay * daysToSell
      : null;
    const platformRevenue = context.accountingPlatformRevenue && context.accountingPlatformRevenue > 0
      ? context.accountingPlatformRevenue
      : null;

    return {
      vehicleId: context.vehicle.id,
      vehicleRecordId: context.vehicleRecord?.id || "",
      title: context.title,
      reference: context.reference,
      rego: context.rego,
      warehouseIntakeDate: context.lifecycle.warehouseIntakeDateLabel,
      soldDate: context.lifecycle.soldDateLabel,
      daysToSell,
      totalStorageCost,
      listingStatus: context.listingStatus,
      platformRevenue,
      estimatedUsingCurrentCost: historicalActiveCount === null,
    } satisfies WarehouseRankingRow;
  });

  const averageStorageDays = currentVehicles.length
    ? currentVehicles.reduce((sum, row) => sum + (row.daysInStorage ?? 0), 0) / currentVehicles.length
    : null;
  const totalAccumulatedStorageCost = currentVehicles.length
    ? currentVehicles.reduce((sum, row) => sum + (row.totalAccumulatedStorageCost ?? 0), 0)
    : null;
  const highestCostVehicle = [...currentVehicles]
    .sort((left, right) => compareNullableNumber(left.totalAccumulatedStorageCost, right.totalAccumulatedStorageCost, "desc"))[0];
  const longestHoldingVehicle = [...currentVehicles]
    .sort((left, right) => compareNullableNumber(left.daysInStorage, right.daysInStorage, "desc"))[0];

  return {
    summary: {
      currentWarehouseVehicles: currentVehicleCount,
      warehouseCapacity: settings.warehouseCapacity,
      occupancyRate: settings.warehouseCapacity > 0 ? currentVehicleCount / settings.warehouseCapacity : null,
      warehouseOperatingCostPerDay: settings.warehouseOperatingCostPerDay,
      currentCostPerVehiclePerDay,
      averageStorageDays,
      totalAccumulatedStorageCost,
      highestCostVehicleLabel: highestCostVehicle ? highestCostVehicle.title : "Not available",
      longestHoldingVehicleLabel: longestHoldingVehicle ? longestHoldingVehicle.title : "Not available",
    },
    currentVehicles: sortCurrentWarehouseRows(currentVehicles, "longest_storage"),
    longestHoldingVehicles: [...currentVehicles].sort((left, right) => compareNullableNumber(left.daysInStorage, right.daysInStorage, "desc")),
    fastestTurnoverVehicles: [...soldVehicleRows].sort((left, right) => compareNullableNumber(left.daysToSell, right.daysToSell, "asc")),
    lowestManagementCostSoldVehicles: [...soldVehicleRows].sort((left, right) => compareNullableNumber(left.totalStorageCost, right.totalStorageCost, "asc")),
  };
}
