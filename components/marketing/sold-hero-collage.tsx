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

const ROTATIONS = [-2.6, 1.8, -1.2, 2.3, -0.6, 1.1, -1.9] as const;
const TRANSLATE_X = [0, -8, 6, -5, 8, -4, 5] as const;
const TRANSLATE_Y = [0, 10, -12, 14, -8, 12, -10] as const;
const OVERLAP_TOP = [0, -12, 0, -16, -8, -14, -6] as const;
const OPACITY = [0.94, 0.86, 0.9, 0.88, 0.95, 0.84, 0.91] as const;
const SCALE = [1, 1.03, 1.01, 1.04, 1.02, 0.99, 1.03] as const;

type SoldHeroTile = {
  id: string;
  src: string;
  alt: string;
};

function buildSoldHeroTiles(vehicles: Vehicle[], minimumTiles = 72) {
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
    return thumbnails.slice(1, 3).map((src, imageIndex) => ({
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
      <div className="hero-collage-pan absolute inset-[-10%] origin-center scale-[1.03] md:inset-[-7%] md:scale-[1.05]">
        <div className="columns-3 gap-2 sm:columns-4 sm:gap-3 lg:columns-6 xl:columns-7">
          {tiles.map((tile, index) => {
            const aspectClass = TILE_ASPECTS[index % TILE_ASPECTS.length];
            const rotation = ROTATIONS[index % ROTATIONS.length];
            const translateX = TRANSLATE_X[index % TRANSLATE_X.length];
            const translateY = TRANSLATE_Y[index % TRANSLATE_Y.length];
            const overlapTop = index < 3 ? 0 : OVERLAP_TOP[index % OVERLAP_TOP.length];
            const opacity = OPACITY[index % OPACITY.length];
            const scale = SCALE[index % SCALE.length];
            const eager = index < 8;

            return (
              <figure
                key={tile.id}
                className={`relative mb-2 break-inside-avoid overflow-hidden rounded-[22px] border border-white/10 bg-black/20 shadow-[0_20px_50px_rgba(0,0,0,0.38)] sm:mb-3 ${aspectClass}`}
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
                  className="object-cover scale-[1.06]"
                  sizes="(max-width: 639px) 34vw, (max-width: 1023px) 24vw, (max-width: 1535px) 15vw, 12vw"
                  priority={eager}
                  loading={eager ? "eager" : "lazy"}
                  eager={eager}
                  quality={72}
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),transparent_42%,rgba(0,0,0,0.44))]" />
              </figure>
            );
          })}
        </div>
      </div>
    </div>
  );
}
