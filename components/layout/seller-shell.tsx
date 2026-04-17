"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { SELLER_LINKS } from "@/lib/constants";
import { useAuth } from "@/lib/auth";
import { getSellerOffersData } from "@/lib/data";
import { canAccessRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { UserRole } from "@/types";

function formatBadgeCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

export function SellerShell({
  title,
  description,
  children,
  allowedRoles = ["seller"]
}: {
  title: string;
  description: string;
  children: ReactNode;
  allowedRoles?: UserRole[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { appUser, loading } = useAuth();
  const workspaceHomeHref = appUser?.role === "admin" || appUser?.role === "super_admin" ? "/admin/vehicles" : "/seller/vehicles";
  const hasWorkspaceAccess = canAccessRole(allowedRoles, appUser?.role);
  const [offersBadgeCount, setOffersBadgeCount] = useState(0);

  useEffect(() => {
    if (!loading && !hasWorkspaceAccess) {
      router.replace(appUser ? workspaceHomeHref : `/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [appUser, hasWorkspaceAccess, loading, pathname, router, workspaceHomeHref]);

  useEffect(() => {
    let cancelled = false;

    async function loadOffersBadge() {
      if (loading || !hasWorkspaceAccess || !appUser || appUser.role === "admin" || appUser.role === "super_admin") {
        setOffersBadgeCount(0);
        return;
      }

      const result = await getSellerOffersData(appUser.id);
      if (cancelled) return;

      setOffersBadgeCount(result.items.filter((offer) => offer.status === "new").length);
    }

    void loadOffersBadge();

    return () => {
      cancelled = true;
    };
  }, [appUser, hasWorkspaceAccess, loading]);

  if (loading) {
    return <main className="mx-auto max-w-7xl px-6 py-16 text-sm text-ink/60">Loading account area...</main>;
  }

  if (!hasWorkspaceAccess) return null;

  return (
    <div>
      <WorkspaceHeader workspaceLabel="ACCOUNT" />
      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-[240px,1fr]">
        <aside className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
          <p className="text-xs uppercase tracking-[0.32em] text-bronze">Account</p>
          <div className="mt-6 space-y-2">
            {SELLER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center justify-between rounded-2xl px-4 py-3 text-sm text-ink/65 transition hover:bg-shell hover:text-ink",
                  pathname === link.href && "bg-shell text-ink"
                )}
              >
                <span>{link.label}</span>
                {link.href === "/seller/offers" && offersBadgeCount > 0 ? (
                  <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[#B42318] px-2 py-0.5 text-[11px] font-semibold text-white">
                    {formatBadgeCount(offersBadgeCount)}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </aside>
        <section className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-bronze">Account workspace</p>
            <h1 className="mt-2 font-display text-5xl text-ink">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">{description}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.22em] text-ink/45">Private access: your own activity only</p>
          </div>
          {children}
        </section>
      </main>
    </div>
  );
}
