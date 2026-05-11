"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { ADMIN_LINKS } from "@/lib/constants";
import { useAuth } from "@/lib/auth";
import { canAccessRole, hasAdminPermission } from "@/lib/permissions";
import {
  getComplianceAlertsData,
  getContactMessagesData,
  getDealerApplicationsData,
  getInspectionRequestsData,
  getOffersData,
  getPricingRequestsData,
  getQuotesData,
  getVehiclesData
} from "@/lib/data";
import { AdminPermissionKey } from "@/types";
import { cn } from "@/lib/utils";
import { WorkspaceHeader } from "@/components/layout/workspace-header";

function formatBadgeCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

export function AdminShell({
  title,
  description,
  children,
  requiredPermission
}: {
  title: string;
  description: string;
  children: ReactNode;
  requiredPermission?: AdminPermissionKey;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { appUser, loading } = useAuth();
  const hasWorkspaceAccess = canAccessRole("admin", appUser?.role);
  const hasPagePermission = requiredPermission ? hasAdminPermission(appUser, requiredPermission) : true;
  const visibleLinks = ADMIN_LINKS.filter((link) => !link.permission || hasAdminPermission(appUser, link.permission));
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!loading && !hasWorkspaceAccess) {
      router.replace(appUser ? "/dashboard" : `/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [appUser, hasWorkspaceAccess, loading, pathname, router]);

  useEffect(() => {
    let cancelled = false;

    async function loadBadgeCounts() {
      if (loading || !hasWorkspaceAccess) return;

      const [vehiclesResult, enquiriesResult, offersResult, inspectionsResult, quotesResult, pricingResult, complianceResult, dealerApplicationsResult] = await Promise.all([
        getVehiclesData(),
        getContactMessagesData(),
        getOffersData(),
        getInspectionRequestsData(),
        getQuotesData(),
        getPricingRequestsData(),
        getComplianceAlertsData(),
        getDealerApplicationsData()
      ]);

      if (cancelled) return;

      setBadgeCounts({
        "/admin/vehicles": vehiclesResult.items.filter((vehicle) => vehicle.status === "pending").length,
        "/admin/enquiries": enquiriesResult.items.filter((item) => item.status === "NEW").length,
        "/admin/offers": offersResult.items.filter((item) => item.status === "pending").length,
        "/admin/inspections": inspectionsResult.items.filter((item) => item.status === "NEW").length,
        "/admin/quotes": quotesResult.items.filter((item) => item.status === "NEW").length,
        "/admin/pricing": pricingResult.items.filter((item) => item.status === "NEW").length,
        "/admin/dealer-applications": dealerApplicationsResult.items.filter((item) => item.status === "pending" || item.status === "info_requested").length,
        "/admin/users": complianceResult.items.filter((item) => item.status === "open").length
      });
    }

    void loadBadgeCounts();

    return () => {
      cancelled = true;
    };
  }, [hasWorkspaceAccess, loading]);

  if (loading) {
    return <main className="mx-auto max-w-7xl px-6 py-16 text-sm text-ink/60">Loading admin area...</main>;
  }

  if (!hasWorkspaceAccess) return null;

  return (
    <div>
      <WorkspaceHeader workspaceLabel="ADMIN" />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-10 md:px-6 md:py-16 lg:grid-cols-[240px,1fr] lg:gap-8">
        <aside className="rounded-[24px] border border-black/5 bg-white p-4 shadow-panel md:rounded-[28px] md:p-5">
          <p className="text-xs uppercase tracking-[0.32em] text-bronze">Admin</p>
          <div className="mt-6 space-y-2">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center justify-between rounded-2xl px-4 py-3 text-sm text-ink/65 transition hover:bg-shell hover:text-ink",
                  pathname === link.href && "bg-shell text-ink"
                )}
              >
                <span>{link.label}</span>
                {badgeCounts[link.href] > 0 ? (
                  <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[#B42318] px-2 py-0.5 text-[11px] font-semibold text-white">
                    {formatBadgeCount(badgeCounts[link.href])}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </aside>
        <section className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-bronze">Vehicle management</p>
            <h1 className="mt-2 font-display text-3xl text-ink md:text-5xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">{description}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.22em] text-ink/45">Admin access</p>
          </div>
          {hasPagePermission ? (
            children
          ) : (
            <div className="rounded-[28px] border border-black/5 bg-white p-8 shadow-panel">
              <p className="text-xs uppercase tracking-[0.28em] text-bronze">Restricted</p>
              <h2 className="mt-3 font-display text-3xl text-ink">This area is reserved for a higher admin permission level.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">
                Your account can still use the admin workspace, but this section is limited to authorized internal staff.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
