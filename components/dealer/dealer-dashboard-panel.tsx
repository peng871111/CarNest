"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getDealerApplicationByUserId } from "@/lib/data";
import { DealerApplication } from "@/types";

export function DealerDashboardPanel() {
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
    return <p className="text-sm text-ink/60">Loading dealer dashboard...</p>;
  }

  const businessName = application?.legalBusinessName || application?.tradingName || "Dealer business details pending";
  const status = appUser?.dealerStatus ?? application?.status ?? "approved";

  return (
    <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
      <p className="text-xs uppercase tracking-[0.28em] text-bronze">Dealer</p>
      <h1 className="mt-4 font-display text-4xl text-ink">Dealer Dashboard</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
        Welcome to your dealer workspace. Your approved dealer tools and listing actions are available below.
      </p>

      <div className="mt-6 grid gap-3 rounded-[24px] border border-black/5 bg-shell px-5 py-4 text-sm text-ink/65 md:grid-cols-2">
        <p>Status: {status.replaceAll("_", " ")}</p>
        <p>Business: {businessName}</p>
        {application?.contactEmail ? <p>Contact email: {application.contactEmail}</p> : null}
        {application?.licenceState || application?.lmctNumber ? (
          <p>Licence: {[application.lmctNumber, application.licenceState].filter(Boolean).join(" · ")}</p>
        ) : null}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Link href="/seller/vehicles/new" className="rounded-[24px] border border-black/5 bg-white p-5 text-sm font-semibold text-ink shadow-panel transition hover:-translate-y-0.5">
          Add vehicle
        </Link>
        <Link href="/seller/vehicles" className="rounded-[24px] border border-black/5 bg-white p-5 text-sm font-semibold text-ink shadow-panel transition hover:-translate-y-0.5">
          My vehicles
        </Link>
        <Link href="/dashboard/settings" className="rounded-[24px] border border-black/5 bg-white p-5 text-sm font-semibold text-ink shadow-panel transition hover:-translate-y-0.5">
          Account details
        </Link>
      </div>
    </section>
  );
}
