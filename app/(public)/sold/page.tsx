import Link from "next/link";
import { Metadata } from "next";
import { getPublicSoldVehicles } from "@/lib/data";
import { getVehicleImage } from "@/lib/permissions";
import { ImageWatermark } from "@/components/vehicles/image-watermark";
import { PublicVehicleImage } from "@/components/vehicles/public-vehicle-image";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sold cars",
  description: "Browse a selection of cars sold through CarNest and see the standard of vehicles moving through the platform.",
  alternates: {
    canonical: "/sold"
  }
};

export default async function SoldVehiclesPage() {
  const { vehicles, error } = await getPublicSoldVehicles();

  return (
    <main className="mx-auto max-w-7xl px-6 py-20">
      <section className="rounded-[36px] border border-black/5 bg-hero-glow p-10 shadow-panel">
        <p className="text-sm uppercase tracking-[0.35em] text-bronze">Cars Sold Through CarNest</p>
        <h1 className="mt-4 font-display text-5xl text-ink">Cars Sold Through CarNest</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-ink/68">
          A selection of vehicles successfully sold through the CarNest platform.
        </p>
      </section>

      <section className="mt-12">
        {vehicles.length ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {vehicles.map((vehicle) => (
              <article key={vehicle.id} className="overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-panel">
                <div className="relative h-48">
                  <PublicVehicleImage
                    src={getVehicleImage(vehicle)}
                    alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.variant} exterior photo on CarNest`.replace(/\s+/g, " ").trim()}
                    loading="lazy"
                    sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
                    className="object-cover"
                  />
                  <ImageWatermark />
                </div>
                <div className="space-y-3 p-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-bronze">Sold</p>
                    <h2 className="mt-2 text-xl font-semibold text-ink">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </h2>
                    <p className="mt-1 text-sm text-ink/55">{vehicle.variant}</p>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.12em] text-ink/58">
                    <span>{vehicle.mileage.toLocaleString()} km</span>
                    <span>{vehicle.transmission}</span>
                    <span>{vehicle.fuelType}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[32px] border border-dashed border-black/10 bg-white px-8 py-14 text-center shadow-panel">
            <p className="text-lg font-semibold text-ink">Live data is temporarily unavailable</p>
            <p className="mt-3 text-sm leading-6 text-ink/60">
              We’re having trouble loading live data right now. Please check your connection and try again.
            </p>
            <div className="mt-6">
              <Link href="/sold" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-ink/90">
                Retry
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-[32px] border border-dashed border-black/10 bg-white px-8 py-14 text-center shadow-panel">
            <p className="text-lg font-semibold text-ink">No sold vehicles published yet</p>
            <p className="mt-3 text-sm leading-6 text-ink/60">Completed sales will appear here as vehicles move through the CarNest selling journey.</p>
            <div className="mt-6">
              <Link href="/inventory" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-ink/90">
                Browse current vehicles
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
