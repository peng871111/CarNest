"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { VehicleCard } from "@/components/vehicles/vehicle-card";
import { useAuth } from "@/lib/auth";
import { getSavedVehiclesWithDetails, markSavedVehicleActivityViewed } from "@/lib/data";
import { Vehicle, VehicleActivityEvent } from "@/types";

interface SavedVehicleWithActivity {
  vehicle: Vehicle;
  latestActivity?: VehicleActivityEvent;
  hasUnreadActivity: boolean;
}

export default function SavedVehiclesPage() {
  const { appUser, loading, authError } = useAuth();
  const [savedVehicles, setSavedVehicles] = useState<SavedVehicleWithActivity[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    async function loadSavedVehicles() {
      if (!appUser || appUser.role === "admin" || appUser.role === "super_admin") {
        setSavedVehicles([]);
        setPageLoading(false);
        return;
      }

      setPageLoading(true);
      const result = await getSavedVehiclesWithDetails(appUser.id);
      const nextItems = result.items.map((item) => {
        const latestActivity = item.latestActivity;
        const shouldSuppressActivity = latestActivity?.actorUid === appUser.id || item.vehicle.ownerUid === appUser.id;
        const hasUnreadActivity = Boolean(
          latestActivity
            && latestActivity.type === "offer_created"
            && !shouldSuppressActivity
            && (item.savedVehicle.lastViewedActivityAt ?? "") < (latestActivity.createdAt ?? "")
        );

        return {
          vehicle: item.vehicle,
          latestActivity: shouldSuppressActivity ? undefined : latestActivity,
          hasUnreadActivity
        };
      });
      setSavedVehicles(nextItems);
      await Promise.all(
        result.items
          .filter(
            (item) =>
              item.latestActivity
              && item.latestActivity.type === "offer_created"
              && item.latestActivity.actorUid !== appUser.id
              && item.vehicle.ownerUid !== appUser.id
              && (item.savedVehicle.lastViewedActivityAt ?? "") < (item.latestActivity.createdAt ?? "")
              && item.latestActivity.createdAt
          )
          .map((item) =>
            markSavedVehicleActivityViewed(appUser.id, item.vehicle.id, item.latestActivity!.createdAt!).catch(() => undefined)
          )
      );
      setPageLoading(false);
    }

    void loadSavedVehicles();
  }, [appUser]);

  const unreadActivityCount = savedVehicles.filter((item) => item.hasUnreadActivity).length;

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
                Keep a shortlist of vehicles you want to revisit from your CarNest account.
              </p>
              <div className="mt-8">
                <Link href="/login" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
                  Go to Login
                </Link>
              </div>
            </>
          ) : appUser.role === "admin" || appUser.role === "super_admin" ? (
            <>
              <p className="text-xs uppercase tracking-[0.28em] text-bronze">Saved vehicles</p>
              <h1 className="mt-4 font-display text-4xl text-ink">Saved vehicles are not available in the admin area</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
                Standard CarNest accounts can save listings and revisit them here.
              </p>
            </>
          ) : savedVehicles.length ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-bronze">Saved vehicles</p>
                  <h1 className="mt-4 font-display text-4xl text-ink">Your saved shortlist</h1>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
                    Revisit the vehicles you have saved and jump back into offers or inspection planning when you are ready.
                  </p>
                </div>
                <Link href="/inventory" className="text-sm font-medium text-ink/65 transition hover:text-bronze">
                  Browse more vehicles
                </Link>
              </div>
              {unreadActivityCount > 0 ? (
                <div className="mt-6 rounded-[24px] border border-[#F5D7B2] bg-[#FFF7ED] px-5 py-4 text-sm text-[#9A3412]">
                  {unreadActivityCount === 1
                    ? "Activity update: a new offer has been made on a vehicle you saved."
                    : `Activity updates: new offers have been made on ${unreadActivityCount} vehicles you saved.`}
                </div>
              ) : null}
              <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {savedVehicles.map((item) => (
                  <div key={item.vehicle.id} className="space-y-3">
                    {item.hasUnreadActivity ? (
                      <div className="rounded-[20px] border border-[#F5D7B2] bg-[#FFF7ED] px-4 py-3 text-sm text-[#9A3412]">
                        Activity update: a new offer has been made on this vehicle.
                      </div>
                    ) : null}
                    <VehicleCard vehicle={item.vehicle} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-xs uppercase tracking-[0.28em] text-bronze">Saved vehicles</p>
              <h1 className="mt-4 font-display text-4xl text-ink">No saved vehicles yet</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
                Save vehicles from their detail pages to build a shortlist in your account.
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
