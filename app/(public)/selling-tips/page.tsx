import Link from "next/link";
import { Metadata } from "next";
import { ProtectedActionLink } from "@/components/auth/protected-action-link";
import { SELLING_TIPS } from "@/lib/selling-tips";

export const metadata: Metadata = {
  title: "Car selling tips",
  description: "Helpful CarNest guides for pricing, photos, paperwork, listing quality, and stronger private-sale preparation.",
  alternates: {
    canonical: "/selling-tips"
  }
};

export default function SellingTipsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <section className="rounded-[36px] border border-black/5 bg-hero-glow p-10 shadow-panel">
        <p className="text-sm uppercase tracking-[0.35em] text-bronze">Selling Tips</p>
        <h1 className="mt-4 font-display text-5xl text-ink">Practical advice for selling your car with more confidence</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-ink/68">
          A growing collection of simple guides to help sellers prepare stronger listings, present vehicles well, and navigate negotiation more clearly.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/sell" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-ink/90">
            Start selling
          </Link>
          <ProtectedActionLink
            href="/pricing-advice"
            action="pricing"
            className="rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-ink transition hover:border-black/15 hover:bg-shell"
          >
            Request pricing advice
          </ProtectedActionLink>
        </div>
      </section>

      <section className="mt-12 grid gap-5">
        {SELLING_TIPS.map((tip) => (
          <article key={tip.slug} id={tip.slug} className="rounded-[28px] border border-black/5 bg-white p-8 shadow-panel">
            <p className="text-xs uppercase tracking-[0.24em] text-bronze">Tip</p>
            <h2 className="mt-3 text-2xl font-semibold text-ink">{tip.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">{tip.summary}</p>
            <div className="mt-5 space-y-4">
              {tip.body.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-7 text-ink/72">
                  {paragraph}
                </p>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
