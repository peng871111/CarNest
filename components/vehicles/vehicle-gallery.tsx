"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { VEHICLE_PLACEHOLDER_IMAGE } from "@/lib/constants";
import { ImageWatermark } from "@/components/vehicles/image-watermark";

export function VehicleGallery({
  images,
  thumbnails,
  altBase,
  showMainImageArrows = false
}: {
  images: string[];
  thumbnails?: string[];
  altBase: string;
  showMainImageArrows?: boolean;
}) {
  const imageDescriptors = [
    "front three-quarter view",
    "rear exterior",
    "interior dashboard",
    "side profile",
    "cabin detail",
    "additional detail"
  ];
  const validImages = useMemo(
    () =>
      Array.from(
        new Set(
          images.filter((url): url is string => typeof url === "string" && url.startsWith("http"))
        )
      ),
    [images]
  );
  const validThumbnails = useMemo(
    () =>
      Array.from(
        new Set(
          (thumbnails?.length ? thumbnails : images).filter((url): url is string => typeof url === "string" && url.startsWith("http"))
        )
      ),
    [images, thumbnails]
  );
  const [activeImage, setActiveImage] = useState(validImages[0] ?? VEHICLE_PLACEHOLDER_IMAGE);
  const [thumbnailSources, setThumbnailSources] = useState(validImages);
  const [mainImageLoaded, setMainImageLoaded] = useState(false);
  const [thumbnailLoaded, setThumbnailLoaded] = useState<Record<number, boolean>>({});
  const activeImageIndex = Math.max(thumbnailSources.indexOf(activeImage), 0);

  const getImageAlt = (index: number) => {
    const descriptor = imageDescriptors[index] ?? `detail view ${index + 1}`;
    return `${altBase} ${descriptor} photo on CarNest`;
  };

  useEffect(() => {
    setThumbnailSources(validImages);
    setActiveImage(validImages[0] ?? VEHICLE_PLACEHOLDER_IMAGE);
    setMainImageLoaded(false);
    setThumbnailLoaded({});
  }, [validImages]);

  useEffect(() => {
    setMainImageLoaded(false);
  }, [activeImage]);

  function showPreviousImage() {
    if (thumbnailSources.length <= 1) return;
    const nextIndex = activeImageIndex <= 0 ? thumbnailSources.length - 1 : activeImageIndex - 1;
    setActiveImage(thumbnailSources[nextIndex]);
  }

  function showNextImage() {
    if (thumbnailSources.length <= 1) return;
    const nextIndex = activeImageIndex >= thumbnailSources.length - 1 ? 0 : activeImageIndex + 1;
    setActiveImage(thumbnailSources[nextIndex]);
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-[16/10] overflow-hidden rounded-[32px] border border-black/5 bg-white shadow-panel">
        {!mainImageLoaded ? <div className="absolute inset-0 animate-pulse bg-shell" aria-hidden="true" /> : null}
        <img
          src={activeImage}
          alt={getImageAlt(Math.max(validImages.indexOf(activeImage), 0))}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          onLoad={() => setMainImageLoaded(true)}
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = VEHICLE_PLACEHOLDER_IMAGE;
            setActiveImage(VEHICLE_PLACEHOLDER_IMAGE);
            setMainImageLoaded(true);
          }}
          className="h-full w-full object-cover"
        />
        {showMainImageArrows && thumbnailSources.length > 1 ? (
          <>
            <button
              type="button"
              onClick={showPreviousImage}
              aria-label="Show previous image"
              className="absolute left-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/25 text-white backdrop-blur-sm transition hover:bg-black/40"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={showNextImage}
              aria-label="Show next image"
              className="absolute right-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/25 text-white backdrop-blur-sm transition hover:bg-black/40"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}
        <ImageWatermark />
      </div>
      {thumbnailSources.length > 1 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {thumbnailSources.map((image, index) => {
            const active = image === activeImage;
            const thumbnailSrc = validThumbnails[index] ?? image;

            return (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => setActiveImage(image)}
                className={`relative aspect-[4/3] overflow-hidden rounded-[22px] border bg-white transition ${active ? "border-bronze shadow-panel" : "border-black/5 hover:border-black/15"}`}
              >
                {!thumbnailLoaded[index] ? <div className="absolute inset-0 animate-pulse bg-shell" aria-hidden="true" /> : null}
                <img
                  src={thumbnailSrc}
                  alt={getImageAlt(index)}
                  loading="lazy"
                  decoding="async"
                  onLoad={() =>
                    setThumbnailLoaded((current) => ({
                      ...current,
                      [index]: true
                    }))
                  }
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = VEHICLE_PLACEHOLDER_IMAGE;
                    setThumbnailLoaded((current) => ({
                      ...current,
                      [index]: true
                    }));
                    setThumbnailSources((current) =>
                      current.map((item, itemIndex) => (itemIndex === index ? VEHICLE_PLACEHOLDER_IMAGE : item))
                    );
                    if (active) {
                      setActiveImage(VEHICLE_PLACEHOLDER_IMAGE);
                    }
                  }}
                  className="h-full w-full object-cover"
                />
                <ImageWatermark />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
