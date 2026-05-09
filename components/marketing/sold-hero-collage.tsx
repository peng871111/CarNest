import { PublicVehicleImage } from "@/components/vehicles/public-vehicle-image";
import { getVehicleGalleryThumbnails } from "@/lib/permissions";
import { Vehicle } from "@/types";

const TILE_ASPECTS = [
  "aspect-[4/5]",
  "aspect-[3/2]",
  "aspect-[5/4]",
  "aspect-[2/3]",
  "aspect-[16/10]",
  "aspect-[10/16]",
  "aspect-square"
] as const;

const ROTATIONS = [-2.4, 1.7, -1.1, 2.1, -0.5, 1, -1.6] as const;
const TRANSLATE_X = [0, -6, 5, -4, 6, -3, 4] as const;
const TRANSLATE_Y = [0, 7, -8, 10, -6, 8, -7] as const;
const OVERLAP_TOP = [0, -10, 0, -12, -6, -10, -5] as const;
const OPACITY = [0.94, 0.87, 0.9, 0.88, 0.95, 0.85, 0.91] as const;
const SCALE = [1, 1.02, 1.01, 1.03, 1.01, 0.995, 1.02] as const;

type SoldHeroTile = {
  id: string;
  src: string;
  alt: string;
};

function buildSoldHeroTiles(vehicles: Vehicle[], minimumTiles = 132) {
  const primaryTiles = vehicles
    .map((vehicle) => {
      const thumbnails = Array.from(new Set(getVehicleGalleryThumbnails(vehicle).filter(Boolean)));
      const primaryImage = thumbnails[0];
      if (!primaryImage) return null;

      return {
        id: `${vehicle.id}:primary`,
        src: primaryImage,
        alt: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.variant} sold vehicle photo on CarNest`
          .replace(/\s+/g, " ")
          .trim()
      } satisfies SoldHeroTile;
    })
    .filter((tile): tile is SoldHeroTile => Boolean(tile));

  if (primaryTiles.length >= minimumTiles) {
    return primaryTiles;
  }

  const secondaryTiles = vehicles.flatMap((vehicle) => {
    const thumbnails = Array.from(new Set(getVehicleGalleryThumbnails(vehicle).filter(Boolean)));
    return thumbnails.slice(1, 5).map((src, imageIndex) => ({
      id: `${vehicle.id}:secondary:${imageIndex}`,
      src,
      alt: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.variant} sold vehicle photo on CarNest`
        .replace(/\s+/g, " ")
        .trim()
    })) satisfies SoldHeroTile[];
  });

  return [...primaryTiles, ...secondaryTiles].slice(0, Math.max(minimumTiles, primaryTiles.length));
}

export function SoldHeroCollage({ vehicles }: { vehicles: Vehicle[] }) {
  const tiles = buildSoldHeroTiles(vehicles);

  if (!tiles.length) {
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(196,152,79,0.18),transparent_42%),linear-gradient(180deg,rgba(10,15,20,0.16),rgba(10,15,20,0.7))]"
      />
    );
  }

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      <div className="hero-collage-pan absolute inset-[-12%] origin-center scale-[1.08] md:inset-[-9%] md:scale-[1.09]">
        <div className="columns-4 gap-1.5 sm:columns-5 sm:gap-2 lg:columns-8 lg:gap-2 xl:columns-10 2xl:columns-11">
          {tiles.map((tile, index) => {
            const aspectClass = TILE_ASPECTS[index % TILE_ASPECTS.length];
            const rotation = ROTATIONS[index % ROTATIONS.length];
            const translateX = TRANSLATE_X[index % TRANSLATE_X.length];
            const translateY = TRANSLATE_Y[index % TRANSLATE_Y.length];
            const overlapTop = index < 3 ? 0 : OVERLAP_TOP[index % OVERLAP_TOP.length];
            const opacity = OPACITY[index % OPACITY.length];
            const scale = SCALE[index % SCALE.length];
            const eager = index < 12;

            return (
              <figure
                key={tile.id}
                className={`relative mb-1.5 break-inside-avoid overflow-hidden rounded-[16px] border border-white/7 bg-black/20 shadow-[0_12px_34px_rgba(0,0,0,0.28)] sm:mb-2 sm:rounded-[18px] ${aspectClass}`}
                style={{
                  marginTop: overlapTop,
                  opacity,
                  transform: `translate3d(${translateX}px, ${translateY}px, 0) rotate(${rotation}deg) scale(${scale})`,
                  zIndex: index % 5
                }}
              >
                <PublicVehicleImage
                  src={tile.src}
                  alt={tile.alt}
                  className="object-cover scale-[1.05]"
                  sizes="(max-width: 639px) 24vw, (max-width: 1023px) 20vw, (max-width: 1535px) 11vw, 9vw"
                  priority={eager}
                  loading={eager ? "eager" : "lazy"}
                  eager={eager}
                  quality={68}
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05),transparent_36%,rgba(0,0,0,0.38))]" />
              </figure>
            );
          })}
        </div>
      </div>
    </div>
  );
}
