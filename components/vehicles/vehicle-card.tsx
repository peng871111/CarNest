"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Vehicle } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { getPublicVehicleLocation, getVehicleImageCandidates } from "@/lib/permissions";
import { ListingBadge } from "@/components/vehicles/listing-badge";
import { ListingSummary } from "@/components/vehicles/listing-summary";
import { ImageWatermark } from "@/components/vehicles/image-watermark";
import { SellerVehicleStatusBadge } from "@/components/vehicles/seller-vehicle-status-badge";
import { PublicVehicleImage } from "@/components/vehicles/public-vehicle-image";

export function VehicleCard({ vehicle, compact = false }: { vehicle: Vehicle; compact?: boolean }) {
  const candidates = useMemo(() => getVehicleImageCandidates(vehicle), [vehicle]);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    setImageIndex(0);
  }, [vehicle.id]);

  const imageSrc = candidates[Math.min(imageIndex, candidates.length - 1)];

  return (
    <Link
      href={`/inventory/${vehicle.id}`}
      className={`overflow-hidden border border-black/5 bg-white shadow-panel transition hover:-translate-y-1 ${compact ? "rounded-[22px]" : "rounded-[24px]"}`}
    >
      <div className={`relative ${compact ? "aspect-[4/2.55]" : "aspect-[4/3]"}`}>
        <PublicVehicleImage
          src={imageSrc}
          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.variant} exterior photo on CarNest`.replace(/\s+/g, " ").trim()}
          loading="lazy"
          sizes={compact ? "(max-width: 519px) 100vw, (max-width: 1279px) 50vw, (max-width: 1535px) 33vw, 25vw" : "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"}
          quality={compact ? 68 : 75}
          className="object-cover"
          onImageError={() => setImageIndex((current) => (current < candidates.length - 1 ? current + 1 : current))}
        />
        <ImageWatermark />
      </div>
      <div className={compact ? "space-y-2.5 p-3.5" : "space-y-3 p-4"}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap gap-2">
              <ListingBadge vehicle={vehicle} />
              {vehicle.sellerStatus === "UNDER_OFFER" ? <SellerVehicleStatusBadge status={vehicle.sellerStatus} /> : null}
            </div>
            <h3 className={compact ? "mt-2 text-base font-semibold leading-tight text-ink" : "mt-2 text-lg font-semibold leading-tight text-ink"}>
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h3>
            {vehicle.variant ? <p className="mt-1 text-xs text-ink/55">{vehicle.variant}</p> : null}
          </div>
          <p className={compact ? "text-sm font-semibold text-ink" : "text-base font-semibold text-ink"}>{formatCurrency(vehicle.price)}</p>
        </div>
        <div className={compact ? "flex flex-wrap gap-x-2.5 gap-y-1 text-[10px] uppercase tracking-[0.11em] text-ink/58" : "flex flex-wrap gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.12em] text-ink/58"}>
          <span>{vehicle.mileage.toLocaleString()} km</span>
          <span>{vehicle.transmission}</span>
          <span>{vehicle.fuelType}</span>
          <span>{getPublicVehicleLocation(vehicle)}</span>
        </div>
        <ListingSummary vehicle={vehicle} compact={compact} />
      </div>
    </Link>
  );
}
