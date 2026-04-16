const SELLER_STEPS = [
  "Submit your vehicle",
  "Choose your selling approach",
  "Connect with buyers or request support"
];

const BUYER_STEPS = [
  "Browse available vehicles",
  "Review vehicle details",
  "Submit an offer or enquiry",
  "Arrange inspection directly or through the seller flow"
];

export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-20">
      <section className="rounded-[36px] border border-black/5 bg-hero-glow p-10 shadow-panel">
        <p className="text-sm uppercase tracking-[0.35em] text-bronze">How CarNest Works</p>
        <h1 className="mt-4 font-display text-5xl text-ink">How CarNest Works</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-ink/68">
          CarNest is designed to make private vehicle transactions feel more deliberate, more transparent, and easier to manage on both sides of the sale.
        </p>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-2">
        <article className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
          <p className="text-sm uppercase tracking-[0.35em] text-bronze">For Sellers</p>
          <h2 className="mt-4 text-3xl font-semibold text-ink">A guided path to market</h2>
          <div className="mt-6 space-y-4">
            {SELLER_STEPS.map((step, index) => (
              <div key={step} className="rounded-[22px] border border-black/5 bg-shell px-5 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-bronze">Step {index + 1}</p>
                <p className="mt-2 text-sm font-medium text-ink">{step}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
          <p className="text-sm uppercase tracking-[0.35em] text-bronze">For Buyers</p>
          <h2 className="mt-4 text-3xl font-semibold text-ink">A clearer buying experience</h2>
          <div className="mt-6 space-y-4">
            {BUYER_STEPS.map((step, index) => (
              <div key={step} className="rounded-[22px] border border-black/5 bg-shell px-5 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-bronze">Step {index + 1}</p>
                <p className="mt-2 text-sm font-medium text-ink">{step}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
