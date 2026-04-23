"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DealerTermsGate } from "@/components/dealer/dealer-terms-gate";
import { useAuth } from "@/lib/auth";
import { getOwnedVehiclesData } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import { Vehicle } from "@/types";

function getVehicleTitle(vehicle: Vehicle) {
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
}

export function DealerInventoryPanel() {
  const { appUser, loading } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadVehicles() {
      if (!appUser?.id) return;
      const result = await getOwnedVehiclesData(appUser.id);
      if (!cancelled) setVehicles(result.items);
    }

    void loadVehicles();

    return () => {
      cancelled = true;
    };
  }, [appUser?.id]);

  if (loading) {
    return <p className="text-sm text-ink/60">Loading dealer inventory...</p>;
  }

  return (
    <DealerTermsGate>
      <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-bronze">Dealer inventory</p>
            <h1 className="mt-4 font-display text-4xl text-ink">Inventory</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
              Manage dealer stock prepared for the CarNest marketplace.
            </p>
          </div>
          <Link href="/dealer/inventory/new" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
            Add vehicle
          </Link>
        </div>

        <div className="mt-8 space-y-3">
          {vehicles.length ? vehicles.map((vehicle) => (
            <div key={vehicle.id} className="rounded-[24px] border border-black/5 bg-shell px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{getVehicleTitle(vehicle) || vehicle.id}</p>
                  <p className="mt-1 text-sm text-ink/60">{vehicle.id} · {vehicle.sellerStatus}</p>
                </div>
                <p className="text-sm font-semibold text-ink">{formatCurrency(vehicle.price)}</p>
              </div>
            </div>
          )) : (
            <div className="rounded-[24px] border border-dashed border-black/10 bg-shell px-5 py-8 text-sm text-ink/60">
              No dealer vehicles yet. Add your first vehicle to start building your inventory.
            </div>
          )}
        </div>
      </section>
    </DealerTermsGate>
  );
}
