import { Suspense } from "react";
import { Metadata } from "next";
import { PricingRequestForm } from "@/components/pricing/pricing-request-form";

export const metadata: Metadata = {
  title: "Request pricing advice",
  description: "Ask the CarNest team for personalised pricing advice based on live market demand."
};

export default function PricingAdvicePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <Suspense
        fallback={
          <div className="rounded-[32px] border border-black/5 bg-white p-8 text-sm text-ink/60 shadow-panel">
            Loading pricing advice...
          </div>
        }
      >
        <PricingRequestForm />
      </Suspense>
    </main>
  );
}
