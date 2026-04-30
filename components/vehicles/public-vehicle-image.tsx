"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { VEHICLE_PLACEHOLDER_IMAGE } from "@/lib/constants";

export function PublicVehicleImage({
  src,
  alt,
  sizes,
  priority = false,
  loading = "lazy",
  className,
  quality,
  eager = false,
  onImageError
}: {
  src: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  loading?: "lazy" | "eager";
  className?: string;
  quality?: number;
  eager?: boolean;
  onImageError?: () => void;
}) {
  const [currentSrc, setCurrentSrc] = useState(src || VEHICLE_PLACEHOLDER_IMAGE);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setCurrentSrc(src || VEHICLE_PLACEHOLDER_IMAGE);
    setIsLoaded(false);
  }, [src]);

  return (
    <>
      {!isLoaded ? <div className="absolute inset-0 animate-pulse bg-shell" aria-hidden="true" /> : null}
      <Image
        src={currentSrc || VEHICLE_PLACEHOLDER_IMAGE}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority || eager}
        loading={eager ? "eager" : loading}
        decoding="async"
        quality={quality}
        className={className}
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          onImageError?.();
          if (currentSrc !== VEHICLE_PLACEHOLDER_IMAGE) {
            setCurrentSrc(VEHICLE_PLACEHOLDER_IMAGE);
            setIsLoaded(false);
            return;
          }

          setIsLoaded(true);
        }}
      />
    </>
  );
}
