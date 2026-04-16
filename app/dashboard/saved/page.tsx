"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { VehicleCard } from "@/components/vehicles/vehicle-card";
import { useAuth } from "@/lib/auth";
import { getSavedVehiclesWithDetails } from "@/lib/data";
import { Vehicle } from "@/types";

export default function SavedVehiclesPage() {
  const { appUser, loading, authError } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    async function loadSavedVehicles() {
      if (!appUser || appUser.role !== "buyer") {
        setVehicles([]);
        setPageLoading(false);
        return;
      }

      setPageLoading(true);
      const result = await getSavedVehiclesWithDetails(appUser.id);
      setVehicles(result.items.map((item) => item.vehicle));
      setPageLoading(false);
    }

    void loadSavedVehicles();
  }, [appUser]);

  return (
    <div>
      <WorkspaceHeader workspaceLabel="DASHBOARD" />
      <main className="mx-auto max-w-7xl px-6 py-16">
        <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
          {loading || pageLoading ? (
            <p className="text-sm text-ink/65">Loading saved vehicles...</p>
          ) : authError ? (
            <>
              <p className="text-xs uppercase tracking-[0.28em] text-bronze">Saved vehicles</p>
              <h1 className="mt-4 font-display text-4xl text-ink">Live data is temporarily unavailable</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
                We’re having trouble loading live data right now. Please check your connection and try again.
              </p>
              <div className="mt-8">
                <Link href="/dashboard/saved" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
                  Retry
                </Link>
              </div>
            </>
          ) : !appUser ? (
            <>
              <p className="text-xs uppercase tracking-[0.28em] text-bronze">Saved vehicles</p>
              <h1 className="mt-4 font-display text-4xl text-ink">Sign in to view your saved vehicles</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
                Your buyer dashboard keeps a shortlist of vehicles you want to revisit.
              </p>
              <div className="mt-8">
                <Link href="/login" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
                  Go to Login
                </Link>
              </div>
            </>
          ) : appUser.role !== "buyer" ? (
            <>
              <p className="text-xs uppercase tracking-[0.28em] text-bronze">Saved vehicles</p>
              <h1 className="mt-4 font-display text-4xl text-ink">Saved vehicles are for buyer accounts</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
                Switch to a buyer account to save listings and revisit them from your dashboard.
              </p>
            </>
          ) : vehicles.length ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-bronze">Saved vehicles</p>
                  <h1 className="mt-4 font-display text-4xl text-ink">Your buyer shortlist</h1>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
                    Revisit the vehicles you have saved and jump back into offers or inspection planning when you are ready.
                  </p>
                </div>
                <Link href="/inventory" className="text-sm font-medium text-ink/65 transition hover:text-bronze">
                  Browse more vehicles
                </Link>
              </div>
              <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {vehicles.map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} />
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-xs uppercase tracking-[0.28em] text-bronze">Saved vehicles</p>
              <h1 className="mt-4 font-display text-4xl text-ink">No saved vehicles yet</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
                Save vehicles from their detail pages to build a shortlist in your buyer dashboard.
              </p>
              <div className="mt-8">
                <Link href="/inventory" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
                  Browse Inventory
                </Link>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
