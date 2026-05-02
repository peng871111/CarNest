import Link from "next/link";
import { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import ReactDOM from "react-dom";
import { getSellerTrustInfo, getVehicleById, listPublishedVehicles } from "@/lib/data";
import { formatCalendarDate, formatCurrency, formatMonthYear, getVehicleDisplayReference } from "@/lib/utils";
import { getListingLabel, getVehicleDetailImage, getVehicleGallery, getVehicleGalleryThumbnails } from "@/lib/permissions";
import { buildAbsoluteUrl, getVehicleSeoDescription, getVehicleSeoTitle } from "@/lib/seo";
import { VehicleViewTracker } from "@/components/analytics/vehicle-view-tracker";
import { ListingBadge } from "@/components/vehicles/listing-badge";
import { ListingSummary } from "@/components/vehicles/listing-summary";
import { FinanceCalculator } from "@/components/vehicles/finance-calculator";
import { SellerVehicleStatusBadge } from "@/components/vehicles/seller-vehicle-status-badge";
import { VehicleGallery } from "@/components/vehicles/vehicle-gallery";
import { SaveVehicleButton } from "@/components/vehicles/save-vehicle-button";
import { TakeActionPanel } from "@/components/vehicles/take-action-panel";
import { VehicleCard } from "@/components/vehicles/vehicle-card";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;

  try {
    const vehicle = await getVehicleById(id);
    if (!vehicle || vehicle.deleted) {
      return {
        title: "Vehicle for sale",
        description: "Browse vehicle details, images, and next steps on CarNest.",
        robots: {
          index: false,
          follow: false
        }
      };
    }

    return {
      title: {
        absolute: getVehicleSeoTitle(vehicle)
      },
      description: getVehicleSeoDescription(vehicle),
      alternates: {
        canonical: `/inventory/${vehicle.id}`
      },
      openGraph: {
        title: getVehicleSeoTitle(vehicle),
        description: getVehicleSeoDescription(vehicle),
        url: buildAbsoluteUrl(`/inventory/${vehicle.id}`),
        type: "website",
        images: [
          {
            url: getVehicleDetailImage(vehicle),
            alt: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.variant} exterior photo on CarNest`.replace(/\s+/g, " ").trim()
          }
        ]
      },
      twitter: {
        card: "summary_large_image",
        title: getVehicleSeoTitle(vehicle),
        description: getVehicleSeoDescription(vehicle),
        images: [getVehicleDetailImage(vehicle)]
      }
    };
  } catch {
    return {
      title: "Vehicle for sale",
      description: "Browse vehicle details, images, and next steps on CarNest."
    };
  }
}

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let vehicle = null;
  let headerStore: Awaited<ReturnType<typeof headers>> | null = null;

  try {
    vehicle = await getVehicleById(id);
    headerStore = await headers();
  } catch {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
          <Link href="/inventory" className="inline-flex text-sm font-medium text-ink/55 transition hover:text-bronze">
            ← Back to inventory
          </Link>
          <h1 className="mt-6 font-display text-4xl text-ink">Live data is temporarily unavailable</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
            We’re having trouble loading live data right now. Please check your connection and try again.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/inventory/${id}`} className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
              Retry
            </Link>
            <Link
              href="/inventory"
              className="rounded-full border border-black/10 px-6 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
            >
              Browse inventory
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!vehicle || vehicle.deleted || vehicle.status !== "approved" || (vehicle.sellerStatus !== "ACTIVE" && vehicle.sellerStatus !== "UNDER_OFFER")) notFound();

  const sellerTrust = await getSellerTrustInfo(vehicle.ownerUid);
  const vehicleImages = getVehicleGallery(vehicle);
  const vehicleThumbnails = getVehicleGalleryThumbnails(vehicle);
  const primaryImage = vehicleImages[0];
  if (primaryImage) {
    ReactDOM.preload(primaryImage, { as: "image" });
  }
  const isCarnestManaged = Boolean(vehicle.isManagedByCarnest);
  const { vehicles: publishedVehicles } = await listPublishedVehicles();
  const moreVehicles = publishedVehicles
    .filter((candidate) => candidate.id !== vehicle.id)
    .sort((left, right) => {
      const leftScore = Number(left.make === vehicle.make) + Number(left.bodyType === vehicle.bodyType);
      const rightScore = Number(right.make === vehicle.make) + Number(right.bodyType === vehicle.bodyType);
      return rightScore - leftScore;
    })
    .slice(0, 3);
  const trustSignals =
    vehicle.listingType === "warehouse"
      ? ["Stored at CarNest warehouse", "Inspection available", "Better presented vehicle"]
      : ["Private seller", "Seller-managed vehicle"];
  const locationSummary = vehicle.sellerLocationSuburb || vehicle.sellerLocationState || "Australia";
  const summaryFields = [
    ["Current listing mode", getListingLabel(vehicle.listingType)],
    ["Year", String(vehicle.year)],
    ["Make", vehicle.make],
    ["Model", vehicle.model],
    ["Price", formatCurrency(vehicle.price)],
    ["Mileage", `${vehicle.mileage.toLocaleString()} km`]
  ];
  const listingDetails = [
    ["Transmission", vehicle.transmission],
    ["Fuel type", vehicle.fuelType],
    ["Drivetrain", vehicle.drivetrain],
    ["Body type", vehicle.bodyType],
    ["Colour", vehicle.colour],
    ["Service history", vehicle.serviceHistory],
    ["Keys", vehicle.keyCount],
    ["Rego expiry", vehicle.regoExpiry ? formatCalendarDate(vehicle.regoExpiry) : ""],
    ["Seller suburb", vehicle.sellerLocationSuburb ?? ""],
    ["Postcode", vehicle.sellerLocationPostcode ?? ""],
    ["Seller state", vehicle.sellerLocationState ?? ""],
    ["Vehicle ID", getVehicleDisplayReference(vehicle)]
  ].filter(([, value]) => Boolean(value));
  const publicLocation = vehicle.sellerLocationSuburb || vehicle.sellerLocationState || "";
  const vehicleStructuredData = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: [vehicle.year, vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(" "),
    brand: {
      "@type": "Brand",
      name: vehicle.make
    },
    model: vehicle.model,
    vehicleModelDate: String(vehicle.year),
    mileageFromOdometer: {
      "@type": "QuantitativeValue",
      value: vehicle.mileage,
      unitCode: "KMT"
    },
    fuelType: vehicle.fuelType,
    vehicleTransmission: vehicle.transmission,
    color: vehicle.colour,
    bodyType: vehicle.bodyType,
    image: vehicleImages,
    url: buildAbsoluteUrl(`/inventory/${vehicle.id}`),
    description: getVehicleSeoDescription(vehicle),
    ...(publicLocation ? { areaServed: publicLocation } : {}),
    offers: {
      "@type": "Offer",
      price: vehicle.price,
      priceCurrency: "AUD",
      availability: vehicle.sellerStatus === "UNDER_OFFER" ? "https://schema.org/LimitedAvailability" : "https://schema.org/InStock",
      url: buildAbsoluteUrl(`/inventory/${vehicle.id}`)
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(vehicleStructuredData) }}
      />
      <VehicleViewTracker
        vehicleId={vehicle.id}
        sellerOwnerUid={vehicle.ownerUid}
        listingType={vehicle.listingType}
        country={headerStore?.get("x-vercel-ip-country") ?? ""}
        state={headerStore?.get("x-vercel-ip-country-region") ?? ""}
        city={headerStore?.get("x-vercel-ip-city") ?? ""}
      />
      <div className="grid gap-10 lg:grid-cols-[1.2fr,0.8fr]">
        <section className="space-y-6">
          <Link href="/inventory" className="inline-flex text-sm font-medium text-ink/55 transition hover:text-bronze">
            ← Back to inventory
          </Link>
          <VehicleGallery
            images={vehicleImages}
            thumbnails={vehicleThumbnails}
            altBase={`${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.variant}`.replace(/\s+/g, " ").trim()}
            showMainImageArrows
          />
          <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {summaryFields.map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs uppercase tracking-[0.25em] text-ink/45">{label}</p>
                  <p className="mt-2 text-base text-ink">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
            <p className="text-xs uppercase tracking-[0.25em] text-bronze">Listing details</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {listingDetails.map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs uppercase tracking-[0.22em] text-ink/45">{label}</p>
                  <p className="mt-2 text-sm text-ink">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
            <p className="text-xs uppercase tracking-[0.25em] text-bronze">Seller and management status</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {vehicle.sellerStatus === "UNDER_OFFER" ? <SellerVehicleStatusBadge status={vehicle.sellerStatus} /> : null}
              <span className="rounded-full border border-black/10 bg-shell px-3 py-2 text-xs font-medium text-ink/72">
                {vehicle.listingType === "warehouse" ? "Warehouse managed" : "Private seller-managed"}
              </span>
              {trustSignals.map((signal) => (
                <span
                  key={signal}
                  className="rounded-full border border-black/10 bg-shell px-3 py-2 text-xs font-medium text-ink/72"
                >
                  {signal}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
            <h2 className="text-xl font-semibold text-ink">Description</h2>
            <p className="mt-4 text-ink/70">{vehicle.description}</p>
          </div>
          {isCarnestManaged ? (
            <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
              <p className="text-xs uppercase tracking-[0.25em] text-bronze">Management Status</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">CarNest Managed Vehicle</h2>
              <p className="mt-5 text-sm leading-6 text-ink/65">
                This vehicle is managed through CarNest&apos;s vehicle presentation and enquiry workflow.
              </p>
            </div>
          ) : (
            <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
              <p className="text-xs uppercase tracking-[0.25em] text-bronze">Seller trust</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Seller information</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Seller type</p>
                  <p className="mt-2 text-base text-ink">{sellerTrust.sellerType}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Member since</p>
                  <p className="mt-2 text-base text-ink">{formatMonthYear(sellerTrust.memberSince)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Vehicles sold through CarNest</p>
                  <p className="mt-2 text-base text-ink">{sellerTrust.vehiclesSoldCount}</p>
                </div>
              </div>
              <p className="mt-5 text-sm leading-6 text-ink/65">
                Seller contact details stay private. Communication and inspection coordination remain managed through the platform workflow in {locationSummary}.
              </p>
            </div>
          )}
        </section>
        <aside className="space-y-6">
          <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
            <div className="flex flex-wrap gap-2">
              <ListingBadge vehicle={vehicle} />
              {vehicle.sellerStatus === "UNDER_OFFER" ? <SellerVehicleStatusBadge status={vehicle.sellerStatus} /> : null}
            </div>
            <h1 className="mt-2 font-display text-4xl text-ink">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h1>
            <p className="mt-2 text-lg text-ink/60">{vehicle.variant}</p>
            <p className="mt-3 text-sm leading-6 text-ink/52">
              Private sale — CarNest helps organise inspections and enquiries
              <br />
              You deal directly with the owner if you proceed
            </p>
            <div className="mt-6">
              <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Asking price</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{formatCurrency(vehicle.price)}</p>
            </div>
            <div className="mt-6">
              <ListingSummary vehicle={vehicle} />
            </div>
          </div>
          <SaveVehicleButton vehicleId={vehicle.id} />
          <TakeActionPanel vehicle={vehicle} />
          <p className="px-2 text-xs leading-5 text-ink/50">
            No pressure — we simply help arrange the viewing
          </p>
          <FinanceCalculator defaultVehiclePrice={vehicle.price} />
        </aside>
      </div>

      <section className="mt-16 rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
        <p className="text-xs uppercase tracking-[0.25em] text-bronze">Why CarNest?</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            "Private sale — no dealer involvement",
            "We help organise inspections to save your time",
            "All offers go directly to the owner",
            "No hidden fees"
          ].map((item) => (
            <p key={item} className="text-sm leading-6 text-ink/72">
              <span className="mr-2 text-ink/72">✔</span>
              {item}
            </p>
          ))}
        </div>
      </section>

      {moreVehicles.length ? (
        <section className="mt-16">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-bronze">More vehicles to explore</p>
              <h2 className="mt-2 text-3xl font-semibold text-ink">Continue browsing similar cars</h2>
            </div>
            <Link href="/inventory" className="text-sm font-medium text-ink/65 transition hover:text-bronze">
              Browse all vehicles
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {moreVehicles.map((candidate) => (
              <VehicleCard key={candidate.id} vehicle={candidate} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
