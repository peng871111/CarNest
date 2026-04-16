import { Metadata } from "next";
import { InventoryBrowser } from "@/components/vehicles/inventory-browser";
import { listPublishedVehicles } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Browse cars for sale",
  description:
    "Browse cars for sale on CarNest. Explore private listings and warehouse vehicles with transparent presentation and direct actions.",
  alternates: {
    canonical: "/inventory"
  }
};

const INVENTORY_FAQS = [
  {
    question: "Can I inspect a car before buying?",
    answer: "Yes. Buyers can review listing details, make an offer, and request inspections where available through CarNest."
  },
  {
    question: "Are warehouse vehicles available for inspection?",
    answer: "Yes. Warehouse vehicles can be booked for inspection through CarNest so the process stays coordinated and clear."
  },
  {
    question: "Can I submit an offer directly through CarNest?",
    answer: "Yes. Logged-in buyers can submit offers directly on eligible listings through the vehicle detail page."
  },
  {
    question: "Does CarNest own the cars listed on the platform?",
    answer: "No. CarNest is a platform connecting private buyers and sellers unless explicitly stated otherwise."
  },
  {
    question: "What is the difference between a warehouse vehicle and a private listing?",
    answer: "Warehouse vehicles are stored with CarNest and presented with coordinated inspections, while private listings remain seller-managed."
  }
];

export default async function InventoryPage() {
  const { vehicles, source, error } = await listPublishedVehicles();
  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: INVENTORY_FAQS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
      }
    }))
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
      <div className="mb-10">
        <p className="text-sm uppercase tracking-[0.35em] text-bronze">Inventory</p>
        <h1 className="mt-3 font-display text-5xl text-ink">Discover listed vehicles</h1>
        <p className="mt-4 max-w-2xl text-ink/65">Warehouse Vehicle and Online Listing inventory are presented with different visibility rules so buyers immediately understand how each car is managed.</p>
      </div>
      {error ? (
        <div className="mb-8 rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
          We’re having trouble loading live data right now. Please check your connection and try again.
        </div>
      ) : null}
      <InventoryBrowser vehicles={vehicles} source={source} />

      <section className="mt-16 rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
        <p className="text-sm uppercase tracking-[0.3em] text-bronze">Marketplace overview</p>
        <h2 className="mt-3 text-3xl font-semibold text-ink">A clearer way to discover cars for sale</h2>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-ink/68">
          CarNest is a marketplace for private sellers and buyers who want more transparency around vehicle presentation, inspection pathways,
          and next steps. Buyers can compare seller-managed listings with warehouse vehicles, submit direct offers, and move deeper into the
          process with clearer context around how each listing is managed.
        </p>
      </section>

      <section className="mt-10 rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
        <p className="text-sm uppercase tracking-[0.3em] text-bronze">Frequently asked questions</p>
        <div className="mt-5 space-y-4">
          {INVENTORY_FAQS.map((item) => (
            <div key={item.question} className="rounded-[24px] border border-black/5 bg-shell px-5 py-4">
              <h3 className="text-base font-semibold text-ink">{item.question}</h3>
              <p className="mt-2 text-sm leading-6 text-ink/65">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
