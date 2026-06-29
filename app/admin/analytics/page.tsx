"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import {
  buildWarehouseAnalyticsReport,
  sortCurrentWarehouseRows,
  type WarehouseCurrentVehicleRow,
  type WarehouseRankingRow,
  type WarehouseVehicleTableSort,
} from "@/lib/admin-warehouse-analytics";
import { useAuth } from "@/lib/auth";
import {
  createDefaultAdminWarehouseAnalyticsSettings,
  getAdminAccountingEntriesData,
  getAdminWarehouseAnalyticsSettings,
  getContactMessagesData,
  getDealerApplicationsData,
  getInspectionRequestsData,
  getOffersData,
  getSavedVehiclesCollectionData,
  getUsersData,
  getVehicleRecordsData,
  getVehiclesData,
  getVehicleViewEventsData,
  getWarehouseIntakesData,
  saveAdminWarehouseAnalyticsSettings,
} from "@/lib/data";
import { canAccessRole, hasAdminPermission } from "@/lib/permissions";
import { cn, formatAccountingCurrency, formatCurrency, getVehicleDisplayReference } from "@/lib/utils";
import type {
  AdminWarehouseAnalyticsSettings,
  AppUser,
  ContactMessage,
  DealerApplication,
  InspectionRequest,
  Offer,
  SavedVehicle,
  Vehicle,
  VehicleActor,
  VehicleViewEvent,
  VehicleRecord,
  WarehouseIntakeRecord,
  AdminAccountingEntry,
} from "@/types";

type RankedListing = {
  vehicleId: string;
  title: string;
  count: number;
  reference: string;
};

type RankedBrand = {
  label: string;
  count: number;
};

const CURRENT_VEHICLE_SORT_OPTIONS: Array<{ value: WarehouseVehicleTableSort; label: string }> = [
  { value: "longest_storage", label: "Longest in storage" },
  { value: "highest_storage_cost", label: "Highest storage cost" },
  { value: "lowest_storage_cost", label: "Lowest storage cost" },
  { value: "newest_arrival", label: "Newest arrival" },
  { value: "highest_net_profit", label: "Highest net profit" },
  { value: "lowest_net_profit", label: "Lowest net profit" },
];

function toAverageLabel(total: number, divisor: number) {
  if (!divisor) return "0.0";
  return (total / divisor).toFixed(1);
}

function formatPercentage(numerator: number, denominator: number) {
  if (!denominator) return "0.0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function buildVehicleTitle(year?: number, make?: string, model?: string) {
  const title = [year, make, model].filter(Boolean).join(" ").trim();
  return title || "Unknown listing";
}

function buildRankedListings(
  counts: Map<string, number>,
  vehiclesById: Map<string, Vehicle>,
  limit = 5
) {
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([vehicleId, count]) => {
      const vehicle = vehiclesById.get(vehicleId);
      return {
        vehicleId,
        title: buildVehicleTitle(vehicle?.year, vehicle?.make, vehicle?.model),
        count,
        reference: getVehicleDisplayReference(vehicle ?? vehicleId)
      } satisfies RankedListing;
    });
}

function buildRankedBrands(counts: Map<string, number>, limit = 5) {
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count } satisfies RankedBrand));
}

function incrementMap(map: Map<string, number>, key?: string | null, amount = 1) {
  const normalizedKey = key?.trim();
  if (!normalizedKey) return;
  map.set(normalizedKey, (map.get(normalizedKey) ?? 0) + amount);
}

function buildPriceRangeLabel(price: number) {
  if (price < 25000) return "Under $25k";
  if (price < 50000) return "$25k–$49k";
  if (price < 75000) return "$50k–$74k";
  if (price < 100000) return "$75k–$99k";
  if (price < 150000) return "$100k–$149k";
  if (price < 250000) return "$150k–$249k";
  return "$250k+";
}

function createActorFromUser(user?: AppUser | null): VehicleActor | null {
  if (!user) return null;
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    displayName: user.displayName,
    name: user.name,
    adminPermissions: user.adminPermissions,
  };
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="rounded-[24px] border border-black/5 bg-white p-5 shadow-panel">
      <p className="text-[11px] uppercase tracking-[0.24em] text-ink/45">{label}</p>
      <p className="mt-3 font-display text-3xl text-ink">{value}</p>
      {helper ? <p className="mt-3 text-sm leading-6 text-ink/60">{helper}</p> : null}
    </div>
  );
}

function CollapsibleSection({
  label,
  title,
  description,
  defaultOpen,
  children,
}: {
  label: string;
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <section className="rounded-[28px] border border-black/5 bg-white shadow-panel">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-bronze">{label}</p>
          <h2 className="mt-2 font-display text-3xl text-ink">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/65">{description}</p>
        </div>
        <span className={cn("text-2xl text-ink/45 transition-transform", open ? "rotate-180" : "")}>⌄</span>
      </button>
      {open ? <div className="border-t border-black/5 px-6 pb-6 pt-5">{children}</div> : null}
    </section>
  );
}

function CompactMetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[24px] border border-black/5 bg-white p-5 shadow-panel">
      <p className="text-[11px] uppercase tracking-[0.24em] text-ink/45">{label}</p>
      <p className="mt-3 font-display text-3xl text-ink">{value}</p>
    </div>
  );
}

function FunnelMetricCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-[24px] border border-black/5 bg-white p-5 shadow-panel">
      <p className="text-[11px] uppercase tracking-[0.24em] text-ink/45">{label}</p>
      <p className="mt-3 font-display text-3xl text-ink">{value}</p>
      <p className="mt-3 text-sm leading-6 text-ink/65">{detail}</p>
    </div>
  );
}

function RankedListingSection({
  title,
  description,
  items,
  emptyLabel,
  suffix
}: {
  title: string;
  description: string;
  items: RankedListing[];
  emptyLabel: string;
  suffix: string;
}) {
  return (
    <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.28em] text-bronze">{title}</p>
      <p className="mt-2 text-sm leading-6 text-ink/65">{description}</p>
      <div className="mt-5 space-y-3">
        {items.length ? (
          items.map((item) => (
            <div key={item.vehicleId} className="flex items-center justify-between gap-4 rounded-[20px] bg-shell px-4 py-3">
              <div>
                <p className="font-medium text-ink">{item.title}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink/45">{item.reference}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-ink">{item.count}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-ink/45">{suffix}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[20px] bg-shell px-4 py-5 text-sm text-ink/60">{emptyLabel}</div>
        )}
      </div>
    </section>
  );
}

function RankedSignalSection({
  title,
  description,
  items,
  emptyLabel,
  suffix
}: {
  title: string;
  description: string;
  items: RankedBrand[];
  emptyLabel: string;
  suffix: string;
}) {
  return (
    <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.28em] text-bronze">{title}</p>
      <p className="mt-2 text-sm leading-6 text-ink/65">{description}</p>
      <div className="mt-5 space-y-3">
        {items.length ? (
          items.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-4 rounded-[20px] bg-shell px-4 py-3">
              <p className="font-medium text-ink">{item.label}</p>
              <div className="text-right">
                <p className="font-semibold text-ink">{item.count}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-ink/45">{suffix}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[20px] bg-shell px-4 py-5 text-sm text-ink/60">{emptyLabel}</div>
        )}
      </div>
    </section>
  );
}

function WarehouseTableCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.28em] text-bronze">{title}</p>
      <p className="mt-2 text-sm leading-6 text-ink/65">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function formatMaybeCurrency(value: number | null) {
  return value === null ? "Not available" : formatCurrency(value);
}

function formatMaybeAccountingCurrency(value: number | null) {
  return value === null ? "Not available" : formatAccountingCurrency(value);
}

function formatStorageCost(value: number | null, estimated?: boolean) {
  if (value === null) return "Not available";
  return `${formatAccountingCurrency(value)}${estimated ? " (Estimated)" : ""}`;
}

function rowToneClass(tone: WarehouseCurrentVehicleRow["rowTone"]) {
  if (tone === "warning") return "bg-yellow-50";
  if (tone === "alert") return "bg-orange-50";
  if (tone === "critical") return "bg-red-50";
  return "bg-white";
}

function CurrentVehicleStorageTable({ rows }: { rows: WarehouseCurrentVehicleRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-black/10 text-xs uppercase tracking-[0.18em] text-ink/45">
          <tr>
            <th className="px-4 py-3 font-medium">Vehicle</th>
            <th className="px-4 py-3 font-medium">Rego</th>
            <th className="px-4 py-3 font-medium">Warehouse intake date</th>
            <th className="px-4 py-3 font-medium">Days in storage</th>
            <th className="px-4 py-3 font-medium">Daily storage cost</th>
            <th className="px-4 py-3 font-medium">Total accumulated storage cost</th>
            <th className="px-4 py-3 font-medium">Asking price</th>
            <th className="px-4 py-3 font-medium">Listing status</th>
            <th className="px-4 py-3 font-medium">Estimated platform revenue</th>
            <th className="px-4 py-3 font-medium">Net profit after storage</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr key={row.vehicleId} className={cn("border-b border-black/5 align-top", rowToneClass(row.rowTone))}>
              <td className="px-4 py-4">
                <p className="font-medium text-ink">{row.title}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ink/45">{row.reference}</p>
              </td>
              <td className="px-4 py-4 text-ink/75">{row.rego || "Not available"}</td>
              <td className="px-4 py-4 text-ink/75">{row.warehouseIntakeDate}</td>
              <td className="px-4 py-4 text-ink/75">{row.daysInStorage ?? "Not available"}</td>
              <td className="px-4 py-4 text-ink/75">{formatMaybeAccountingCurrency(row.dailyStorageCost)}</td>
              <td className="px-4 py-4 font-medium text-ink">{formatMaybeAccountingCurrency(row.totalAccumulatedStorageCost)}</td>
              <td className="px-4 py-4 text-ink/75">{formatMaybeCurrency(row.askingPrice)}</td>
              <td className="px-4 py-4 text-ink/75">{row.listingStatus}</td>
              <td className="px-4 py-4 text-ink/75">{formatMaybeCurrency(row.platformRevenue)}</td>
              <td className="px-4 py-4 font-medium text-ink">{formatMaybeAccountingCurrency(row.netProfitAfterStorage)}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={10} className="px-4 py-6 text-sm text-ink/60">No current warehouse vehicles match the active/live criteria.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CurrentHoldingTable({ rows }: { rows: WarehouseCurrentVehicleRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-black/10 text-xs uppercase tracking-[0.18em] text-ink/45">
          <tr>
            <th className="px-4 py-3 font-medium">Vehicle</th>
            <th className="px-4 py-3 font-medium">Days in storage</th>
            <th className="px-4 py-3 font-medium">Total storage cost</th>
            <th className="px-4 py-3 font-medium">Asking price</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr key={row.vehicleId} className="border-b border-black/5">
              <td className="px-4 py-4">
                <p className="font-medium text-ink">{row.title}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ink/45">{row.reference}</p>
              </td>
              <td className="px-4 py-4 text-ink/75">{row.daysInStorage ?? "Not available"}</td>
              <td className="px-4 py-4 font-medium text-ink">{formatMaybeAccountingCurrency(row.totalAccumulatedStorageCost)}</td>
              <td className="px-4 py-4 text-ink/75">{formatMaybeCurrency(row.askingPrice)}</td>
              <td className="px-4 py-4 text-ink/75">{row.listingStatus}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-sm text-ink/60">No active warehouse vehicles available for ranking.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SoldVehicleRankingTable({
  rows,
  includeDates,
}: {
  rows: WarehouseRankingRow[];
  includeDates?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-black/10 text-xs uppercase tracking-[0.18em] text-ink/45">
          <tr>
            <th className="px-4 py-3 font-medium">Vehicle</th>
            {includeDates ? <th className="px-4 py-3 font-medium">Warehouse intake date</th> : null}
            {includeDates ? <th className="px-4 py-3 font-medium">Sold date</th> : null}
            <th className="px-4 py-3 font-medium">Days to sell</th>
            <th className="px-4 py-3 font-medium">Estimated storage cost</th>
            <th className="px-4 py-3 font-medium">Selling price</th>
            <th className="px-4 py-3 font-medium">Platform revenue</th>
            <th className="px-4 py-3 font-medium">Net profit after storage</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr key={row.vehicleId} className="border-b border-black/5">
              <td className="px-4 py-4">
                <p className="font-medium text-ink">{row.title}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ink/45">{row.reference}</p>
              </td>
              {includeDates ? <td className="px-4 py-4 text-ink/75">{row.warehouseIntakeDate}</td> : null}
              {includeDates ? <td className="px-4 py-4 text-ink/75">{row.soldDate}</td> : null}
              <td className="px-4 py-4 text-ink/75">{row.daysToSell ?? "Not available"}</td>
              <td className="px-4 py-4 font-medium text-ink">{formatStorageCost(row.totalStorageCost, row.estimatedUsingCurrentCost)}</td>
              <td className="px-4 py-4 text-ink/75">{formatMaybeCurrency(row.sellingPrice)}</td>
              <td className="px-4 py-4 text-ink/75">{formatMaybeCurrency(row.platformRevenue)}</td>
              <td className="px-4 py-4 font-medium text-ink">{formatMaybeAccountingCurrency(row.netProfitAfterStorage)}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={includeDates ? 8 : 6} className="px-4 py-6 text-sm text-ink/60">No sold warehouse vehicles are available for this ranking yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const { appUser, loading } = useAuth();
  const actor = useMemo(() => createActorFromUser(appUser), [appUser]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleRecords, setVehicleRecords] = useState<VehicleRecord[]>([]);
  const [warehouseIntakes, setWarehouseIntakes] = useState<WarehouseIntakeRecord[]>([]);
  const [accountingEntries, setAccountingEntries] = useState<AdminAccountingEntry[]>([]);
  const [dealerApplications, setDealerApplications] = useState<DealerApplication[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [enquiries, setEnquiries] = useState<ContactMessage[]>([]);
  const [savedVehicles, setSavedVehicles] = useState<SavedVehicle[]>([]);
  const [inspectionRequests, setInspectionRequests] = useState<InspectionRequest[]>([]);
  const [viewEvents, setViewEvents] = useState<VehicleViewEvent[]>([]);
  const [settings, setSettings] = useState<AdminWarehouseAnalyticsSettings>(createDefaultAdminWarehouseAnalyticsSettings());
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [currentVehicleSort, setCurrentVehicleSort] = useState<WarehouseVehicleTableSort>("longest_storage");
  const [dataWarnings, setDataWarnings] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      if (loading || !canAccessRole("admin", appUser?.role)) return;

      const [
        usersResult,
        vehiclesResult,
        vehicleRecordsResult,
        warehouseIntakesResult,
        accountingEntriesResult,
        dealerApplicationsResult,
        offersResult,
        enquiriesResult,
        savedVehiclesResult,
        inspectionRequestsResult,
        viewEventsResult,
        settingsResult
      ] = await Promise.all([
        getUsersData(),
        getVehiclesData(),
        getVehicleRecordsData(),
        getWarehouseIntakesData(),
        getAdminAccountingEntriesData(),
        getDealerApplicationsData(),
        getOffersData(),
        getContactMessagesData(),
        getSavedVehiclesCollectionData(),
        getInspectionRequestsData(),
        getVehicleViewEventsData(),
        getAdminWarehouseAnalyticsSettings()
      ]);

      if (cancelled) return;

      setUsers(usersResult.items);
      setVehicles(vehiclesResult.items);
      setVehicleRecords(vehicleRecordsResult.items);
      setWarehouseIntakes(warehouseIntakesResult.items);
      setAccountingEntries(accountingEntriesResult.items);
      setDealerApplications(dealerApplicationsResult.items);
      setOffers(offersResult.items);
      setEnquiries(enquiriesResult.items);
      setSavedVehicles(savedVehiclesResult.items);
      setInspectionRequests(inspectionRequestsResult.items);
      setViewEvents(viewEventsResult.items);
      setSettings(settingsResult.settings);
      setDataWarnings(
        [
          usersResult.error,
          vehiclesResult.error,
          vehicleRecordsResult.error,
          warehouseIntakesResult.error,
          accountingEntriesResult.error,
          dealerApplicationsResult.error,
          offersResult.error,
          enquiriesResult.error,
          savedVehiclesResult.error,
          inspectionRequestsResult.error,
          viewEventsResult.error,
          settingsResult.error
        ].filter(Boolean) as string[]
      );
    }

    void loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [appUser?.role, loading]);

  const canEditWarehouseSettings = hasAdminPermission(appUser, "manageVehicles");
  const warehouseReport = useMemo(
    () => buildWarehouseAnalyticsReport(vehicles, vehicleRecords, warehouseIntakes, accountingEntries, settings),
    [vehicles, vehicleRecords, warehouseIntakes, accountingEntries, settings]
  );
  const sortedCurrentWarehouseVehicles = useMemo(
    () => sortCurrentWarehouseRows(warehouseReport.currentVehicles, currentVehicleSort),
    [currentVehicleSort, warehouseReport.currentVehicles]
  );

  const vehiclesById = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);
  const liveListings = useMemo(
    () => vehicles.filter((vehicle) => vehicle.status === "approved" && vehicle.sellerStatus !== "SOLD"),
    [vehicles]
  );
  const soldListings = useMemo(
    () => vehicles.filter((vehicle) => vehicle.sellerStatus === "SOLD"),
    [vehicles]
  );
  const privateAccounts = useMemo(
    () => users.filter((user) => user.role === "seller" || user.role === "buyer"),
    [users]
  );
  const dealerAccounts = useMemo(
    () => users.filter((user) => user.role === "dealer"),
    [users]
  );
  const pendingDealerApplications = useMemo(
    () => dealerApplications.filter((application) => application.status === "pending"),
    [dealerApplications]
  );

  const {
    highestOfferListings,
    highestEnquiryListings,
    highestSaveListings,
    mostViewedBrands,
    mostPopularBrandsByOffers,
    mostPopularBrandsByEnquiries,
    mostPopularBrandsBySaves,
    mostPopularPriceRanges,
    mostPopularBodyTypes,
    listingsWithOffers,
    soldListingsWithOffers,
    totalViewCount,
    totalPageViewsValue,
    totalVisitorsValue,
    liveListingIds,
  } = useMemo(() => {
    const offersByVehicle = new Map<string, number>();
    for (const offer of offers) {
      offersByVehicle.set(offer.vehicleId, (offersByVehicle.get(offer.vehicleId) ?? 0) + 1);
    }

    const inspectionsByVehicle = new Map<string, number>();
    for (const inspection of inspectionRequests) {
      inspectionsByVehicle.set(inspection.vehicleId, (inspectionsByVehicle.get(inspection.vehicleId) ?? 0) + 1);
    }

    const savesByVehicle = new Map<string, number>();
    for (const savedVehicle of savedVehicles) {
      savesByVehicle.set(savedVehicle.vehicleId, (savesByVehicle.get(savedVehicle.vehicleId) ?? 0) + 1);
    }

    const brandViews = new Map<string, number>();
    const viewsByVehicle = new Map<string, number>();
    for (const event of viewEvents) {
      incrementMap(viewsByVehicle, event.vehicleId);
      const vehicle = vehiclesById.get(event.vehicleId);
      const brand = vehicle?.make?.trim();
      if (!brand) continue;
      brandViews.set(brand, (brandViews.get(brand) ?? 0) + 1);
    }

    const brandOffers = new Map<string, number>();
    const brandEnquiries = new Map<string, number>();
    const brandSaves = new Map<string, number>();
    const priceRangeSignals = new Map<string, number>();
    const bodyTypeSignals = new Map<string, number>();

    for (const [vehicleId, count] of offersByVehicle.entries()) {
      const vehicle = vehiclesById.get(vehicleId);
      incrementMap(brandOffers, vehicle?.make, count);
      incrementMap(priceRangeSignals, vehicle ? buildPriceRangeLabel(vehicle.price) : "", count);
      incrementMap(bodyTypeSignals, vehicle?.bodyType, count);
    }

    for (const [vehicleId, count] of inspectionsByVehicle.entries()) {
      const vehicle = vehiclesById.get(vehicleId);
      incrementMap(brandEnquiries, vehicle?.make, count);
      incrementMap(priceRangeSignals, vehicle ? buildPriceRangeLabel(vehicle.price) : "", count);
      incrementMap(bodyTypeSignals, vehicle?.bodyType, count);
    }

    for (const [vehicleId, count] of savesByVehicle.entries()) {
      const vehicle = vehiclesById.get(vehicleId);
      incrementMap(brandSaves, vehicle?.make, count);
      incrementMap(priceRangeSignals, vehicle ? buildPriceRangeLabel(vehicle.price) : "", count);
      incrementMap(bodyTypeSignals, vehicle?.bodyType, count);
    }

    const liveListingIds = new Set(liveListings.map((vehicle) => vehicle.id));
    const listingsWithOffers = new Set(offers.map((offer) => offer.vehicleId));

    return {
      highestOfferListings: buildRankedListings(offersByVehicle, vehiclesById),
      highestEnquiryListings: buildRankedListings(inspectionsByVehicle, vehiclesById),
      highestSaveListings: buildRankedListings(savesByVehicle, vehiclesById),
      mostViewedBrands: buildRankedBrands(brandViews),
      mostPopularBrandsByOffers: buildRankedBrands(brandOffers),
      mostPopularBrandsByEnquiries: buildRankedBrands(brandEnquiries),
      mostPopularBrandsBySaves: buildRankedBrands(brandSaves),
      mostPopularPriceRanges: buildRankedBrands(priceRangeSignals),
      mostPopularBodyTypes: buildRankedBrands(bodyTypeSignals),
      listingsWithOffers,
      soldListingsWithOffers: soldListings.filter((vehicle) => listingsWithOffers.has(vehicle.id)).length,
      totalViewCount: viewEvents.length,
      totalPageViewsValue: "—",
      totalVisitorsValue: "—",
      liveListingIds,
    };
  }, [inspectionRequests, liveListings, offers, savedVehicles, soldListings, vehiclesById, viewEvents]);

  async function handleSaveSettings() {
    if (!actor) {
      setSettingsError("Admin session unavailable.");
      return;
    }

    try {
      setSavingSettings(true);
      setSettingsNotice("");
      setSettingsError("");
      const result = await saveAdminWarehouseAnalyticsSettings(settings, actor);
      setSettings(result.settings);
      setSettingsNotice("Warehouse analytics settings saved.");
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Unable to save warehouse analytics settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  if (!canAccessRole("admin", appUser?.role)) {
    return (
      <AdminShell
        title="Analytics"
        description="A cleaner view of platform activity across users, listings, buyer demand, and outcomes."
      >
        <div className="rounded-[24px] border border-black/5 bg-white px-6 py-5 text-sm text-ink/60 shadow-panel">
          You do not have access to this page.
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Analytics"
      description="Operational warehouse economics and existing website traffic metrics in one admin workspace."
    >
      {dataWarnings.length ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Some analytics data could not be read right now, so a few sections may appear lighter than usual.
        </div>
      ) : null}

      <CollapsibleSection
        label="Warehouse Analytics"
        title="Warehouse Vehicle Management Cost Analysis"
        description="Track current warehouse carrying cost, longest-held vehicles, fastest turnover, and sold-vehicle management cost from the configured warehouse baseline."
        defaultOpen
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
          <section className="rounded-[28px] border border-black/5 bg-shell/70 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-bronze">Configuration</p>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              Storage calculations use the warehouse analytics start date of {settings.analyticsStartDate}. If the intake date is earlier, the calculation begins from that exact start date. With today set to 30 June 2026, storage-day metrics remain at zero until 1 July 2026 unless you change the start date.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-[11px] uppercase tracking-[0.18em] text-ink/45">Warehouse operating cost/day</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.warehouseOperatingCostPerDay}
                  onChange={(event) => setSettings((current) => ({ ...current, warehouseOperatingCostPerDay: Number(event.target.value || 0) }))}
                  className="min-h-[46px] w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-bronze"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[11px] uppercase tracking-[0.18em] text-ink/45">Warehouse capacity</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={settings.warehouseCapacity}
                  onChange={(event) => setSettings((current) => ({ ...current, warehouseCapacity: Number(event.target.value || 0) }))}
                  className="min-h-[46px] w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-bronze"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[11px] uppercase tracking-[0.18em] text-ink/45">Warehouse analytics start date</span>
                <input
                  type="date"
                  value={settings.analyticsStartDate}
                  onChange={(event) => setSettings((current) => ({ ...current, analyticsStartDate: event.target.value }))}
                  className="min-h-[46px] w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-bronze"
                />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleSaveSettings()}
                disabled={!canEditWarehouseSettings || savingSettings}
                className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/92 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingSettings ? "Saving..." : "Save warehouse analytics settings"}
              </button>
              {!canEditWarehouseSettings ? (
                <p className="text-sm text-ink/55">You need vehicle-management permission to update these warehouse settings.</p>
              ) : null}
              {settingsNotice ? <p className="text-sm text-emerald-700">{settingsNotice}</p> : null}
              {settingsError ? <p className="text-sm text-red-700">{settingsError}</p> : null}
            </div>
          </section>

          <section className="rounded-[28px] border border-black/5 bg-shell/70 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-bronze">Calculation notes</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-ink/68">
              <p>Current cost per vehicle per day uses only current active warehouse vehicles that are live, unsold, and not archived.</p>
              <p>Sold-vehicle storage cost uses the warehouse operating cost and historical active count when a count can be derived. Otherwise the current cost per vehicle per day is used and marked as Estimated.</p>
              <p>Missing intake or revenue fields remain visible as “Not available” rather than breaking the analytics view.</p>
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          <SummaryCard label="Current warehouse vehicles" value={warehouseReport.summary.currentWarehouseVehicles} />
          <SummaryCard label="Warehouse capacity" value={warehouseReport.summary.warehouseCapacity} />
          <SummaryCard label="Occupancy %" value={warehouseReport.summary.occupancyRate === null ? "Not available" : `${(warehouseReport.summary.occupancyRate * 100).toFixed(1)}%`} />
          <SummaryCard label="Warehouse operating cost/day" value={formatCurrency(warehouseReport.summary.warehouseOperatingCostPerDay)} />
          <SummaryCard label="Current cost per vehicle/day" value={warehouseReport.summary.currentCostPerVehiclePerDay === null ? "Not available" : formatAccountingCurrency(warehouseReport.summary.currentCostPerVehiclePerDay)} />
          <SummaryCard label="Average storage days" value={warehouseReport.summary.averageStorageDays === null ? "Not available" : warehouseReport.summary.averageStorageDays.toFixed(1)} />
          <SummaryCard label="Total accumulated storage cost" value={warehouseReport.summary.totalAccumulatedStorageCost === null ? "Not available" : formatAccountingCurrency(warehouseReport.summary.totalAccumulatedStorageCost)} />
          <SummaryCard label="Highest cost vehicle" value={warehouseReport.summary.highestCostVehicleLabel} />
          <SummaryCard label="Longest holding vehicle" value={warehouseReport.summary.longestHoldingVehicleLabel} />
        </div>

        <WarehouseTableCard
          title="Vehicle Storage Cost Table"
          description="Current active warehouse vehicles only. Storage days start from the later of the warehouse intake date and the configured analytics start date."
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink/60">Default sorting: longest days in storage first. Row colour flags: 30+ days yellow, 60+ orange, 90+ red.</p>
            <label className="flex items-center gap-3 text-sm text-ink/65">
              <span>Sort by</span>
              <select
                value={currentVehicleSort}
                onChange={(event) => setCurrentVehicleSort(event.target.value as WarehouseVehicleTableSort)}
                className="min-h-[42px] rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-ink outline-none transition focus:border-bronze"
              >
                {CURRENT_VEHICLE_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
          <CurrentVehicleStorageTable rows={sortedCurrentWarehouseVehicles} />
        </WarehouseTableCard>

        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          <WarehouseTableCard
            title="Longest Holding Vehicles"
            description="Current active warehouse vehicles ranked by storage days descending."
          >
            <CurrentHoldingTable rows={warehouseReport.longestHoldingVehicles} />
          </WarehouseTableCard>

          <WarehouseTableCard
            title="Fastest Turnover Vehicles"
            description="Sold warehouse vehicles ranked by days to sell ascending."
          >
            <SoldVehicleRankingTable rows={warehouseReport.fastestTurnoverVehicles} includeDates />
          </WarehouseTableCard>
        </div>

        <div className="mt-6">
          <WarehouseTableCard
            title="Lowest Management Cost Sold Vehicles"
            description="Sold warehouse vehicles ranked by estimated storage cost ascending."
          >
            <SoldVehicleRankingTable rows={warehouseReport.lowestManagementCostSoldVehicles} />
          </WarehouseTableCard>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        label="Traffic"
        title="Website Traffic Analytics"
        description="Existing platform metrics, buyer activity, and listing performance reporting."
        defaultOpen={false}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          <SummaryCard label="Total users" value={users.length} />
          <SummaryCard label="Total private accounts" value={privateAccounts.length} />
          <SummaryCard label="Total dealer accounts" value={dealerAccounts.length} />
          <SummaryCard label="Total live listings" value={liveListings.length} />
          <SummaryCard label="Total sold listings" value={soldListings.length} />
          <SummaryCard label="Pending dealer applications" value={pendingDealerApplications.length} />
          <SummaryCard label="Total offers" value={offers.length} />
          <SummaryCard label="Total enquiries" value={enquiries.length} />
          <SummaryCard label="Total saved vehicles" value={savedVehicles.length} />
          <SummaryCard label="Total page views" value={totalPageViewsValue} />
          <SummaryCard label="Total visitors" value={totalVisitorsValue} />
        </div>

        <div className="mt-6 space-y-6">
          <section className="rounded-[28px] border border-black/5 bg-shell/70 p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-bronze">Traffic and buyer activity</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <CompactMetricCard label="Total traffic" value={totalPageViewsValue} />
              <CompactMetricCard label="Listing views" value={viewEvents.length || "No data yet"} />
              <CompactMetricCard label="Enquiries" value={inspectionRequests.length || "No data yet"} />
              <CompactMetricCard label="Offers" value={offers.length || "No data yet"} />
            </div>
          </section>

          <section className="rounded-[28px] border border-black/5 bg-shell/70 p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-bronze">Listing analytics</p>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/65">
                Review the listings drawing the strongest activity and compare how demand is spreading across the live marketplace.
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="rounded-[20px] bg-white px-4 py-3 text-sm text-ink/70">
                  Average offers per listing: <span className="font-semibold text-ink">{toAverageLabel(offers.length, vehicles.length)}</span>
                </div>
                <div className="rounded-[20px] bg-white px-4 py-3 text-sm text-ink/70">
                  Average enquiries per live listing: <span className="font-semibold text-ink">{toAverageLabel(inspectionRequests.length, liveListings.length)}</span>
                </div>
                <div className="rounded-[20px] bg-white px-4 py-3 text-sm text-ink/70">
                  Average saves per live listing: <span className="font-semibold text-ink">{toAverageLabel(savedVehicles.filter((item) => liveListingIds.has(item.vehicleId)).length, liveListings.length)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-3">
              <RankedListingSection
                title="Highest offer count"
                description="Listings currently drawing the most direct offer activity."
                items={highestOfferListings}
                emptyLabel="Not enough data yet"
                suffix="offers"
              />
              <RankedListingSection
                title="Highest enquiry count"
                description="Listings with the most linked buyer enquiry activity from inspection requests."
                items={highestEnquiryListings}
                emptyLabel="Not enough data yet"
                suffix="enquiries"
              />
              <RankedListingSection
                title="Highest save count"
                description="Listings buyers are keeping on watchlists most often."
                items={highestSaveListings}
                emptyLabel="Not enough data yet"
                suffix="saves"
              />
            </div>
          </section>

          <section className="rounded-[28px] border border-black/5 bg-shell/70 p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-bronze">User behavior</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/65">
              Surface the strongest demand signals from views, saves, enquiries, and offer activity already captured across the platform.
            </p>

            <div className="mt-6 grid gap-5 xl:grid-cols-3">
              <RankedSignalSection
                title="Most viewed brands"
                description="Top brands by existing vehicle view event tracking."
                items={mostViewedBrands}
                emptyLabel="Not enough data yet"
                suffix="views"
              />
              <RankedSignalSection
                title="Popular brands by offers"
                description="Brands generating the most direct offer activity."
                items={mostPopularBrandsByOffers}
                emptyLabel="Not enough data yet"
                suffix="offers"
              />
              <RankedSignalSection
                title="Popular brands by enquiries"
                description="Brands drawing the most enquiry-linked inspection activity."
                items={mostPopularBrandsByEnquiries}
                emptyLabel="Not enough data yet"
                suffix="enquiries"
              />
              <RankedSignalSection
                title="Popular brands by saves"
                description="Brands buyers are saving most often."
                items={mostPopularBrandsBySaves}
                emptyLabel="Not enough data yet"
                suffix="saves"
              />
              <RankedListingSection
                title="Most saved listings"
                description="Listings with the strongest save intent across the platform."
                items={highestSaveListings}
                emptyLabel="Not enough data yet"
                suffix="saves"
              />
              <RankedListingSection
                title="Most enquired listings"
                description="Listings with the most current enquiry-linked action from inspection requests."
                items={highestEnquiryListings}
                emptyLabel="Not enough data yet"
                suffix="enquiries"
              />
              <RankedSignalSection
                title="Popular price ranges"
                description="Combined buyer-intent demand bands across offers, enquiry-linked actions, and saves."
                items={mostPopularPriceRanges}
                emptyLabel="Not enough data yet"
                suffix="signals"
              />
              <RankedSignalSection
                title="Popular body types"
                description="Body types attracting the strongest combined demand signals where listing metadata exists."
                items={mostPopularBodyTypes}
                emptyLabel="Not enough data yet"
                suffix="signals"
              />
            </div>
          </section>

          <section className="rounded-[28px] border border-black/5 bg-shell/70 p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-bronze">Conversion funnel</p>
            <h2 className="mt-2 font-display text-3xl text-ink">From interest to outcome</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/65">
              These ratios use tracked listing views where available, plus direct offer and sold outcomes already stored in CarNest.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FunnelMetricCard
                label="Views to saves"
                value={totalViewCount ? formatPercentage(savedVehicles.length, totalViewCount) : "No data yet"}
                detail={
                  totalViewCount
                    ? `${savedVehicles.length} saved vehicle actions from ${totalViewCount} tracked listing views.`
                    : "View-to-save conversion will appear here once more traffic data is available."
                }
              />
              <FunnelMetricCard
                label="Views to enquiries"
                value={totalViewCount ? formatPercentage(inspectionRequests.length, totalViewCount) : "No data yet"}
                detail={
                  totalViewCount
                    ? `${inspectionRequests.length} linked enquiry actions from ${totalViewCount} tracked listing views.`
                    : "View-to-enquiry conversion will appear here once more traffic data is available."
                }
              />
              <FunnelMetricCard
                label="Views to offers"
                value={totalViewCount ? formatPercentage(offers.length, totalViewCount) : "No data yet"}
                detail={
                  totalViewCount
                    ? `${offers.length} offers created from ${totalViewCount} tracked listing views.`
                    : "View-to-offer conversion will appear here once more traffic data is available."
                }
              />
              <FunnelMetricCard
                label="Offers to sold"
                value={formatPercentage(soldListingsWithOffers, listingsWithOffers.size)}
                detail={`${soldListingsWithOffers} sold listings had prior offer activity across ${listingsWithOffers.size} listings that received offers.`}
              />
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
              <p className="text-xs uppercase tracking-[0.28em] text-bronze">Quick links</p>
              <h2 className="mt-2 font-display text-3xl text-ink">Follow-up actions</h2>
              <div className="mt-5 space-y-3">
                <Link href="/admin/vehicles" className="flex items-center justify-between rounded-[20px] bg-shell px-4 py-4 text-sm font-medium text-ink">
                  <span>Review live and pending listings</span>
                  <span>{liveListings.length} live</span>
                </Link>
                <Link href="/admin/dealer-applications" className="flex items-center justify-between rounded-[20px] bg-shell px-4 py-4 text-sm font-medium text-ink">
                  <span>Review dealer applications</span>
                  <span>{pendingDealerApplications.length} pending</span>
                </Link>
                <Link href="/admin/offers" className="flex items-center justify-between rounded-[20px] bg-shell px-4 py-4 text-sm font-medium text-ink">
                  <span>Inspect offer activity</span>
                  <span>{offers.length} offers</span>
                </Link>
                <div className="rounded-[20px] bg-shell px-4 py-4 text-sm text-ink/65">
                  Total gross listing value currently loaded:{" "}
                  <span className="font-semibold text-ink">{formatCurrency(vehicles.reduce((total, vehicle) => total + vehicle.price, 0))}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
              <p className="text-xs uppercase tracking-[0.28em] text-bronze">Traffic dashboard</p>
              <h2 className="mt-2 font-display text-3xl text-ink">Open traffic reporting</h2>
              <div className="mt-5 rounded-[20px] bg-shell px-4 py-5 text-sm leading-6 text-ink/65">
                Open the connected traffic dashboard for route and visitor reporting.
              </div>
              <Link
                href={process.env.VERCEL_ANALYTICS_DASHBOARD_URL?.trim() || "https://vercel.com/docs/analytics"}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-shell"
              >
                Open traffic dashboard
              </Link>
            </div>
          </section>
        </div>
      </CollapsibleSection>
    </AdminShell>
  );
}
