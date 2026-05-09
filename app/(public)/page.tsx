import Link from "next/link";
import { Metadata } from "next";
import { SoldHeroCollage } from "@/components/marketing/sold-hero-collage";
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
    <main className="-mx-6 -mt-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationStructuredData) }}
      />
      <section className="relative isolate left-1/2 right-1/2 w-screen -translate-x-1/2 overflow-hidden bg-[#030405]">
        <SoldHeroCollage vehicles={soldVehicles} />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,4,5,0.16)_0%,rgba(3,4,5,0.24)_10%,rgba(3,4,5,0.48)_22%,rgba(3,4,5,0.76)_50%,rgba(3,4,5,0.92)_76%,rgba(3,4,5,0.99)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(214,171,92,0.16),transparent_18%),radial-gradient(circle_at_16%_34%,rgba(0,0,0,0.82),transparent_32%),radial-gradient(circle_at_72%_24%,rgba(0,0,0,0.34),transparent_28%),radial-gradient(circle_at_96%_28%,rgba(0,0,0,0.24),transparent_30%),radial-gradient(circle_at_center,transparent_12%,rgba(0,0,0,0.12)_44%,rgba(0,0,0,0.68)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#030405]/88 via-[#030405]/38 to-transparent md:h-40" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent via-[#030405]/55 to-shell md:h-44" />
        <div className="absolute inset-y-0 left-0 w-full bg-[linear-gradient(90deg,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.82)_14%,rgba(0,0,0,0.52)_30%,rgba(0,0,0,0.16)_50%,rgba(0,0,0,0.08)_72%,rgba(0,0,0,0.16)_100%)] md:w-[68%]" />
        <div className="absolute inset-y-0 left-0 w-full bg-[radial-gradient(circle_at_42%_34%,rgba(0,0,0,0.02),rgba(0,0,0,0.86)_100%)] md:hidden" />
        <div className="relative mx-auto flex min-h-[33rem] max-w-7xl items-end px-6 pb-12 pt-24 md:min-h-[42rem] md:items-center md:pb-20 md:pt-20">
          <div className="relative w-full max-w-4xl">
            <div className="absolute inset-y-0 left-0 w-full rounded-[30px] bg-[radial-gradient(circle_at_top_left,rgba(196,152,79,0.16),transparent_24%),linear-gradient(90deg,rgba(2,2,2,0.66)_0%,rgba(2,2,2,0.44)_46%,rgba(2,2,2,0.12)_100%)] opacity-100 backdrop-blur-[14px] md:w-[46rem]" />
            <div className="relative flex max-w-4xl flex-col items-center space-y-6 rounded-[30px] px-5 py-7 text-center shadow-[0_24px_80px_rgba(0,0,0,0.26)] md:max-w-[44rem] md:items-start md:px-8 md:py-10 md:text-left">
              <p className="text-sm uppercase tracking-[0.35em] text-bronze">
                A more transparent way to buy and sell cars
              </p>
              <h1 className="max-w-3xl font-display text-5xl leading-[0.96] text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.55)] md:text-7xl">
                Buy and sell cars with confidence
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-white md:text-[1.15rem]">
                Browse verified private listings, book inspections, and deal directly with owners.
              </p>
              <div className="flex flex-wrap justify-center gap-4 pt-2 md:justify-start">
                <Link
                  href="/sell"
                  className="rounded-full bg-white px-8 py-4 text-base font-semibold text-ink shadow-[0_16px_34px_rgba(0,0,0,0.34)] transition duration-200 hover:-translate-y-0.5 hover:bg-white/92 hover:shadow-[0_22px_40px_rgba(0,0,0,0.42)]"
                >
                  Sell your car
                </Link>
                <Link
                  href="/inventory"
                  className="rounded-full border border-white/28 bg-white/8 px-8 py-4 text-base font-semibold text-white shadow-[0_16px_34px_rgba(0,0,0,0.2)] transition duration-200 hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/14 hover:shadow-[0_22px_40px_rgba(0,0,0,0.28)]"
                >
                  Browse cars
                </Link>
              </div>
              <p className="max-w-3xl text-sm leading-7 text-white/92">
                we simply help arrange the viewing. You deal directly with the owner if you proceed.
              </p>
            </div>
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
