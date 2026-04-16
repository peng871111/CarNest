"use client";

import { useEffect, useMemo, useState } from "react";
import { VEHICLE_PLACEHOLDER_IMAGE } from "@/lib/constants";
import { ImageWatermark } from "@/components/vehicles/image-watermark";

export function VehicleGallery({
  images,
  altBase
}: {
  images: string[];
  altBase: string;
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
  const [activeImage, setActiveImage] = useState(validImages[0] ?? VEHICLE_PLACEHOLDER_IMAGE);
  const [thumbnailSources, setThumbnailSources] = useState(validImages);

  const getImageAlt = (index: number) => {
    const descriptor = imageDescriptors[index] ?? `detail view ${index + 1}`;
    return `${altBase} ${descriptor}`;
  };

  useEffect(() => {
    setThumbnailSources(validImages);
    setActiveImage(validImages[0] ?? VEHICLE_PLACEHOLDER_IMAGE);
  }, [validImages]);

  return (
    <div className="space-y-4">
      <div className="relative aspect-[16/10] overflow-hidden rounded-[32px] border border-black/5 bg-white shadow-panel">
        <img
          src={activeImage}
          alt={getImageAlt(Math.max(validImages.indexOf(activeImage), 0))}
          loading="eager"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = VEHICLE_PLACEHOLDER_IMAGE;
            setActiveImage(VEHICLE_PLACEHOLDER_IMAGE);
          }}
          className="h-full w-full object-cover"
        />
        <ImageWatermark />
      </div>
      {thumbnailSources.length > 1 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {thumbnailSources.map((image, index) => {
            const active = image === activeImage;

            return (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => setActiveImage(image)}
                className={`relative aspect-[4/3] overflow-hidden rounded-[22px] border bg-white transition ${active ? "border-bronze shadow-panel" : "border-black/5 hover:border-black/15"}`}
              >
                <img
                  src={image}
                  alt={getImageAlt(index)}
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = VEHICLE_PLACEHOLDER_IMAGE;
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
