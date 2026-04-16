"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { WorkspaceHeader } from "@/components/layout/workspace-header";

export default function DashboardPage() {
  const { appUser, loading, authError } = useAuth();

  const destinations = useMemo(() => {
    if (!appUser) return [];
    if (appUser.role === "admin" || appUser.role === "super_admin") {
      return [
        { href: "/admin/vehicles", label: "Admin Vehicles" },
        { href: "/admin/offers", label: "Admin Offers" }
      ];
    }
    if (appUser.role === "seller") {
      return [
        { href: "/seller/vehicles", label: "My Vehicles" },
        { href: "/seller/offers", label: "My Offers" },
        { href: "/pricing-advice", label: "Pricing Advice" }
      ];
    }
    return [
      { href: "/inventory", label: "Browse Inventory" },
      { href: "/dashboard/saved", label: "Saved Vehicles" }
    ];
  }, [appUser]);

  return (
    <div>
      <WorkspaceHeader workspaceLabel="DASHBOARD" />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
          {loading ? (
            <p className="text-sm text-ink/65">Loading dashboard...</p>
          ) : authError ? (
            <>
              <p className="text-xs uppercase tracking-[0.28em] text-bronze">Dashboard</p>
              <h1 className="mt-4 font-display text-4xl text-ink">Live data is temporarily unavailable</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
                We’re having trouble loading live data right now. Please check your connection and try again.
              </p>
              <div className="mt-8">
                <Link href="/dashboard" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
                  Retry
                </Link>
              </div>
            </>
          ) : !appUser ? (
            <>
              <p className="text-xs uppercase tracking-[0.28em] text-bronze">Dashboard</p>
              <h1 className="mt-4 font-display text-4xl text-ink">Sign in to continue</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
                Your dashboard destination depends on your CarNest role. Log in to open your management area.
              </p>
              <div className="mt-8">
                <Link href="/login" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
                  Go to Login
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs uppercase tracking-[0.28em] text-bronze">Dashboard</p>
              <h1 className="mt-4 font-display text-4xl text-ink">Welcome back, {appUser.displayName}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
                You are signed in as a {appUser.role}. Use the links below to jump into the right CarNest workspace.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                {destinations.map((destination) => (
                  <Link
                    key={destination.href}
                    href={destination.href}
                    className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#17212a]"
                  >
                    {destination.label}
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
