import Link from "next/link";
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

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[24px] border border-black/5 bg-white p-5 shadow-panel">
      <p className="text-[11px] uppercase tracking-[0.24em] text-ink/45">{label}</p>
      <p className="mt-3 font-display text-3xl text-ink">{value}</p>
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
  for (const event of viewEvents) {
    const vehicle = vehiclesById.get(event.vehicleId);
    const brand = vehicle?.make?.trim();
    if (!brand) continue;
    brandViews.set(brand, (brandViews.get(brand) ?? 0) + 1);
  }

  const highestOfferListings = buildRankedListings(offersByVehicle, vehiclesById);
  const highestEnquiryListings = buildRankedListings(inspectionsByVehicle, vehiclesById);
  const highestSaveListings = buildRankedListings(savesByVehicle, vehiclesById);
  const mostViewedBrands = buildRankedBrands(brandViews);
  const mostSavedListings = buildRankedListings(savesByVehicle, vehiclesById);
  const mostEnquiredListings = buildRankedListings(inspectionsByVehicle, vehiclesById);

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
      description="A first live view of platform activity across users, listings, buyer intent, and dealer pipeline signals."
    >
      {dataWarnings.length ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Some analytics collections could not be read right now, so sections with missing data fall back to safe placeholders.
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
      </div>

      <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-bronze">Listing analytics</p>
            <h2 className="mt-2 font-display text-3xl text-ink">How listings are performing</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/65">
              Offer and save counts are direct listing metrics. Enquiry counts currently use inspection requests as the real linked enquiry signal.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-[20px] bg-shell px-4 py-3 text-sm text-ink/70">
              Average offers per listing: <span className="font-semibold text-ink">{toAverageLabel(offers.length, vehicles.length)}</span>
            </div>
            <div className="rounded-[20px] bg-shell px-4 py-3 text-sm text-ink/70">
              Average enquiries per live listing: <span className="font-semibold text-ink">{toAverageLabel(inspectionRequests.length, liveListings.length)}</span>
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

      <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
        <p className="text-xs uppercase tracking-[0.28em] text-bronze">User behavior</p>
        <h2 className="mt-2 font-display text-3xl text-ink">Preference and intent signals</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/65">
          These sections surface the strongest current demand signals from views, saves, and enquiry-linked actions already tracked by CarNest.
        </p>

        <div className="mt-6 grid gap-5 xl:grid-cols-3">
          <RankedSignalSection
            title="Most viewed brands"
            description="Top brands by existing vehicle view event tracking."
            items={mostViewedBrands}
            emptyLabel="Not enough data yet"
            suffix="views"
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
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
          <p className="text-xs uppercase tracking-[0.28em] text-bronze">Traffic</p>
          <h2 className="mt-2 font-display text-3xl text-ink">Website visits</h2>
          <div className="mt-5 rounded-[20px] bg-shell px-4 py-5 text-sm leading-6 text-ink/65">
            Traffic analytics not connected yet.
          </div>
          <div className="mt-3 rounded-[20px] bg-shell px-4 py-5 text-sm leading-6 text-ink/65">
            State-based visit analytics not connected yet.
          </div>
        </div>

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
      </section>
    </AdminShell>
  );
}
