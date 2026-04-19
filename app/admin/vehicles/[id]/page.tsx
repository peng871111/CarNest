import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VehicleInsightsPanel } from "@/components/analytics/vehicle-insights-panel";
import { AdminShell } from "@/components/layout/admin-shell";
import { AdminVehicleActions } from "@/components/vehicles/admin-vehicle-actions";
import { AdminPendingDescriptionActions } from "@/components/vehicles/admin-pending-description-actions";
import { VehicleGallery } from "@/components/vehicles/vehicle-gallery";
import { VehicleStatusBadge } from "@/components/vehicles/vehicle-status-badge";
import { getVehicleById, getVehicleOwnerInfo } from "@/lib/data";
import { getListingLabel, getVehicleGallery } from "@/lib/permissions";
import {
  formatAdminDateTime,
  formatCurrency,
  formatLocation,
  formatMonthYear,
  getAccountDisplayReference,
  getVehicleDisplayReference
} from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminVehicleDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vehicle = await getVehicleById(id);

  if (!vehicle) notFound();

  const owner = await getVehicleOwnerInfo(vehicle.ownerUid);

  return (
    <AdminShell
      title="Vehicle Review"
      description="Review the full vehicle submission before approving it for publication, rejecting it, or opening the edit form."
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/admin/vehicles" className="text-sm font-medium text-ink/65 transition hover:text-bronze">
          ← Back to vehicles
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <AdminVehicleActions vehicle={vehicle} redirectBase={`/admin/vehicles/${vehicle.id}`} />
          <Link href={`/admin/vehicles/${vehicle.id}/edit`} className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze">
            Edit
          </Link>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.15fr,0.85fr]">
        <section className="space-y-6">
          <VehicleGallery images={getVehicleGallery(vehicle)} altBase={`${vehicle.make} ${vehicle.model}`} />
          <div className="grid gap-4 rounded-[28px] border border-black/5 bg-white p-6 shadow-panel md:grid-cols-2">
            {[
              ["Vehicle reference", getVehicleDisplayReference(vehicle)],
              ["Price", formatCurrency(vehicle.price)],
              ["Listing type", getListingLabel(vehicle.listingType)],
              ["Approval status", vehicle.status],
              ["Location", formatLocation(vehicle.sellerLocationSuburb, vehicle.sellerLocationPostcode, vehicle.sellerLocationState)],
              ["Seller account", owner?.displayName || "Seller account on file"],
              ["Created at", formatAdminDateTime(vehicle.createdAt)]
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs uppercase tracking-[0.25em] text-ink/45">{label}</p>
                <p className="mt-2 text-base text-ink">{value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
            <h2 className="text-xl font-semibold text-ink">Full description</h2>
            <p className="mt-4 whitespace-pre-wrap text-ink/70">{vehicle.description}</p>
          </div>
          <AdminPendingDescriptionActions vehicle={vehicle} />
          <VehicleInsightsPanel vehicleId={vehicle.id} sellerOwnerUid={vehicle.ownerUid} audience="admin" />
        </section>

        <aside className="space-y-6">
          <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
            <p className="text-xs uppercase tracking-[0.25em] text-bronze">Vehicle summary</p>
            <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-ink/45">
              {getVehicleDisplayReference(vehicle)}
            </p>
            <h1 className="mt-2 font-display text-4xl text-ink">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h1>
            <p className="mt-2 text-lg text-ink/60">{vehicle.variant || "Variant not provided"}</p>
            <div className="mt-5">
              <VehicleStatusBadge status={vehicle.status} />
            </div>
          </div>

          <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
            <p className="text-xs uppercase tracking-[0.25em] text-bronze">Seller account</p>
            <div className="mt-4 space-y-3 text-sm text-ink/70">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Display name</p>
                <p className="mt-1 text-ink">{owner?.displayName || "Not available"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Email</p>
                <p className="mt-1 text-ink">{owner?.email || "Not available"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Member since</p>
                <p className="mt-1 text-ink">{formatMonthYear(owner?.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Seller reference</p>
                <p className="mt-1 text-ink">
                  {getAccountDisplayReference({
                    id: owner?.id || vehicle.ownerUid,
                    accountReference: owner?.accountReference,
                    role: owner?.role || vehicle.ownerRole
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
            <p className="text-xs uppercase tracking-[0.25em] text-bronze">All uploaded images</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {getVehicleGallery(vehicle).map((image, index) => (
                <div key={`${image}-${index}`} className="relative aspect-[4/3] overflow-hidden rounded-[20px] border border-black/5 bg-shell">
                  <Image
                    src={image}
                    alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </AdminShell>
  );
}
