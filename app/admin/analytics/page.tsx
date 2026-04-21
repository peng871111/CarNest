import Link from "next/link";
import { ReactNode } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import {
  getContactMessagesData,
  getDealerApplicationsData,
  getInspectionRequestsData,
  getOffersData,
  getSavedVehiclesCollectionData,
  getUsersData,
  getVehiclesData,
  getVehicleViewEventsData
} from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import { getVehicleDisplayReference } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

function toAverageLabel(total: number, divisor: number) {
  if (!divisor) return "0.0";
  return (total / divisor).toFixed(1);
}

function buildVehicleTitle(year?: number, make?: string, model?: string) {
  const title = [year, make, model].filter(Boolean).join(" ").trim();
  return title || "Unknown listing";
}

function buildRankedListings(
  counts: Map<string, number>,
  vehiclesById: Map<string, Awaited<ReturnType<typeof getVehiclesData>>["items"][number]>,
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

function buildRankedBrands(
  counts: Map<string, number>,
  limit = 5
) {
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

function formatPercentage(numerator: number, denominator: number) {
  if (!denominator) return "0.0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[24px] border border-black/5 bg-white p-5 shadow-panel">
      <p className="text-[11px] uppercase tracking-[0.24em] text-ink/45">{label}</p>
      <p className="mt-3 font-display text-3xl text-ink">{value}</p>
    </div>
  );
}

function CollapsibleSection({
  label,
  description,
  children
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-[28px] border border-black/5 bg-white shadow-panel">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 [&::-webkit-details-marker]:hidden">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-bronze">{label}</p>
          <h2 className="mt-2 font-display text-3xl text-ink">{description}</h2>
        </div>
        <span className="text-2xl text-ink/45 transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="border-t border-black/5 px-6 pb-6 pt-5">{children}</div>
    </details>
  );
}

function CompactMetricCard({
  label,
  value
}: {
  label: string;
  value: string | number;
}) {
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

export default async function AdminAnalyticsPage() {
  const [
    usersResult,
    vehiclesResult,
    dealerApplicationsResult,
    offersResult,
    enquiriesResult,
    savedVehiclesResult,
    inspectionRequestsResult,
    viewEventsResult
  ] = await Promise.all([
    getUsersData(),
    getVehiclesData(),
    getDealerApplicationsData(),
    getOffersData(),
    getContactMessagesData(),
    getSavedVehiclesCollectionData(),
    getInspectionRequestsData(),
    getVehicleViewEventsData()
  ]);

  const users = usersResult.items;
  const vehicles = vehiclesResult.items;
  const dealerApplications = dealerApplicationsResult.items;
  const offers = offersResult.items;
  const enquiries = enquiriesResult.items;
  const savedVehicles = savedVehiclesResult.items;
  const inspectionRequests = inspectionRequestsResult.items;
  const viewEvents = viewEventsResult.items;

  const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const liveListings = vehicles.filter((vehicle) => vehicle.status === "approved" && vehicle.sellerStatus !== "SOLD");
  const soldListings = vehicles.filter((vehicle) => vehicle.sellerStatus === "SOLD");
  const privateAccounts = users.filter((user) => user.role === "seller" || user.role === "buyer");
  const dealerAccounts = users.filter((user) => user.role === "dealer");
  const pendingDealerApplications = dealerApplications.filter((application) => application.status === "pending");

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

  const highestOfferListings = buildRankedListings(offersByVehicle, vehiclesById);
  const highestEnquiryListings = buildRankedListings(inspectionsByVehicle, vehiclesById);
  const highestSaveListings = buildRankedListings(savesByVehicle, vehiclesById);
  const mostViewedBrands = buildRankedBrands(brandViews);
  const mostPopularBrandsByOffers = buildRankedBrands(brandOffers);
  const mostPopularBrandsByEnquiries = buildRankedBrands(brandEnquiries);
  const mostPopularBrandsBySaves = buildRankedBrands(brandSaves);
  const mostPopularPriceRanges = buildRankedBrands(priceRangeSignals);
  const mostPopularBodyTypes = buildRankedBrands(bodyTypeSignals);
  const mostSavedListings = buildRankedListings(savesByVehicle, vehiclesById);
  const mostEnquiredListings = buildRankedListings(inspectionsByVehicle, vehiclesById);
  const liveListingIds = new Set(liveListings.map((vehicle) => vehicle.id));
  const listingsWithOffers = new Set(offers.map((offer) => offer.vehicleId));
  const soldListingsWithOffers = soldListings.filter((vehicle) => listingsWithOffers.has(vehicle.id)).length;
  const totalViewCount = viewEvents.length;
  const totalPageViewsValue = "—";
  const totalVisitorsValue = "—";

  const dataWarnings = [
    usersResult.error,
    vehiclesResult.error,
    dealerApplicationsResult.error,
    offersResult.error,
    enquiriesResult.error,
    savedVehiclesResult.error,
    inspectionRequestsResult.error,
    viewEventsResult.error
  ].filter(Boolean);

  return (
    <AdminShell
      title="Analytics"
      description="A cleaner view of platform activity across users, listings, buyer demand, and outcomes."
    >
      {dataWarnings.length ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Some analytics data could not be read right now, so a few sections may appear lighter than usual.
        </div>
      ) : null}

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

      <CollapsibleSection label="Traffic" description="Traffic and buyer activity">
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CompactMetricCard label="Total traffic" value={totalPageViewsValue} />
          <CompactMetricCard label="Listing views" value={viewEvents.length || "No data yet"} />
          <CompactMetricCard label="Enquiries" value={inspectionRequests.length || "No data yet"} />
          <CompactMetricCard label="Offers" value={offers.length || "No data yet"} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection label="Listing analytics" description="Listing performance">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/65">
              Review the listings drawing the strongest activity and compare how demand is spreading across the live marketplace.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-[20px] bg-shell px-4 py-3 text-sm text-ink/70">
              Average offers per listing: <span className="font-semibold text-ink">{toAverageLabel(offers.length, vehicles.length)}</span>
            </div>
            <div className="rounded-[20px] bg-shell px-4 py-3 text-sm text-ink/70">
              Average enquiries per live listing: <span className="font-semibold text-ink">{toAverageLabel(inspectionRequests.length, liveListings.length)}</span>
            </div>
            <div className="rounded-[20px] bg-shell px-4 py-3 text-sm text-ink/70">
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
      </CollapsibleSection>

      <CollapsibleSection label="User behavior" description="Preference and intent signals">
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
            items={mostSavedListings}
            emptyLabel="Not enough data yet"
            suffix="saves"
          />
          <RankedListingSection
            title="Most enquired listings"
            description="Listings with the most current enquiry-linked action from inspection requests."
            items={mostEnquiredListings}
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
      </CollapsibleSection>

      <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
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
    </AdminShell>
  );
}
