import Link from "next/link";
import { AdminShell } from "@/components/layout/admin-shell";
import { getVehiclesData } from "@/lib/data";
import { getListingLabel } from "@/lib/permissions";
import { formatCurrency, getVehicleDisplayReference, getVehicleLiveTimingLabel } from "@/lib/utils";
import { VehicleStatusBadge } from "@/components/vehicles/vehicle-status-badge";
import { AdminVehicleActions } from "@/components/vehicles/admin-vehicle-actions";

export const dynamic = "force-dynamic";

export default async function AdminVehiclesPage({
  searchParams
}: {
  searchParams?: Promise<{ write?: string; loadedHint?: string; vehicleId?: string; action?: string }>;
}) {
  const { items: vehicles, error } = await getVehiclesData();
  const params = searchParams ? await searchParams : undefined;
  const writeStatus =
    params?.write === "success"
      ? params?.action === "update"
        ? "Vehicle updated successfully"
        : params?.action === "approved"
          ? "Vehicle approved successfully"
          : params?.action === "rejected"
            ? "Vehicle rejected successfully"
        : "Vehicle saved successfully"
      : params?.write === "mock"
        ? params?.action === "update"
          ? "Recent update completed"
          : "Recent save completed"
        : "No recent updates";

  return (
    <AdminShell
      title="Admin Vehicles"
      description="Manage the live `vehicles` collection that powers the public inventory and vehicle detail pages."
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/admin/vehicles/add" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">
          Add vehicle
        </Link>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          Recent activity: {writeStatus}
        </div>
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          Vehicles loaded: {vehicles.length}
        </div>
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          {params?.action === "approved"
            ? "Publication review completed"
            : params?.action === "rejected"
              ? "Review decision recorded"
              : params?.action === "update"
                ? "Latest update saved"
                : params?.write
                  ? "Latest activity recorded"
                  : "No recent updates"}
        </div>
      </div>
      {error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
          Something went wrong. Please try again.
        </div>
      ) : null}

      <section className="overflow-visible rounded-[32px] border border-black/5 bg-white shadow-panel">
        <div className="grid grid-cols-[1.5fr,1fr,1fr,1fr,180px] gap-4 border-b border-black/5 bg-shell px-6 py-4 text-xs uppercase tracking-[0.22em] text-ink/55">
          <span>Vehicle</span>
          <span>Listing</span>
          <span>Status</span>
          <span>Price</span>
          <span>Actions</span>
        </div>
        <div>
          {vehicles.length ? (
            vehicles.map((vehicle) => (
              <div key={vehicle.id} className="grid grid-cols-[1.5fr,1fr,1fr,1fr,180px] gap-4 border-b border-black/5 px-6 py-5 text-sm last:border-b-0">
                <div>
                  <p className="font-semibold text-ink">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink/45">
                    {getVehicleDisplayReference(vehicle)}
                  </p>
                  <p className="mt-1 text-ink/55">{vehicle.description}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink/45">{getVehicleLiveTimingLabel(vehicle)}</p>
                  <Link href={`/admin/vehicles/${vehicle.id}`} className="mt-2 inline-block text-sm font-medium text-ink underline">
                    View details
                  </Link>
                </div>
                <div className="text-ink/70">{getListingLabel(vehicle.listingType)}</div>
                <div>
                  <VehicleStatusBadge status={vehicle.status} />
                </div>
                <div className="text-ink/70">{formatCurrency(vehicle.price)}</div>
                <div className="flex flex-wrap items-center gap-4">
                  <AdminVehicleActions vehicle={vehicle} />
                  <Link href={`/admin/vehicles/${vehicle.id}/edit`} className="font-medium text-ink underline">
                    Edit
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-12 text-sm text-ink/60">
              No vehicles have been added yet. Create one from the admin form to populate both the admin list and public inventory.
            </div>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
