import { SellFlow } from "@/components/forms/sell-flow";
import { ProtectedActionLink } from "@/components/auth/protected-action-link";

export default function SellPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <section className="rounded-[36px] bg-[#111111] px-8 py-12 text-[#F5F5F5] shadow-panel md:px-12">
        <p className="text-xs uppercase tracking-[0.32em] text-[#C6A87D]">Sell with CarNest</p>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr,0.72fr]">
          <div>
            <h1 className="font-display text-5xl leading-tight">A structured seller intake, built for premium vehicles.</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#F5F5F5]/72">
              Submit your vehicle through a guided four-step flow with uppercase-normalized data, image uploads, and a listing pathway that feeds straight into CarNest review.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[24px] border border-white/10 bg-[#171717] p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-[#C6A87D]">Structured fields</p>
              <p className="mt-3 text-sm leading-6 text-[#F5F5F5]/72">
                Make, year, body type, fuel type, and transmission are all captured with consistent dropdown inputs.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-[#171717] p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-[#C6A87D]">Seller review queue</p>
              <p className="mt-3 text-sm leading-6 text-[#F5F5F5]/72">
                Submissions from this flow save as pending seller vehicles so the current admin approval workflow stays intact.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.28em] text-bronze">Manual support</p>
            <h2 className="mt-3 font-display text-3xl text-ink">Not sure how to price your car?</h2>
            <p className="mt-4 text-sm leading-6 text-ink/65">
              Get personalised pricing advice from our team based on real market demand.
            </p>
          </div>
          <ProtectedActionLink
            href="/pricing-advice?action=pricing"
            action="pricing"
            className="inline-flex rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#17212a]"
          >
            Request Pricing Advice
          </ProtectedActionLink>
        </div>
      </section>

      <section className="mt-10">
        <SellFlow />
      </section>
    </main>
  );
}
