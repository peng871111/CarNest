"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
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

type AdminLinkConfig = (typeof ADMIN_LINKS)[number];

const MOBILE_PRIMARY_LINK_HREFS = new Set([
  "/admin",
  "/admin/vehicles",
  "/admin/customers",
  "/admin/warehouse-intake",
  "/admin/vehicles/add"
]);

const MOBILE_OPERATIONS_LINK_HREFS = new Set([
  "/admin/inspections",
  "/admin/enquiries",
  "/admin/pricing",
  "/admin/quotes",
  "/admin/offers"
]);

const MOBILE_COMPLIANCE_LINK_HREFS = new Set([
  "/admin/compliance",
  "/admin/dealer-applications"
]);

const MOBILE_ALWAYS_VISIBLE_SECONDARY_LINK_HREFS = new Set([
  "/admin/user-support"
]);

function MobileNavLink({
  link,
  active,
  badgeCount,
  onNavigate
}: {
  link: AdminLinkConfig;
  active: boolean;
  badgeCount: number;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center justify-between rounded-2xl px-4 py-3 text-sm transition",
        active ? "bg-shell text-ink" : "text-ink/68 hover:bg-shell hover:text-ink"
      )}
    >
      <span>{link.label}</span>
      {badgeCount > 0 ? (
        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[#B42318] px-2 py-0.5 text-[11px] font-semibold text-white">
          {formatBadgeCount(badgeCount)}
        </span>
      ) : null}
    </Link>
  );
}

function MobileNavGroup({
  label,
  links,
  pathname,
  badgeCounts,
  open,
  onToggle,
  onNavigate
}: {
  label: string;
  links: AdminLinkConfig[];
  pathname: string;
  badgeCounts: Record<string, number>;
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  if (!links.length) return null;

  const hasActiveChild = links.some((link) => pathname === link.href);

  return (
    <div className="rounded-[22px] border border-black/5 bg-shell/70 px-2 py-2">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition",
          hasActiveChild ? "text-ink" : "text-ink/72 hover:text-ink"
        )}
        aria-expanded={open}
      >
        <span>{label}</span>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}>
          <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div className="mt-1 space-y-1">
          {links.map((link) => (
            <MobileNavLink
              key={link.href}
              link={link}
              active={pathname === link.href}
              badgeCount={badgeCounts[link.href] ?? 0}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
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
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileNavGroups, setMobileNavGroups] = useState({
    operations: false,
    compliance: false,
    administration: false
  });

  const mobilePrimaryLinks = useMemo(
    () => visibleLinks.filter((link) => MOBILE_PRIMARY_LINK_HREFS.has(link.href)),
    [visibleLinks]
  );
  const mobileOperationsLinks = useMemo(
    () => visibleLinks.filter((link) => MOBILE_OPERATIONS_LINK_HREFS.has(link.href)),
    [visibleLinks]
  );
  const mobileComplianceLinks = useMemo(
    () => visibleLinks.filter((link) => MOBILE_COMPLIANCE_LINK_HREFS.has(link.href)),
    [visibleLinks]
  );
  const mobileStandaloneLinks = useMemo(
    () =>
      visibleLinks.filter(
        (link) =>
          !MOBILE_PRIMARY_LINK_HREFS.has(link.href)
          && !MOBILE_ALWAYS_VISIBLE_SECONDARY_LINK_HREFS.has(link.href)
          && !MOBILE_OPERATIONS_LINK_HREFS.has(link.href)
          && !MOBILE_COMPLIANCE_LINK_HREFS.has(link.href)
      ),
    [visibleLinks]
  );
  const mobileAlwaysVisibleSecondaryLinks = useMemo(
    () => visibleLinks.filter((link) => MOBILE_ALWAYS_VISIBLE_SECONDARY_LINK_HREFS.has(link.href)),
    [visibleLinks]
  );

  useEffect(() => {
    if (!loading && !hasWorkspaceAccess) {
      router.replace(appUser ? "/dashboard" : `/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [appUser, hasWorkspaceAccess, loading, pathname, router]);

  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileDrawerOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileDrawerOpen(false);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileDrawerOpen]);

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
      <div className="border-b border-black/5 bg-white/92 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:px-6">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/8 bg-shell text-ink transition hover:border-[#C6A87D] hover:text-[#C6A87D]"
            aria-expanded={mobileDrawerOpen}
            aria-controls="admin-mobile-drawer"
            aria-label="Open admin navigation"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path d="M4 7h16" strokeLinecap="round" />
              <path d="M4 12h16" strokeLinecap="round" />
              <path d="M4 17h16" strokeLinecap="round" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.24em] text-bronze">Admin</p>
            <p className="truncate text-base font-semibold text-ink">{title}</p>
          </div>
        </div>
      </div>
      <div
        className={cn(
          "fixed inset-0 z-[70] bg-black/28 transition-opacity duration-300 lg:hidden",
          mobileDrawerOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setMobileDrawerOpen(false)}
        aria-hidden={!mobileDrawerOpen}
      />
      <aside
        id="admin-mobile-drawer"
        className={cn(
          "fixed inset-y-0 left-0 z-[80] w-[78vw] max-w-[320px] border-r border-black/5 bg-white shadow-[0_24px_80px_rgba(15,15,15,0.16)] transition-transform duration-300 ease-out lg:hidden",
          mobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!mobileDrawerOpen}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-black/5 px-4 py-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-bronze">Admin</p>
              <p className="mt-1 text-lg font-semibold text-ink">Navigation</p>
            </div>
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/8 bg-shell text-ink transition hover:border-[#C6A87D] hover:text-[#C6A87D]"
              aria-label="Close admin navigation"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
            {mobilePrimaryLinks.map((link) => (
              <MobileNavLink
                key={link.href}
                link={link}
                active={pathname === link.href}
                badgeCount={badgeCounts[link.href] ?? 0}
                onNavigate={() => setMobileDrawerOpen(false)}
              />
            ))}
            {mobileAlwaysVisibleSecondaryLinks.map((link) => (
              <MobileNavLink
                key={link.href}
                link={link}
                active={pathname === link.href}
                badgeCount={badgeCounts[link.href] ?? 0}
                onNavigate={() => setMobileDrawerOpen(false)}
              />
            ))}
            <MobileNavGroup
              label="Operations"
              links={mobileOperationsLinks}
              pathname={pathname}
              badgeCounts={badgeCounts}
              open={mobileNavGroups.operations}
              onToggle={() => setMobileNavGroups((current) => ({ ...current, operations: !current.operations }))}
              onNavigate={() => setMobileDrawerOpen(false)}
            />
            <MobileNavGroup
              label="Compliance"
              links={mobileComplianceLinks}
              pathname={pathname}
              badgeCounts={badgeCounts}
              open={mobileNavGroups.compliance}
              onToggle={() => setMobileNavGroups((current) => ({ ...current, compliance: !current.compliance }))}
              onNavigate={() => setMobileDrawerOpen(false)}
            />
            {mobileStandaloneLinks.length ? (
              <MobileNavGroup
                label="Administration"
                links={mobileStandaloneLinks}
                pathname={pathname}
                badgeCounts={badgeCounts}
                open={mobileNavGroups.administration}
                onToggle={() => setMobileNavGroups((current) => ({ ...current, administration: !current.administration }))}
                onNavigate={() => setMobileDrawerOpen(false)}
              />
            ) : null}
          </div>
        </div>
      </aside>
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-10 md:px-6 md:py-16 lg:grid-cols-[240px,1fr] lg:gap-8">
        <aside className="hidden rounded-[24px] border border-black/5 bg-white p-4 shadow-panel md:rounded-[28px] md:p-5 lg:block">
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
