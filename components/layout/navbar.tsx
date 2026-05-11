"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { NAV_LINKS } from "@/lib/constants";
import { cn } from "@/lib/utils";
export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { appUser, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userLabel = appUser ? (appUser.role === "admin" || appUser.role === "super_admin" ? "Admin" : appUser.displayName) : "";
  const isAdminUser = appUser?.role === "admin" || appUser?.role === "super_admin";
  const accountLinks = appUser
    ? isAdminUser
      ? [
          { href: "/admin/vehicles", label: "Dashboard" },
          { href: "/admin/inspections", label: "Inspections" },
          { href: "/dashboard/settings", label: "Account Settings" }
        ]
      : [
          { href: "/seller/vehicles", label: "My Vehicles" },
          { href: "/dashboard/saved", label: "Saved Vehicles" },
          ...(appUser.role === "seller" ? [{ href: "/seller/offers", label: "Offers on My Cars" }] : []),
          { href: "/dashboard/offers", label: "My Offers to Sellers" },
          { href: "/dashboard/settings", label: "Account Settings" }
        ]
    : [];
  const mobileAccountLinks = appUser
    ? isAdminUser
      ? [
          { href: "/admin/analytics", label: "Dashboard" },
          { href: "/admin/vehicles", label: "Vehicle Workspace" },
          { href: "/admin/customers", label: "Customers" },
          { href: "/admin/warehouse-intake", label: "Warehouse Intake" },
          { href: "/admin/public-listings", label: "Public Listings" },
          { href: "/dashboard/settings", label: "Account Settings" }
        ]
      : accountLinks
    : [];

  async function handleLogout() {
    await logout();
    setMobileMenuOpen(false);
    router.push("/");
    router.refresh();
  }

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0F0F0F]/95 text-[#F5F5F5] backdrop-blur">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex min-h-[72px] items-center justify-between gap-4 sm:gap-6">
          <Link
            href="/"
            className="shrink-0 text-2xl font-black italic tracking-[0.11em] text-white transition duration-200 hover:scale-105 hover:opacity-80"
            style={{
              transform: "skewX(8deg) scaleY(0.85)"
            }}
          >
            CARNEST
          </Link>
          <div className="flex items-center gap-3 lg:hidden">
            <Link
              href="/sell"
              className="rounded-full border border-[#C6A87D]/28 bg-white/8 px-4 py-2 text-sm font-medium text-white transition hover:border-[#C6A87D]/45 hover:bg-white/12"
            >
              Sell Your Car
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((current) => !current)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white transition hover:border-[#C6A87D]/45 hover:text-[#C6A87D]"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                {mobileMenuOpen ? (
                  <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                ) : (
                  <>
                    <path d="M4 7h16" strokeLinecap="round" />
                    <path d="M4 12h16" strokeLinecap="round" />
                    <path d="M4 17h16" strokeLinecap="round" />
                  </>
                )}
              </svg>
            </button>
          </div>
          <div className="hidden items-center gap-4 lg:flex">
            {appUser ? (
              <details className="relative">
                <summary className="list-none rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-[#F5F5F5] transition hover:border-[#C6A87D] hover:text-[#C6A87D] [&::-webkit-details-marker]:hidden">
                  {userLabel}
                </summary>
                <div className="absolute right-0 z-[60] mt-2 w-56 overflow-hidden rounded-[22px] border border-white/10 bg-[#121212] shadow-2xl">
                  {accountLinks.map((link, index) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`block px-4 py-3 text-sm text-[#F5F5F5]/84 transition hover:bg-white/5 hover:text-[#C6A87D] ${
                        index < accountLinks.length - 1 ? "border-b border-white/5" : ""
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="block w-full border-t border-white/5 px-4 py-3 text-left text-sm text-[#F5F5F5]/84 transition hover:bg-white/5 hover:text-[#C6A87D]"
                  >
                    Logout
                  </button>
                </div>
              </details>
            ) : (
              <Link href="/login" className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-[#F5F5F5] transition hover:border-[#C6A87D] hover:text-[#C6A87D]">
                Login
              </Link>
            )}
          </div>
        </div>

        <nav className="scrollbar-none hidden gap-5 overflow-x-auto py-3 pr-1 text-sm whitespace-nowrap lg:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "shrink-0 pb-2 transition hover:text-[#C6A87D]",
                  active ? "border-b border-[#C6A87D] text-[#C6A87D]" : "text-[#F5F5F5]/84"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {mobileMenuOpen ? (
          <div className="border-t border-white/8 py-4 lg:hidden">
            <div className="grid gap-2">
              {NAV_LINKS.filter((link) => link.href !== "/sell").map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "rounded-[18px] px-4 py-3 text-sm font-medium transition",
                      active ? "bg-white/10 text-[#C6A87D]" : "bg-white/[0.03] text-white/88 hover:bg-white/[0.06] hover:text-[#C6A87D]"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
            <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
              {appUser ? (
                <>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#C6A87D]">{userLabel}</p>
                  <div className="mt-3 grid gap-2">
                    {mobileAccountLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="rounded-[16px] px-3 py-2.5 text-sm text-white/84 transition hover:bg-white/[0.05] hover:text-[#C6A87D]"
                      >
                        {link.label}
                      </Link>
                    ))}
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      className="rounded-[16px] px-3 py-2.5 text-left text-sm text-white/84 transition hover:bg-white/[0.05] hover:text-[#C6A87D]"
                    >
                      Logout
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/login"
                    className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:border-[#C6A87D] hover:text-[#C6A87D]"
                  >
                    Login
                  </Link>
                  <Link
                    href="/login?mode=register"
                    className="rounded-full border border-[#C6A87D]/28 bg-white/8 px-4 py-2 text-sm font-medium text-white transition hover:border-[#C6A87D]/45 hover:bg-white/12"
                  >
                    Create account
                  </Link>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
