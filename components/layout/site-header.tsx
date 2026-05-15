"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

export function SiteHeader() {
  const pathname = usePathname();
  const { appUser, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-shell/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-display text-2xl tracking-[0.2em] text-ink">
          CarNest
        </Link>
        <nav className="hidden gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={cn("text-sm text-ink/70 transition hover:text-ink", pathname === link.href && "text-ink")}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {appUser ? (
            <>
              {appUser.role === "admin" || appUser.role === "super_admin" ? (
                <Link href="/admin" className="text-sm font-medium text-ink">
                  Admin
                </Link>
              ) : (
                <Link href="/seller/vehicles" className="text-sm font-medium text-ink">
                  Account
                </Link>
              )}
              <button className="text-sm text-ink/60" onClick={() => logout()}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-ink">
                Log in
              </Link>
              <Link href="/register" className="rounded-full border border-ink px-4 py-2 text-sm font-medium text-ink">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
