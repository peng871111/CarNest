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
  "aspect-square",
  "aspect-[6/5]",
  "aspect-[5/3]"
] as const;

const ROTATIONS = [-1.8, 1.4, -0.9, 1.7, -0.4, 0.8, -1.2] as const;
const TRANSLATE_X = [0, -4, 3, -3, 4, -2, 3] as const;
const TRANSLATE_Y = [0, 5, -5, 7, -4, 6, -5] as const;
const OVERLAP_TOP = [0, -8, 0, -9, -4, -7, -3] as const;
const OPACITY = [0.95, 0.89, 0.92, 0.9, 0.96, 0.88, 0.93] as const;
const SCALE = [1, 1.01, 1.005, 1.015, 1.01, 0.995, 1.01] as const;

type SoldHeroTile = {
  id: string;
  src: string;
  alt: string;
};

function buildSoldHeroTiles(vehicles: Vehicle[], minimumTiles = 220) {
  const allTiles = vehicles.flatMap((vehicle) => {
    const thumbnails = Array.from(new Set(getVehicleGalleryThumbnails(vehicle).filter(Boolean)));
    return thumbnails.slice(0, 5).map((src, imageIndex) => ({
      id: `${vehicle.id}:${imageIndex}`,
      src,
      alt: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.variant} sold vehicle photo on CarNest`
        .replace(/\s+/g, " ")
        .trim()
    })) satisfies SoldHeroTile[];
  });

  if (allTiles.length >= minimumTiles) {
    return allTiles.slice(0, minimumTiles);
  }

  const repeatedTiles: SoldHeroTile[] = [];
  let duplicateRound = 1;
  while (allTiles.length + repeatedTiles.length < minimumTiles && allTiles.length) {
    repeatedTiles.push(
      ...allTiles.map((tile) => ({
        ...tile,
        id: `${tile.id}:repeat:${duplicateRound}`
      }))
    );
    duplicateRound += 1;
  }

  return [...allTiles, ...repeatedTiles].slice(0, Math.max(minimumTiles, allTiles.length));
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
      <div className="hero-collage-pan absolute inset-[-14%] origin-center scale-[1.04] md:inset-[-10%] md:scale-[1.05]">
        <div className="columns-5 gap-1 sm:columns-6 sm:gap-1.5 lg:columns-10 lg:gap-1.5 xl:columns-12 2xl:columns-14">
          {tiles.map((tile, index) => {
            const aspectClass = TILE_ASPECTS[index % TILE_ASPECTS.length];
            const rotation = ROTATIONS[index % ROTATIONS.length];
            const translateX = TRANSLATE_X[index % TRANSLATE_X.length];
            const translateY = TRANSLATE_Y[index % TRANSLATE_Y.length];
            const overlapTop = index < 3 ? 0 : OVERLAP_TOP[index % OVERLAP_TOP.length];
            const opacity = OPACITY[index % OPACITY.length];
            const scale = SCALE[index % SCALE.length];
            const eager = index < 14;

            return (
              <figure
                key={tile.id}
                className={`relative mb-1 break-inside-avoid overflow-hidden rounded-[14px] border border-white/6 bg-black/20 shadow-[0_10px_26px_rgba(0,0,0,0.22)] sm:mb-1.5 sm:rounded-[16px] ${aspectClass}`}
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
                  className="object-cover object-center scale-[1.015]"
                  sizes="(max-width: 639px) 19vw, (max-width: 1023px) 16vw, (max-width: 1535px) 8.5vw, 7vw"
                  priority={eager}
                  loading={eager ? "eager" : "lazy"}
                  eager={eager}
                  quality={64}
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
