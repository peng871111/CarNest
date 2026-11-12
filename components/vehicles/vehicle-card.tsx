"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DealerOfferModal } from "@/components/offers/dealer-offer-modal";
import { Vehicle } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { getPublicVehicleLocation, getVehicleImageCandidates } from "@/lib/permissions";
import { ListingBadge } from "@/components/vehicles/listing-badge";
import { ConditionSummaryPreview } from "@/components/vehicles/condition-summary-preview";
import { ImageWatermark } from "@/components/vehicles/image-watermark";
import { SellerVehicleStatusBadge } from "@/components/vehicles/seller-vehicle-status-badge";
import { PublicVehicleImage } from "@/components/vehicles/public-vehicle-image";

export function VehicleCard({ vehicle, compact = false, showOfferActions = false }: { vehicle: Vehicle; compact?: boolean; showOfferActions?: boolean }) {
  const router = useRouter();
  const candidates = useMemo(() => getVehicleImageCandidates(vehicle), [vehicle]);
  const [imageIndex, setImageIndex] = useState(0);
  const [dealerOfferOpen, setDealerOfferOpen] = useState(false);

  useEffect(() => {
    setImageIndex(0);
  }, [vehicle.id]);

  const imageSrc = candidates[Math.min(imageIndex, candidates.length - 1)];
  const vehicleHref = `/inventory/${vehicle.id}`;
  const privateOfferHref = `${vehicleHref}?action=offer#take-action-panel`;

  if (showOfferActions) {
    return (
      <>
        <article
          role="link"
          tabIndex={0}
          aria-label={`View ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
          onClick={() => router.push(vehicleHref)}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              router.push(vehicleHref);
            }
          }}
          className={`group cursor-pointer overflow-hidden border border-black/5 bg-white shadow-panel transition hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze ${compact ? "rounded-[22px]" : "rounded-[24px]"}`}
        >
          <Link href={vehicleHref} aria-label={`View ${vehicle.year} ${vehicle.make} ${vehicle.model}`} className="block">
            <div className="relative aspect-[4/3]">
              <PublicVehicleImage
                src={imageSrc}
                alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.variant} exterior photo on CarNest`.replace(/\s+/g, " ").trim()}
                loading="lazy"
                sizes={compact ? "(max-width: 519px) 100vw, (max-width: 1279px) 50vw, (max-width: 1535px) 33vw, 25vw" : "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"}
                quality={compact ? 68 : 75}
                className="object-cover object-center"
                onImageError={() => setImageIndex((current) => (current < candidates.length - 1 ? current + 1 : current))}
              />
              <ImageWatermark />
            </div>
          </Link>
          <div className={compact ? "space-y-2 p-3 sm:space-y-2.5 sm:p-3.5" : "space-y-3 p-4"}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap gap-2">
                  <ListingBadge vehicle={vehicle} />
                  {vehicle.sellerStatus === "UNDER_OFFER" ? <SellerVehicleStatusBadge status={vehicle.sellerStatus} /> : null}
                </div>
                <Link href={vehicleHref} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze">
                  <h3 className={compact ? "mt-1.5 text-[15px] font-semibold leading-tight text-ink sm:mt-2 sm:text-base" : "mt-2 text-lg font-semibold leading-tight text-ink"}>
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </h3>
                </Link>
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
            <ConditionSummaryPreview vehicle={vehicle} compact={compact} />
            <div className="flex flex-wrap gap-2 border-t border-black/5 pt-2.5 md:hidden md:group-hover:flex md:group-focus-within:flex">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setDealerOfferOpen(true);
                }}
                className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze md:px-3 md:py-1.5 md:text-xs"
              >
                Dealer Offer
              </button>
              <Link
                href={privateOfferHref}
                onClick={(event) => event.stopPropagation()}
                className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze md:px-3 md:py-1.5 md:text-xs"
              >
                Private Offer
              </Link>
            </div>
          </div>
        </article>
        <DealerOfferModal vehicle={vehicle} open={dealerOfferOpen} onClose={() => setDealerOfferOpen(false)} />
      </>
    );
  }

  return (
    <Link
      href={vehicleHref}
      className={`overflow-hidden border border-black/5 bg-white shadow-panel transition hover:-translate-y-1 ${compact ? "rounded-[22px]" : "rounded-[24px]"}`}
    >
      <div className="relative aspect-[4/3]">
        <PublicVehicleImage
          src={imageSrc}
          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.variant} exterior photo on CarNest`.replace(/\s+/g, " ").trim()}
          loading="lazy"
          sizes={compact ? "(max-width: 519px) 100vw, (max-width: 1279px) 50vw, (max-width: 1535px) 33vw, 25vw" : "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"}
          quality={compact ? 68 : 75}
          className="object-cover object-center"
          onImageError={() => setImageIndex((current) => (current < candidates.length - 1 ? current + 1 : current))}
        />
        <ImageWatermark />
      </div>
      <div className={compact ? "space-y-2 p-3 sm:space-y-2.5 sm:p-3.5" : "space-y-3 p-4"}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap gap-2">
              <ListingBadge vehicle={vehicle} />
              {vehicle.sellerStatus === "UNDER_OFFER" ? <SellerVehicleStatusBadge status={vehicle.sellerStatus} /> : null}
            </div>
            <h3 className={compact ? "mt-1.5 text-[15px] font-semibold leading-tight text-ink sm:mt-2 sm:text-base" : "mt-2 text-lg font-semibold leading-tight text-ink"}>
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
        <ConditionSummaryPreview vehicle={vehicle} compact={compact} />
      </div>
    </Link>
  );
}
