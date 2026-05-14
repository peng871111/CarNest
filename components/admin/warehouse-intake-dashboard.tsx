"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
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

function isWarehouseIntakePermissionError(message?: string) {
  const normalized = (message ?? "").toLowerCase();
  return normalized.includes("missing or insufficient permissions")
    || normalized.includes("permission-denied")
    || normalized.includes("unauthenticated");
}

function SectionCard({
  title,
  eyebrow,
  summary,
  open,
  onToggle,
  children
}: {
  title: string;
  eyebrow: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-black/5 bg-white p-4 shadow-panel md:rounded-[28px] md:p-6">
      <button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-4 text-left">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-bronze md:text-xs">{eyebrow}</p>
          <h3 className="mt-2 text-lg font-semibold text-ink md:text-xl">{title}</h3>
          {summary ? <p className="mt-1 text-sm text-ink/58">{summary}</p> : null}
        </div>
        <span className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/8 bg-shell text-ink/68">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}>
            <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open ? <div className="mt-4 md:mt-5">{children}</div> : null}
    </section>
  );
}

export function WarehouseIntakeDashboard() {
  const { appUser, firebaseUser, loading: authLoading } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [intakes, setIntakes] = useState<WarehouseIntakeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [sectionState, setSectionState] = useState({
    listings: false,
    recent: true
  });
  const canManageVehicles = hasAdminPermission(appUser, "manageVehicles");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (authLoading) return;
      if (!canManageVehicles) {
        setLoading(false);
        return;
      }
      if (!firebaseUser) {
        setLoading(false);
        setErrorMessage("Admin authentication is still loading. Please refresh and try again.");
        return;
      }

      setLoading(true);

      const runLoad = async () => {
        const [vehiclesResult, intakesResult] = await Promise.all([
          getVehiclesData(),
          getWarehouseIntakesData()
        ]);
        return { vehiclesResult, intakesResult };
      };

      try {
        await firebaseUser.getIdToken();
        let { vehiclesResult, intakesResult } = await runLoad();

        if (isWarehouseIntakePermissionError(intakesResult.error)) {
          await firebaseUser.getIdToken(true);
          ({ vehiclesResult, intakesResult } = await runLoad());
        }

        if (cancelled) return;

        setVehicles(vehiclesResult.items);
        setIntakes(intakesResult.items);
        setErrorMessage(intakesResult.error && !intakesResult.items.length ? intakesResult.error : "");
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "We couldn't load warehouse intake records.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, canManageVehicles, firebaseUser]);

  if (!canManageVehicles) {
    return (
      <div className="rounded-[28px] border border-black/5 bg-white p-8 shadow-panel">
        <p className="text-sm text-ink/60">You need vehicle-management permission to use the warehouse intake workspace.</p>
      </div>
    );
  }

  const recentVehicles = vehicles.slice(0, 8);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="rounded-[24px] border border-black/5 bg-white p-4 shadow-panel md:rounded-[28px] md:p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-bronze">iPad workflow</p>
          <h2 className="mt-2 font-display text-2xl text-ink md:text-3xl">Warehouse Intake & Storage</h2>
          <p className="mt-2 text-sm text-ink/58">Use an existing listing to start paperwork, or reopen a recent intake to continue it.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:gap-4">
        {[
          ["Intake events", String(intakes.length)],
          ["Public listings", String(vehicles.length)]
        ].map(([label, value]) => (
          <div key={label} className="rounded-[22px] border border-black/5 bg-white p-4 shadow-panel md:rounded-[24px] md:p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-bronze">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-ink">{value}</p>
          </div>
        ))}
      </div>

      {errorMessage ? (
        <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{errorMessage}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <SectionCard
          eyebrow="Optional public listing links"
          title="Attach onboarding to an existing listing"
          summary={`${vehicles.length} listings available`}
          open={sectionState.listings}
          onToggle={() => setSectionState((current) => ({ ...current, listings: !current.listings }))}
        >
          <div className="grid gap-3 md:grid-cols-2 md:gap-4">
            {recentVehicles.map((vehicle) => (
              <div key={vehicle.id} className="overflow-hidden rounded-[20px] border border-black/5 bg-shell md:rounded-[24px]">
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
              <div className="rounded-[20px] border border-dashed border-black/10 bg-shell px-4 py-6 text-sm leading-6 text-ink/60 md:rounded-[24px] md:px-5 md:py-8">
                No listings are ready yet. You can still start a standalone intake and attach it later.
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Existing records"
          title="Recent intake records"
          summary={`${intakes.length} records`}
          open={sectionState.recent}
          onToggle={() => setSectionState((current) => ({ ...current, recent: !current.recent }))}
        >
          <div className="space-y-3">
            {intakes.slice(0, 10).map((intake) => (
              <Link
                key={intake.id}
                href={`/admin/warehouse-intake/${intake.id}`}
                className="block rounded-[20px] border border-black/6 bg-shell px-4 py-4 transition hover:border-[#C6A87D]/35 hover:bg-white md:rounded-[22px]"
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
              <div className="rounded-[20px] border border-dashed border-black/10 bg-shell px-4 py-6 text-sm leading-6 text-ink/60 md:rounded-[24px] md:px-5 md:py-8">
                Completed and in-progress warehouse intakes will appear here for quick access.
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
