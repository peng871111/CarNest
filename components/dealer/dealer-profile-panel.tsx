"use client";

import { useEffect, useState } from "react";
import { DealerTermsGate } from "@/components/dealer/dealer-terms-gate";
import { useAuth } from "@/lib/auth";
import { getDealerApplicationByUserId } from "@/lib/data";
import { DealerApplication } from "@/types";

export function DealerProfilePanel() {
  const { appUser, loading } = useAuth();
  const [application, setApplication] = useState<DealerApplication | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadApplication() {
      if (!appUser?.id) return;
      const nextApplication = await getDealerApplicationByUserId(appUser.id).catch(() => null);
      if (!cancelled) setApplication(nextApplication);
    }

    void loadApplication();

    return () => {
      cancelled = true;
    };
  }, [appUser?.id]);

  if (loading) {
    return <p className="text-sm text-ink/60">Loading dealer profile...</p>;
  }

  return (
    <DealerTermsGate>
      <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
        <p className="text-xs uppercase tracking-[0.28em] text-bronze">Dealer profile</p>
        <h1 className="mt-4 font-display text-4xl text-ink">Shop Profile</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
          Your dealer business foundation for future shop visibility, branding, and paid plans.
        </p>

        <div className="mt-8 grid gap-4 rounded-[24px] border border-black/5 bg-shell px-5 py-4 text-sm text-ink/70 md:grid-cols-2">
          <p>Business: {application?.legalBusinessName || application?.tradingName || "Not provided"}</p>
          <p>Reference: {application?.referenceId || "Not available"}</p>
          <p>Contact: {application?.contactEmail || appUser?.email || "Not provided"}</p>
          <p>Phone: {application?.contactPhone || appUser?.phone || "Not provided"}</p>
          <p>Licence: {[application?.lmctNumber, application?.licenceState].filter(Boolean).join(" · ") || "Not provided"}</p>
          <p>Description / story: Internal profile story coming soon</p>
          <p>Location: {[application?.businessSuburb, application?.businessState].filter(Boolean).join(", ") || "Not provided"}</p>
          <p>Plan: {(application?.dealerPlan || appUser?.dealerPlan || "free").replaceAll("_", " ")}</p>
          <p>Max listings: {application?.maxListings ?? appUser?.maxListings ?? 3}</p>
          <p>Shop visible: {application?.shopPublicVisible || appUser?.shopPublicVisible ? "Yes" : "No"}</p>
          <p>Branding enabled: {application?.brandingEnabled || appUser?.brandingEnabled ? "Yes" : "No"}</p>
          <p>Contact display enabled: {application?.contactDisplayEnabled || appUser?.contactDisplayEnabled ? "Yes" : "No"}</p>
        </div>
      </section>
    </DealerTermsGate>
  );
}
