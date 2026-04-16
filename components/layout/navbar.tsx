"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { NAV_LINKS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { appUser, logout } = useAuth();

  const userLabel = appUser ? (appUser.role === "admin" || appUser.role === "super_admin" ? "Admin" : appUser.displayName) : "";
  const accountLinks = appUser
    ? appUser.role === "admin" || appUser.role === "super_admin"
      ? [
          { href: "/admin/vehicles", label: "Dashboard" },
          { href: "/admin/inspections", label: "Inspections" }
        ]
      : appUser.role === "seller"
        ? [
            { href: "/seller/vehicles", label: "Dashboard" },
            { href: "/seller/offers", label: "Offers" }
          ]
        : [
            { href: "/dashboard", label: "Dashboard" },
            { href: "/dashboard/saved", label: "Saved Vehicles" }
          ]
    : [];

  async function handleLogout() {
    await logout();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0F0F0F]/95 text-[#F5F5F5] backdrop-blur">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex min-h-[72px] items-center justify-between gap-6">
          <Link href="/" className="font-display text-2xl tracking-[0.14em] text-[#F5F5F5] transition hover:text-[#C6A87D]">
            CarNest
          </Link>

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

        <nav className="scrollbar-none flex gap-5 overflow-x-auto py-3 text-sm whitespace-nowrap">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "pb-2 transition hover:text-[#C6A87D]",
                  active ? "border-b border-[#C6A87D] text-[#C6A87D]" : "text-[#F5F5F5]/84"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 pb-3 lg:hidden">
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
            <Link href="/login" className="text-sm font-medium text-[#F5F5F5] transition hover:text-[#C6A87D]">
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
