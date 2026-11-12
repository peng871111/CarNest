"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [photoActionsOpen, setPhotoActionsOpen] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const photoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setImageIndex(0);
    setPhotoActionsOpen(false);
  }, [vehicle.id]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: none), (pointer: coarse)");
    const updateInteractionMode = () => setIsTouchDevice(mediaQuery.matches);
    updateInteractionMode();
    mediaQuery.addEventListener("change", updateInteractionMode);
    return () => mediaQuery.removeEventListener("change", updateInteractionMode);
  }, []);

  useEffect(() => {
    if (!photoActionsOpen || !isTouchDevice) return;

    function closePhotoActions(event: Event) {
      if (photoRef.current?.contains(event.target as Node)) return;
      event.preventDefault();
      event.stopPropagation();
      setPhotoActionsOpen(false);
    }

    document.addEventListener("pointerdown", closePhotoActions, true);
    document.addEventListener("click", closePhotoActions, true);
    return () => {
      document.removeEventListener("pointerdown", closePhotoActions, true);
      document.removeEventListener("click", closePhotoActions, true);
    };
  }, [isTouchDevice, photoActionsOpen]);

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
          <div ref={photoRef} className="relative aspect-[4/3] overflow-hidden">
            <Link
              href={vehicleHref}
              aria-label={`View ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              className="block h-full"
              onClick={(event) => {
                if (!isTouchDevice) return;
                event.preventDefault();
                event.stopPropagation();
                setPhotoActionsOpen(true);
              }}
            >
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
            </Link>
            <div
              className={`absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 pointer-events-none group-focus-within:pointer-events-auto group-focus-within:opacity-100 md:group-hover:pointer-events-auto md:group-hover:opacity-100 ${photoActionsOpen ? "pointer-events-auto opacity-100" : ""}`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex w-44 flex-col gap-3">
                <Link
                  href={vehicleHref}
                  onClick={(event) => event.stopPropagation()}
                  className="flex min-h-11 items-center justify-center rounded-full border border-white/35 bg-white/[0.18] px-5 py-3 text-sm font-semibold text-white shadow-sm backdrop-blur-md transition hover:bg-white/[0.3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  View listing
                </Link>
                <Link
                  href={privateOfferHref}
                  onClick={(event) => event.stopPropagation()}
                  className="flex min-h-11 items-center justify-center rounded-full border border-white/35 bg-white/[0.18] px-5 py-3 text-sm font-semibold text-white shadow-sm backdrop-blur-md transition hover:bg-white/[0.3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Private offer
                </Link>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setPhotoActionsOpen(false);
                    setDealerOfferOpen(true);
                  }}
                  className="flex min-h-11 items-center justify-center rounded-full border border-white/35 bg-white/[0.18] px-5 py-3 text-sm font-semibold text-white shadow-sm backdrop-blur-md transition hover:bg-white/[0.3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Dealer offer
                </button>
              </div>
            </div>
          </div>
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
