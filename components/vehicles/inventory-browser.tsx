"use client";

import { useMemo, useState } from "react";
import { VehicleCard } from "@/components/vehicles/vehicle-card";
import { VehicleDataSource } from "@/lib/data";
import { Vehicle } from "@/types";

interface InventoryFilters {
  make: string;
  transmission: string;
  minPrice: string;
  maxPrice: string;
  minYear: string;
  maxYear: string;
}

const initialFilters: InventoryFilters = {
  make: "",
  transmission: "",
  minPrice: "",
  maxPrice: "",
  minYear: "",
  maxYear: ""
};

function toNumber(value: string) {
  return value ? Number(value) : null;
}

function toNumericValue(value: string) {
  return value.replace(/\D+/g, "");
}

export function InventoryBrowser({ vehicles, source }: { vehicles: Vehicle[]; source: VehicleDataSource }) {
  const [filters, setFilters] = useState<InventoryFilters>(initialFilters);
  const [mobileFiltersExpanded, setMobileFiltersExpanded] = useState(false);

  const makeOptions = useMemo(
    () => Array.from(new Set(vehicles.map((vehicle) => vehicle.make).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [vehicles]
  );
  const transmissionOptions = useMemo(
    () =>
      Array.from(new Set(vehicles.map((vehicle) => vehicle.transmission).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [vehicles]
  );

  const filteredVehicles = useMemo(() => {
    const minPrice = toNumber(filters.minPrice);
    const maxPrice = toNumber(filters.maxPrice);
    const minYear = toNumber(filters.minYear);
    const maxYear = toNumber(filters.maxYear);

    return vehicles.filter((vehicle) => {
      if (filters.make && vehicle.make !== filters.make) return false;
      if (filters.transmission && vehicle.transmission !== filters.transmission) return false;
      if (minPrice !== null && vehicle.price < minPrice) return false;
      if (maxPrice !== null && vehicle.price > maxPrice) return false;
      if (minYear !== null && vehicle.year < minYear) return false;
      if (maxYear !== null && vehicle.year > maxYear) return false;
      return true;
    });
  }, [filters, vehicles]);

  function updateFilter<K extends keyof InventoryFilters>(key: K, value: InventoryFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  const activeFilterSummary = useMemo(() => {
    const parts = [
      filters.make || "",
      filters.transmission || "",
      filters.minPrice || filters.maxPrice ? `Price ${filters.minPrice || "Any"}-${filters.maxPrice || "Any"}` : "",
      filters.minYear || filters.maxYear ? `Year ${filters.minYear || "Any"}-${filters.maxYear || "Any"}` : ""
    ].filter(Boolean);

    return parts.length ? parts.join(" · ") : "No filters applied";
  }, [filters]);

  return (
    <>
      <div className="sticky top-[86px] z-20 mb-6 rounded-[28px] border border-black/5 bg-white/95 p-4 shadow-panel backdrop-blur-sm sm:mb-8 sm:p-5 md:top-[96px]">
        <div className="md:hidden rounded-[22px] border border-black/5 bg-shell px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Filters</p>
              <p className="mt-1 text-sm text-ink/62">{activeFilterSummary}</p>
            </div>
            <button
              type="button"
              onClick={() => setMobileFiltersExpanded((current) => !current)}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-white"
            >
              {mobileFiltersExpanded ? "Hide filters" : "Show filters"}
            </button>
          </div>
        </div>

        <div className={`${mobileFiltersExpanded ? "mt-4 grid" : "hidden"} gap-3 md:mt-0 md:grid md:grid-cols-3 md:gap-3 xl:grid-cols-6`}>
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
            <span className="text-xs uppercase tracking-[0.22em] text-ink/45">Transmission</span>
            <select
              value={filters.transmission}
              onChange={(event) => updateFilter("transmission", event.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
            >
              <option value="">All types</option>
              {transmissionOptions.map((transmission) => (
                <option key={transmission} value={transmission}>
                  {transmission}
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
        </div>
        <div className={`${mobileFiltersExpanded ? "mt-4" : "mt-3 md:mt-4"} flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-3 md:pt-4`}>
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
          <div className="grid gap-3 sm:gap-4 min-[520px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredVehicles.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} compact />
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
