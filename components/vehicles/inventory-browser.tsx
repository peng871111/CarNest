"use client";

import { useMemo, useState } from "react";
import { VehicleCard } from "@/components/vehicles/vehicle-card";
import { VehicleDataSource } from "@/lib/data";
import { Vehicle } from "@/types";

interface InventoryFilters {
  make: string;
  minPrice: string;
  maxPrice: string;
  minYear: string;
  maxYear: string;
  maxKilometres: string;
}

const initialFilters: InventoryFilters = {
  make: "",
  minPrice: "",
  maxPrice: "",
  minYear: "",
  maxYear: "",
  maxKilometres: ""
};

function toNumber(value: string) {
  return value ? Number(value) : null;
}

function toNumericValue(value: string) {
  return value.replace(/\D+/g, "");
}

export function InventoryBrowser({ vehicles, source }: { vehicles: Vehicle[]; source: VehicleDataSource }) {
  const [filters, setFilters] = useState<InventoryFilters>(initialFilters);

  const makeOptions = useMemo(
    () => Array.from(new Set(vehicles.map((vehicle) => vehicle.make).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [vehicles]
  );

  const filteredVehicles = useMemo(() => {
    const minPrice = toNumber(filters.minPrice);
    const maxPrice = toNumber(filters.maxPrice);
    const minYear = toNumber(filters.minYear);
    const maxYear = toNumber(filters.maxYear);
    const maxKilometres = toNumber(filters.maxKilometres);

    return vehicles.filter((vehicle) => {
      if (filters.make && vehicle.make !== filters.make) return false;
      if (minPrice !== null && vehicle.price < minPrice) return false;
      if (maxPrice !== null && vehicle.price > maxPrice) return false;
      if (minYear !== null && vehicle.year < minYear) return false;
      if (maxYear !== null && vehicle.year > maxYear) return false;
      if (maxKilometres !== null && vehicle.mileage > maxKilometres) return false;
      return true;
    });
  }, [filters, vehicles]);

  function updateFilter<K extends keyof InventoryFilters>(key: K, value: InventoryFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <div className="mb-8 rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-ink/45">Make</span>
            <select
              value={filters.make}
              onChange={(event) => updateFilter("make", event.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
            >
              <option value="">All makes</option>
              {makeOptions.map((make) => (
                <option key={make} value={make}>
                  {make}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-ink/45">Min price</span>
            <input
              value={filters.minPrice}
              onChange={(event) => updateFilter("minPrice", toNumericValue(event.target.value))}
              inputMode="numeric"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
              placeholder="Any"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-ink/45">Max price</span>
            <input
              value={filters.maxPrice}
              onChange={(event) => updateFilter("maxPrice", toNumericValue(event.target.value))}
              inputMode="numeric"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
              placeholder="Any"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-ink/45">Min year</span>
            <input
              value={filters.minYear}
              onChange={(event) => updateFilter("minYear", toNumericValue(event.target.value))}
              inputMode="numeric"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
              placeholder="Any"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-ink/45">Max year</span>
            <input
              value={filters.maxYear}
              onChange={(event) => updateFilter("maxYear", toNumericValue(event.target.value))}
              inputMode="numeric"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
              placeholder="Any"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-ink/45">Max kilometres</span>
            <input
              value={filters.maxKilometres}
              onChange={(event) => updateFilter("maxKilometres", toNumericValue(event.target.value))}
              inputMode="numeric"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
              placeholder="Any"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink/60">
            Showing {filteredVehicles.length} of {vehicles.length} vehicles
          </p>
          <button
            type="button"
            onClick={() => setFilters(initialFilters)}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-ink transition hover:bg-shell"
          >
            Reset filters
          </button>
        </div>
      </div>

      {vehicles.length ? (
        filteredVehicles.length ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredVehicles.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        ) : (
          <div className="rounded-[32px] border border-dashed border-black/10 bg-white px-8 py-14 text-center shadow-panel">
            <p className="text-lg font-semibold text-ink">No vehicles match these filters</p>
            <p className="mt-3 text-sm leading-6 text-ink/60">Adjust the filter bar above to broaden your search.</p>
          </div>
        )
      ) : (
        <div className="rounded-[32px] border border-dashed border-black/10 bg-white px-8 py-14 text-center shadow-panel">
          <p className="text-lg font-semibold text-ink">No vehicles available yet</p>
          <p className="mt-3 text-sm leading-6 text-ink/60">Newly approved listings will appear here as they become available.</p>
        </div>
      )}
    </>
  );
}
