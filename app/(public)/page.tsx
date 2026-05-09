import Link from "next/link";
import { Metadata } from "next";
import { SoldHeroCollage } from "@/components/marketing/sold-hero-collage";
import { ImageWatermark } from "@/components/vehicles/image-watermark";
import { PublicVehicleImage } from "@/components/vehicles/public-vehicle-image";
import { getPublicSoldVehicles, listPublishedVehicles } from "@/lib/data";
import { getVehicleImage } from "@/lib/permissions";
import { buildAbsoluteUrl } from "@/lib/seo";
import { formatCurrency } from "@/lib/utils";

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
    title: "Free to use marketplace",
    text: "List, browse, and inspect without hidden platform fees layered into the process."
  },
  {
    title: "No hidden platform fees",
    text: "CarNest keeps the experience clear so pricing conversations stay between buyers and sellers."
  },
  {
    title: "Inspections arranged for genuine buyers",
    text: "We help organise serious inspection activity before direct seller connection takes place."
  }
];

const HOW_IT_WORKS_STEPS = [
  {
    title: "List your car",
    text: "Create a polished private listing with clear photos, pricing, and the right level of support."
  },
  {
    title: "Receive enquiries & inspections",
    text: "CarNest helps connect genuine buyers and coordinate vehicle inspections."
  },
  {
    title: "Transact directly",
    text: "Buyers and sellers proceed directly once the car and terms are right for both sides."
  }
];

const HERO_TRUST_FEATURES = [
  { label: "Verified Listings", icon: "shield" },
  { label: "Book Inspections", icon: "calendar" },
  { label: "Transact Directly", icon: "handshake" }
] as const;

function HeroTrustIcon({ kind }: { kind: (typeof HERO_TRUST_FEATURES)[number]["icon"] }) {
  if (kind === "shield") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4">
        <path d="M12 3 5.5 5.6v5.7c0 4.4 2.7 8.3 6.5 9.7 3.8-1.4 6.5-5.3 6.5-9.7V5.6L12 3Z" />
        <path d="m9.2 12 1.8 1.8 4-4.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === "calendar") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4">
        <path d="M7 3.5v3M17 3.5v3M4.5 8.5h15" strokeLinecap="round" />
        <rect x="4.5" y="5.5" width="15" height="14" rx="2.5" />
        <path d="M9 12h2M13 12h2M9 15.5h2M13 15.5h2" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4">
      <path d="M7.5 13.5 10 11a2.5 2.5 0 0 1 3.5 0l.5.5a2.5 2.5 0 0 0 3.5 0l1.5-1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m3.5 11 3-3a2.6 2.6 0 0 1 3.7 0l1.3 1.3M20.5 13l-3 3a2.6 2.6 0 0 1-3.7 0L12.5 14.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 10.5 5 8m14 8 2.5-2.5" strokeLinecap="round" />
    </svg>
  );
}

export default async function HomePage() {
  const { vehicles: soldVehicles, error: soldVehiclesError } = await getPublicSoldVehicles();
  const { vehicles: recentVehicles } = await listPublishedVehicles();
  const soldStripVehicles = soldVehicles.slice(0, 8);
  const recentHeroVehicles = recentVehicles.slice(0, 3);
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
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,4,5,0.28)_0%,rgba(3,4,5,0.36)_12%,rgba(3,4,5,0.64)_32%,rgba(3,4,5,0.86)_62%,rgba(3,4,5,0.97)_100%),linear-gradient(90deg,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.76)_22%,rgba(0,0,0,0.42)_48%,rgba(0,0,0,0.22)_100%)] md:bg-[linear-gradient(180deg,rgba(3,4,5,0.18)_0%,rgba(3,4,5,0.26)_10%,rgba(3,4,5,0.5)_24%,rgba(3,4,5,0.78)_52%,rgba(3,4,5,0.93)_78%,rgba(3,4,5,0.99)_100%),linear-gradient(90deg,rgba(0,0,0,0.94)_0%,rgba(0,0,0,0.84)_14%,rgba(0,0,0,0.58)_30%,rgba(0,0,0,0.26)_48%,rgba(0,0,0,0.12)_68%,rgba(0,0,0,0.18)_100%)]" />
        <div className="absolute inset-0 hidden md:block md:bg-[radial-gradient(circle_at_top,rgba(214,171,92,0.16),transparent_18%),radial-gradient(circle_at_16%_34%,rgba(0,0,0,0.8),transparent_34%),radial-gradient(circle_at_40%_56%,rgba(0,0,0,0.22),transparent_24%),radial-gradient(circle_at_72%_24%,rgba(0,0,0,0.3),transparent_30%),radial-gradient(circle_at_96%_28%,rgba(0,0,0,0.22),transparent_34%),radial-gradient(circle_at_center,transparent_10%,rgba(0,0,0,0.14)_42%,rgba(0,0,0,0.68)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#030405]/88 via-[#030405]/38 to-transparent md:h-40" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent via-[#030405]/55 to-shell md:h-44" />
        <div className="relative mx-auto flex min-h-[33rem] max-w-7xl items-end px-6 pb-12 pt-24 md:min-h-[42rem] md:items-center md:pb-20 md:pt-20">
          <div className="grid w-full items-center gap-8 lg:grid-cols-[minmax(0,44rem)_minmax(16rem,19rem)] lg:gap-16 xl:gap-20">
            <div className="relative w-full max-w-4xl">
              <div className="absolute inset-y-0 left-0 w-full rounded-[30px] bg-[linear-gradient(180deg,rgba(2,2,2,0.76)_0%,rgba(2,2,2,0.62)_100%)] opacity-100 md:w-[46rem] md:bg-[radial-gradient(circle_at_top_left,rgba(196,152,79,0.16),transparent_24%),linear-gradient(90deg,rgba(2,2,2,0.66)_0%,rgba(2,2,2,0.44)_46%,rgba(2,2,2,0.12)_100%)] md:backdrop-blur-[14px]" />
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
                    className="rounded-full border border-white/20 bg-white/10 px-8 py-4 text-base font-semibold text-white shadow-[0_16px_34px_rgba(0,0,0,0.2)] transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/15 hover:shadow-[0_22px_40px_rgba(0,0,0,0.28)]"
                  >
                    Browse cars
                  </Link>
                </div>
                <div className="grid w-full max-w-3xl grid-cols-1 gap-3 text-left sm:grid-cols-2 md:grid-cols-3">
                  {HERO_TRUST_FEATURES.map((feature) => (
                    <div
                      key={feature.label}
                      className="flex items-center gap-3 rounded-full border border-[#C6A87D]/28 bg-black/32 px-4 py-3 text-sm text-white md:bg-black/18 md:backdrop-blur-[8px]"
                    >
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#C6A87D]/55 text-[#C6A87D]">
                        <HeroTrustIcon kind={feature.icon} />
                      </span>
                      <span className="font-semibold tracking-[0.01em] text-bronze">{feature.label}</span>
                    </div>
                  ))}
                </div>
                <p className="relative z-10 max-w-3xl text-sm leading-7 text-white">
                  we simply help arrange the viewing. You deal directly with the owner if you proceed.
                </p>
              </div>
            </div>
            {recentHeroVehicles.length ? (
              <div className="hidden self-center lg:flex lg:flex-col lg:gap-3">
                <div className="rounded-[26px] border border-white/10 bg-black/34 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur-[10px]">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-bronze">Recently Added</p>
                  <div className="mt-4 space-y-3">
                    {recentHeroVehicles.map((vehicle) => (
                      <Link
                        key={vehicle.id}
                        href={`/inventory/${vehicle.id}`}
                        className="group flex items-center gap-3 rounded-[20px] border border-white/8 bg-black/28 p-2.5 transition hover:border-[#C6A87D]/35 hover:bg-black/38"
                      >
                        <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-[16px] border border-white/8 bg-black/30">
                          <PublicVehicleImage
                            src={getVehicleImage(vehicle)}
                            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} recently added on CarNest`}
                            loading="lazy"
                            sizes="96px"
                            className="object-cover object-center transition duration-300 group-hover:scale-[1.02]"
                          />
                          <ImageWatermark />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] uppercase tracking-[0.24em] text-bronze/88">New listing</p>
                          <h2 className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-white">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </h2>
                          <p className="mt-2 text-sm font-medium text-white">{formatCurrency(vehicle.price)}</p>
                          <p className="mt-1 text-xs text-white/70">{vehicle.mileage.toLocaleString()} km</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
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

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="rounded-[28px] border border-[#C6A87D]/14 bg-[#141414] px-5 py-5 text-white shadow-[0_20px_44px_rgba(0,0,0,0.12)]">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-bronze">Private seller marketplace</p>
              <p className="mt-2 text-sm leading-6 text-white/72">
                Private seller marketplace where inspections are arranged first and buyers transact directly with sellers when ready.
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-bronze">Independent mechanic inspections welcome</p>
              <p className="mt-2 text-sm leading-6 text-white/72">Serious buyers are encouraged to inspect properly before proceeding.</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-bronze">Warehouse-assisted verification</p>
              <p className="mt-2 text-sm leading-6 text-white/72">Ownership verification is required for vehicles receiving warehouse support.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm uppercase tracking-[0.35em] text-bronze">How it works</p>
          <h2 className="mt-3 font-display text-4xl text-ink">How it works</h2>
          <p className="mt-3 text-sm leading-7 text-ink/65">
            A calm private marketplace flow where inspections are arranged first and the transaction stays between buyer and seller.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-[repeat(3,minmax(0,1fr))] xl:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,0.9fr)]">
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <div key={step.title} className="rounded-[24px] border border-black/5 bg-white px-5 py-5 shadow-panel">
              <p className="text-xs uppercase tracking-[0.24em] text-bronze">Step {index + 1}</p>
              <h3 className="mt-3 text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-ink/62">{step.text}</p>
            </div>
          ))}
          <div className="rounded-[24px] border border-[#C6A87D]/20 bg-[#141414] px-5 py-5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.14)]">
            <p className="text-xs uppercase tracking-[0.24em] text-bronze">Optional</p>
            <h3 className="mt-3 text-lg font-semibold">Warehouse assistance available</h3>
            <p className="mt-3 text-sm leading-6 text-white/72">
              Available for selected vehicles, CarNest can assist with presentation, storage, and inspection logistics while the vehicle remains privately owned.
            </p>
          </div>
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
    </main>
  );
}
