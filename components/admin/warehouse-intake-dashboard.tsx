"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getVehiclesData, getWarehouseIntakesData } from "@/lib/data";
import { hasAdminPermission } from "@/lib/permissions";
import { getVehicleImage } from "@/lib/permissions";
import { formatCurrency, formatAdminDateTime, getVehicleDisplayReference } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Vehicle, WarehouseIntakeRecord } from "@/types";
import { PublicVehicleImage } from "@/components/vehicles/public-vehicle-image";

function getIntakeStatusLabel(intake: WarehouseIntakeRecord) {
  if (intake.status === "signed") return "Signed";
  if (intake.status === "review_ready") return "Ready for agreement";
  return "Draft";
}

export function WarehouseIntakeDashboard() {
  const { appUser } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [intakes, setIntakes] = useState<WarehouseIntakeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [vehiclesResult, intakesResult] = await Promise.all([getVehiclesData(), getWarehouseIntakesData()]);
      if (cancelled) return;
      setVehicles(vehiclesResult.items);
      setIntakes(intakesResult.items);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hasAdminPermission(appUser, "manageVehicles")) {
    return (
      <div className="rounded-[28px] border border-black/5 bg-white p-8 shadow-panel">
        <p className="text-sm text-ink/60">You need vehicle-management permission to use the warehouse intake workspace.</p>
      </div>
    );
  }

  const recentVehicles = vehicles.slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-bronze">iPad workflow</p>
          <h2 className="mt-2 font-display text-3xl text-ink">Warehouse Intake & Storage</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">
            Capture owner details, declarations, condition reports, signatures, PDFs, and customer emails for vehicles receiving CarNest warehouse assistance.
          </p>
        </div>
        <Link
          href="/admin/warehouse-intake/new"
          className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/92"
        >
          Start standalone intake
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-bronze">Select existing listing</p>
              <h3 className="mt-2 text-xl font-semibold text-ink">Start from a CarNest listing</h3>
            </div>
            <p className="text-sm text-ink/55">{vehicles.length} listings available</p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {recentVehicles.map((vehicle) => (
              <div key={vehicle.id} className="overflow-hidden rounded-[24px] border border-black/5 bg-shell">
                <div className="relative aspect-[16/10]">
                  <PublicVehicleImage
                    src={getVehicleImage(vehicle)}
                    alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                    loading="lazy"
                    sizes="(max-width: 767px) 100vw, 40vw"
                    className="object-cover object-center"
                  />
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-bronze">{getVehicleDisplayReference(vehicle)}</p>
                    <h4 className="mt-1 text-base font-semibold text-ink">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </h4>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm text-ink/62">
                    <span>{formatCurrency(vehicle.price)}</span>
                    <span>{vehicle.mileage.toLocaleString()} km</span>
                  </div>
                  <div className="flex gap-3">
                    <Link
                      href={`/admin/warehouse-intake/new?vehicleId=${vehicle.id}`}
                      className="flex-1 rounded-full bg-ink px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-ink/92"
                    >
                      Start intake
                    </Link>
                    <Link
                      href={`/admin/vehicles/${vehicle.id}`}
                      className="rounded-full border border-black/10 px-4 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
                    >
                      View listing
                    </Link>
                  </div>
                </div>
              </div>
            ))}
            {!recentVehicles.length && !loading ? (
              <div className="rounded-[24px] border border-dashed border-black/10 bg-shell px-5 py-8 text-sm leading-6 text-ink/60">
                No listings are ready yet. You can still start a standalone intake and attach it later.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-bronze">Existing records</p>
              <h3 className="mt-2 text-xl font-semibold text-ink">Recent intake records</h3>
            </div>
            <p className="text-sm text-ink/55">{intakes.length} records</p>
          </div>
          <div className="mt-5 space-y-3">
            {intakes.slice(0, 10).map((intake) => (
              <Link
                key={intake.id}
                href={`/admin/warehouse-intake/${intake.id}`}
                className="block rounded-[22px] border border-black/6 bg-shell px-4 py-4 transition hover:border-[#C6A87D]/35 hover:bg-white"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-bronze">{intake.vehicleReference || intake.id}</p>
                    <h4 className="mt-1 text-sm font-semibold text-ink">{intake.vehicleTitle || "Standalone intake record"}</h4>
                    <p className="mt-1 text-sm text-ink/58">{intake.ownerDetails.fullName || intake.ownerDetails.email || "Owner details pending"}</p>
                  </div>
                  <div className="text-right text-xs text-ink/55">
                    <p className="font-semibold text-ink">{getIntakeStatusLabel(intake)}</p>
                    <p className="mt-1">{formatAdminDateTime(intake.updatedAt || intake.createdAt)}</p>
                  </div>
                </div>
              </Link>
            ))}
            {!intakes.length && !loading ? (
              <div className="rounded-[24px] border border-dashed border-black/10 bg-shell px-5 py-8 text-sm leading-6 text-ink/60">
                Completed and in-progress warehouse intakes will appear here for quick access.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
