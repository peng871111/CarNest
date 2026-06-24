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

const TRUST_FEATURES = [
  {
    title: "CarNest Verified",
    text: "Quality assured",
    icon: "shield"
  },
  {
    title: "Independent Inspections",
    text: "Vehicle Condition Summary",
    icon: "inspection"
  },
  {
    title: "Direct Owner Transactions",
    text: "Deal with owners",
    icon: "handshake"
  },
  {
    title: "Transparent Fees",
    text: "No hidden costs",
    icon: "dollar"
  }
] as const;

const HERO_TRUST_FEATURES = [
  { label: "CarNest Verified", icon: "shield" },
  { label: "Vehicle Condition Summary", icon: "inspection" },
  { label: "Direct Owner Transactions", icon: "handshake" }
] as const;

const STATIC_STATS = [
  {
    label: "Seller Satisfaction",
    value: "98%",
    icon: "users"
  },
  {
    label: "Average Response Time",
    value: "24h",
    icon: "clock"
  }
] as const;

function FeatureIcon({ kind, className = "h-5 w-5" }: { kind: string; className?: string }) {
  if (kind === "shield") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
        <path d="M12 3 5.5 5.6v5.7c0 4.4 2.7 8.3 6.5 9.7 3.8-1.4 6.5-5.3 6.5-9.7V5.6L12 3Z" />
        <path d="m9.2 12 1.8 1.8 4-4.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === "inspection") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
        <path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H14" />
        <path d="M8 8.5h6M8 12h4" strokeLinecap="round" />
        <path d="m16.5 15.5 1.8 1.8 3.2-3.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="17.5" cy="16.5" r="4.5" />
      </svg>
    );
  }

  if (kind === "handshake") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
        <path d="M7.5 13.5 10 11a2.5 2.5 0 0 1 3.5 0l.5.5a2.5 2.5 0 0 0 3.5 0l1.5-1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m3.5 11 3-3a2.6 2.6 0 0 1 3.7 0l1.3 1.3M20.5 13l-3 3a2.6 2.6 0 0 1-3.7 0L12.5 14.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2.5 10.5 5 8m14 8 2.5-2.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "dollar") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
        <circle cx="12" cy="12" r="9" />
        <path d="M14.5 9.2c0-1.2-1-2.2-2.5-2.2-1.4 0-2.5.9-2.5 2.1 0 1.1.8 1.8 2.4 2.2 1.7.4 2.6 1 2.6 2.3 0 1.3-1.2 2.2-2.8 2.2-1.7 0-2.8-.9-2.9-2.3" strokeLinecap="round" />
        <path d="M12 5.8v12.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "car") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
        <path d="m5 15 1.6-4.7A2 2 0 0 1 8.5 9h7a2 2 0 0 1 1.9 1.3L19 15" />
        <path d="M4.5 15.5h15v3a1 1 0 0 1-1 1h-1v-2h-11v2h-1a1 1 0 0 1-1-1v-3Z" />
        <circle cx="8" cy="15.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="16" cy="15.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (kind === "users") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
        <path d="M15.5 18.5v-.6a3.4 3.4 0 0 0-3.4-3.4H7.9a3.4 3.4 0 0 0-3.4 3.4v.6" strokeLinecap="round" />
        <circle cx="10" cy="8.5" r="3" />
        <path d="M19.5 18.5v-.4a3 3 0 0 0-2.4-2.9" strokeLinecap="round" />
        <path d="M16.7 5.8a2.7 2.7 0 0 1 0 5.4" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function HomePage() {
  const { vehicles: soldVehicles } = await getPublicSoldVehicles();
  const { vehicles: recentVehicles } = await listPublishedVehicles();
  const recentHeroVehicles = recentVehicles.slice(0, 3);
  const featuredVehicles = recentVehicles.slice(0, 5);
  const soldValue = soldVehicles.reduce((sum, vehicle) => sum + vehicle.price, 0);
  const stats = [
    {
      label: "Vehicle Value Sold",
      value: `${formatCurrency(soldValue || 0)}+`,
      icon: "dollar"
    },
    {
      label: "Verified Listings",
      value: `${recentVehicles.length}+`,
      icon: "car"
    },
    ...STATIC_STATS
  ];
  const organizationStructuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "CarNest",
    url: buildAbsoluteUrl("/")
  };

  return (
    <main className="-mx-6 -mt-10 overflow-hidden bg-[#040404] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationStructuredData) }}
      />

      <section className="relative isolate left-1/2 right-1/2 w-screen -translate-x-1/2 overflow-hidden border-b border-[#C6A87D]/10 bg-[#040404]">
        <SoldHeroCollage vehicles={soldVehicles} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_42%,rgba(198,168,125,0.22),transparent_20%),radial-gradient(circle_at_62%_50%,rgba(198,168,125,0.12),transparent_34%),linear-gradient(90deg,rgba(2,2,2,0.96)_0%,rgba(2,2,2,0.88)_24%,rgba(2,2,2,0.55)_48%,rgba(2,2,2,0.22)_72%,rgba(2,2,2,0.24)_100%),linear-gradient(180deg,rgba(2,2,2,0.34)_0%,rgba(2,2,2,0.5)_18%,rgba(2,2,2,0.78)_58%,rgba(2,2,2,0.98)_100%)]" />
        <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(circle_at_center,rgba(198,168,125,0.18)_0,transparent_44%),repeating-radial-gradient(circle_at_60%_45%,rgba(198,168,125,0.12)_0,rgba(198,168,125,0.12)_2px,transparent_2px,transparent_34px)]" />
        <div className="relative mx-auto flex min-h-[42rem] max-w-7xl items-center px-6 pb-20 pt-24 md:min-h-[48rem]">
          <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)] xl:gap-16">
            <div className="relative">
              <div className="absolute inset-0 rounded-[36px] bg-[linear-gradient(180deg,rgba(12,12,12,0.78),rgba(12,12,12,0.5))] blur-3xl" />
              <div className="relative max-w-3xl rounded-[36px] border border-white/8 bg-[linear-gradient(180deg,rgba(13,13,13,0.78),rgba(13,13,13,0.54))] px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-[10px] md:px-8 md:py-10">
                <p className="text-sm uppercase tracking-[0.34em] text-[#D9B36A]">Australia&apos;s trusted car marketplace</p>
                <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[0.94] text-white md:text-7xl">
                  Buy and sell cars
                  <br />
                  with <span className="text-[#D9B36A]">confidence</span>
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-white/72 md:text-[1.15rem]">
                  Verified listings, independent inspections, and direct owner transactions.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link
                    href="/inventory"
                    className="rounded-2xl bg-[#D9B36A] px-8 py-4 text-base font-semibold text-[#141414] shadow-[0_18px_38px_rgba(217,179,106,0.26)] transition hover:-translate-y-0.5 hover:bg-[#e3bf78]"
                  >
                    Browse Cars
                  </Link>
                  <Link
                    href="/sell"
                    className="rounded-2xl border border-[#D9B36A]/55 bg-black/20 px-8 py-4 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:border-[#D9B36A] hover:bg-white/5"
                  >
                    Sell Your Car
                  </Link>
                </div>
                <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {HERO_TRUST_FEATURES.map((feature) => (
                    <div
                      key={feature.label}
                      className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/24 px-4 py-3 text-sm text-white/88"
                    >
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D9B36A]/40 bg-[#D9B36A]/10 text-[#D9B36A]">
                        <FeatureIcon kind={feature.icon} className="h-4.5 w-4.5" />
                      </span>
                      <span className="font-medium text-white">{feature.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-7 flex items-center gap-3 text-sm text-white/82">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D9B36A]/40 bg-[#D9B36A]/10 text-[#D9B36A]">
                    <FeatureIcon kind="shield" className="h-4 w-4" />
                  </span>
                  <span>
                    Every car is <span className="text-[#D9B36A]">CarNest Verified</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden lg:flex lg:flex-col lg:gap-4">
              <div className="self-end rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,14,14,0.84),rgba(14,14,14,0.7))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-[10px]">
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#D9B36A]/45 bg-[#D9B36A]/10 text-[#D9B36A]">
                    <FeatureIcon kind="shield" className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-lg font-semibold text-white">Every car is CarNest Verified</p>
                    <p className="mt-1 text-sm leading-6 text-white/64">Quality assured.</p>
                  </div>
                </div>
              </div>

              {recentHeroVehicles.length ? (
                <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,14,14,0.82),rgba(14,14,14,0.68))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-[10px]">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#D9B36A]">Recently Added</p>
                  <div className="mt-4 space-y-3">
                    {recentHeroVehicles.map((vehicle) => (
                      <Link
                        key={vehicle.id}
                        href={`/inventory/${vehicle.id}`}
                        className="group flex items-center gap-3 rounded-[20px] border border-white/8 bg-black/28 p-2.5 transition hover:border-[#D9B36A]/35 hover:bg-black/38"
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
                          <p className="text-[10px] uppercase tracking-[0.24em] text-[#D9B36A]/88">New listing</p>
                          <h2 className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-white">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </h2>
                          <p className="mt-2 text-sm font-medium text-[#F0D296]">{formatCurrency(vehicle.price)}</p>
                          <p className="mt-1 text-xs text-white/70">{vehicle.mileage.toLocaleString()} km</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 bg-[#040404] pb-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,15,15,0.92),rgba(10,10,10,0.92))] p-4 shadow-[0_24px_64px_rgba(0,0,0,0.34)] md:p-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {TRUST_FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="flex items-center gap-4 rounded-[24px] border border-white/7 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] px-4 py-4"
                >
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#D9B36A]/45 bg-[#D9B36A]/10 text-[#D9B36A]">
                    <FeatureIcon kind={feature.icon} className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-white">{feature.title}</p>
                    <p className="mt-1 text-sm text-white/62">{feature.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,15,15,0.94),rgba(9,9,9,0.96))] p-4 shadow-[0_24px_64px_rgba(0,0,0,0.34)] md:p-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center gap-4 rounded-[24px] border border-white/7 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] px-4 py-5"
                >
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#D9B36A]/45 bg-[#D9B36A]/10 text-[#D9B36A]">
                    <FeatureIcon kind={stat.icon} className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-4xl font-semibold tracking-[-0.03em] text-white">{stat.value}</p>
                    <p className="mt-1 text-sm text-white/62">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.34em] text-[#D9B36A]">Featured Listings</p>
                <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">Recently Added</h2>
              </div>
              <Link href="/inventory" className="text-sm font-medium text-[#F0D296] transition hover:text-white">
                View all cars
              </Link>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {featuredVehicles.map((vehicle) => (
                <Link
                  key={vehicle.id}
                  href={`/inventory/${vehicle.id}`}
                  className="group overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(10,10,10,0.96))] shadow-[0_18px_42px_rgba(0,0,0,0.34)] transition hover:-translate-y-1 hover:border-[#D9B36A]/35"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-black/40">
                    <PublicVehicleImage
                      src={getVehicleImage(vehicle)}
                      alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.variant} exterior photo on CarNest`.replace(/\s+/g, " ").trim()}
                      loading="lazy"
                      sizes="(max-width: 1279px) 50vw, 20vw"
                      className="object-cover object-center transition duration-500 group-hover:scale-[1.04]"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.1)_35%,rgba(0,0,0,0.55)_100%)]" />
                    <ImageWatermark />
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-white">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </h3>
                    <p className="mt-3 text-2xl font-semibold text-[#F0D296]">{formatCurrency(vehicle.price)}</p>
                    <div className="mt-3 flex items-center justify-between gap-3 text-sm text-white/68">
                      <span>{vehicle.mileage.toLocaleString()} km</span>
                      <span className="inline-flex items-center gap-2 text-[#D9B36A]">
                        <FeatureIcon kind="shield" className="h-4 w-4" />
                        Verified
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-12 overflow-hidden rounded-[36px] border border-white/8 bg-[linear-gradient(90deg,rgba(14,14,14,0.98)_0%,rgba(14,14,14,0.95)_58%,rgba(10,10,10,0.72)_100%)] shadow-[0_28px_70px_rgba(0,0,0,0.34)]">
            <div className="grid gap-8 px-6 py-8 md:grid-cols-[minmax(0,1.1fr)_auto] md:items-center md:px-10 md:py-12">
              <div>
                <p className="text-sm uppercase tracking-[0.34em] text-[#D9B36A]">Ready to sell your car?</p>
                <h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-[-0.04em] text-white md:text-5xl">
                  List Your Car For Free Today
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-white/66">
                  Reach serious buyers with a premium listing experience built for trust, speed, and direct owner conversations.
                </p>
              </div>
              <div className="flex flex-col items-start gap-3 md:items-center">
                <Link
                  href="/sell"
                  className="rounded-2xl bg-[#D9B36A] px-8 py-4 text-base font-semibold text-[#141414] shadow-[0_18px_38px_rgba(217,179,106,0.26)] transition hover:-translate-y-0.5 hover:bg-[#e3bf78]"
                >
                  List My Car
                </Link>
                <p className="text-sm text-white/54">Quick. Easy. Effective.</p>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
