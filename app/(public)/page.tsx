import Link from "next/link";
import { Metadata } from "next";
import { ImageWatermark } from "@/components/vehicles/image-watermark";
import { PublicVehicleImage } from "@/components/vehicles/public-vehicle-image";
import { getPublicSoldVehicles } from "@/lib/data";
import { getVehicleImage } from "@/lib/permissions";
import { buildAbsoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    absolute: "CarNest | Buy and sell cars with confidence"
  },
  description:
    "Helping sellers save time and buyers find cars they can trust. Browse quality vehicles, make offers, and request inspections on CarNest.",
  alternates: {
    canonical: "/"
  }
};

const VALUE_CARDS = [
  {
    title: "Structured selling approach",
    text: "Present vehicles clearly so buyers understand what they are seeing."
  },
  {
    title: "Pricing and strategy guidance",
    text: "Get support to position your vehicle with more confidence and clarity."
  },
  {
    title: "Flexible selling options",
    text: "List online or request secure warehouse storage for added support."
  }
];

const HOW_IT_WORKS_STEPS = [
  "Browse verified private listings",
  "Book an inspection at a time that suits you",
  "Meet the owner and proceed if it’s the right car"
];

export default async function HomePage() {
  const { vehicles: soldVehicles, error: soldVehiclesError } = await getPublicSoldVehicles();
  const soldStripVehicles = soldVehicles.slice(0, 8);
  const organizationStructuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "CarNest",
    url: buildAbsoluteUrl("/")
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationStructuredData) }}
      />
      <section className="bg-hero-glow">
        <div className="mx-auto max-w-7xl px-6 pb-14 pt-24">
          <div className="mx-auto flex max-w-4xl flex-col items-center space-y-6 text-center">
            <p className="text-sm uppercase tracking-[0.35em] text-bronze">
              A more transparent way to buy and sell cars
            </p>
            <h1 className="max-w-3xl font-display text-6xl leading-none text-ink">Buy and sell cars with confidence</h1>
            <p className="max-w-3xl text-lg leading-8 text-ink/70">
              Browse verified private listings, book inspections, and deal directly with owners.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-2">
              <Link
                href="/sell"
                className="rounded-full bg-ink px-8 py-4 text-base font-semibold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-ink/92 hover:shadow-lg"
              >
                Sell your car
              </Link>
              <Link
                href="/inventory"
                className="rounded-full border border-ink px-8 py-4 text-base font-semibold text-ink shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-white/70 hover:shadow-md"
              >
                Browse cars
              </Link>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-ink/58">
              we simply help arrange the viewing. You deal directly with the owner if you proceed.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm uppercase tracking-[0.35em] text-bronze">How it works</p>
          <h2 className="mt-3 font-display text-4xl text-ink">How it works</h2>
          <p className="mt-3 text-sm leading-7 text-ink/65">A simple way to inspect and buy with confidence</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <div key={step} className="rounded-[24px] border border-black/5 bg-white px-5 py-5 shadow-panel">
              <p className="text-xs uppercase tracking-[0.24em] text-bronze">Step {index + 1}</p>
              <h3 className="mt-3 text-lg font-semibold text-ink">{step}</h3>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="mb-8 max-w-3xl">
          <p className="text-sm uppercase tracking-[0.35em] text-bronze">Marketplace value</p>
          <h2 className="mt-3 font-display text-4xl text-ink">A better framework for buying and selling cars</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {VALUE_CARDS.map((card) => (
            <div key={card.title} className="rounded-[24px] border border-black/5 bg-white p-5 shadow-panel">
              <h3 className="text-xl font-semibold text-ink">{card.title}</h3>
              <p className="mt-3 max-w-sm text-sm leading-6 text-ink/65">{card.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="rounded-[32px] border border-black/5 bg-white p-6 shadow-panel">
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-xs uppercase tracking-[0.28em] text-bronze">Recently sold through CarNest</p>
            <Link href="/sold" className="text-sm font-medium text-ink/65 transition hover:text-bronze">
              View sold vehicles
            </Link>
          </div>
          {soldStripVehicles.length ? (
            <div className="flex gap-4 overflow-x-auto pb-1">
              {soldStripVehicles.map((vehicle) => (
                <article
                  key={vehicle.id}
                  className="min-w-[260px] shrink-0 overflow-hidden rounded-[22px] border border-black/5 bg-white shadow-panel"
                >
                  <div className="relative aspect-[16/10]">
                    <PublicVehicleImage
                      src={getVehicleImage(vehicle)}
                      alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.variant} exterior photo on CarNest`.replace(/\s+/g, " ").trim()}
                      loading="lazy"
                      sizes="260px"
                      className="object-cover"
                    />
                    <ImageWatermark />
                  </div>
                  <div className="space-y-2 p-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-bronze">Sold</p>
                      <h2 className="mt-1 text-sm font-semibold text-ink">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </h2>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : soldVehiclesError ? (
            <div className="rounded-[24px] border border-dashed border-black/10 bg-shell px-6 py-8 text-sm leading-6 text-ink/65">
              <p>We’re having trouble loading live data right now. Please check your connection and try again.</p>
              <div className="mt-4">
                <Link href="/" className="text-sm font-medium text-ink underline">
                  Retry
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-black/10 bg-shell px-6 py-8 text-sm leading-6 text-ink/65">
              Recently sold vehicles will appear here as completed listings move through the CarNest marketplace.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
