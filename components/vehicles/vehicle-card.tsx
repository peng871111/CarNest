"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Vehicle } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { getPublicVehicleLocation, getVehicleImageCandidates } from "@/lib/permissions";
import { ListingBadge } from "@/components/vehicles/listing-badge";
import { ListingSummary } from "@/components/vehicles/listing-summary";
import { ImageWatermark } from "@/components/vehicles/image-watermark";

export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const candidates = useMemo(() => getVehicleImageCandidates(vehicle), [vehicle]);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    setImageIndex(0);
  }, [vehicle.id]);

  const imageSrc = candidates[Math.min(imageIndex, candidates.length - 1)];

  return (
    <Link href={`/inventory/${vehicle.id}`} className="overflow-hidden rounded-[24px] border border-black/5 bg-white shadow-panel transition hover:-translate-y-1">
      <div className="relative aspect-[4/3]">
        <Image
          src={imageSrc}
          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} listing image`}
          fill
          loading="lazy"
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          className="object-cover"
          onError={() => setImageIndex((current) => (current < candidates.length - 1 ? current + 1 : current))}
        />
        <ImageWatermark />
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <ListingBadge vehicle={vehicle} />
            <h3 className="mt-2 text-lg font-semibold leading-tight text-ink">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h3>
            <p className="mt-1 text-xs text-ink/55">{vehicle.variant}</p>
          </div>
          <p className="text-base font-semibold text-ink">{formatCurrency(vehicle.price)}</p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.12em] text-ink/58">
          <span>{vehicle.mileage.toLocaleString()} km</span>
          <span>{vehicle.transmission}</span>
          <span>{vehicle.fuelType}</span>
          <span>{getPublicVehicleLocation(vehicle)}</span>
        </div>
        <ListingSummary vehicle={vehicle} />
      </div>
    </Link>
  );
}
