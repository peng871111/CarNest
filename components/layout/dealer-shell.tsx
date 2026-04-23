"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { WorkspaceHeader } from "@/components/layout/workspace-header";

const DEALER_LINKS = [
  { href: "/dealer/dashboard", label: "Dashboard" },
  { href: "/dealer/inventory", label: "Inventory" },
  { href: "/dealer/leads", label: "Leads" },
  { href: "/dealer/profile", label: "Shop Profile" },
  { href: "/dealer/analytics", label: "Analytics" },
  { href: "/dashboard/settings", label: "Account / Settings" }
];

export function DealerShell({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { appUser, loading } = useAuth();
  const hasDealerAccess = appUser?.role === "dealer" && appUser.dealerStatus === "approved";

  useEffect(() => {
    if (loading) return;
    if (!appUser) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!hasDealerAccess) {
      router.replace("/dealer/application-status");
    }
  }, [appUser, hasDealerAccess, loading, pathname, router]);

  if (loading) {
    return <main className="mx-auto max-w-7xl px-6 py-16 text-sm text-ink/60">Loading dealer portal...</main>;
  }

  if (!hasDealerAccess) return null;

  return (
    <div>
      <WorkspaceHeader workspaceLabel="DEALER" />
      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-[240px,1fr]">
        <aside className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
          <p className="text-xs uppercase tracking-[0.32em] text-bronze">Dealer portal</p>
          <div className="mt-6 space-y-2">
            {DEALER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center justify-between rounded-2xl px-4 py-3 text-sm text-ink/65 transition hover:bg-shell hover:text-ink",
                  pathname === link.href && "bg-shell text-ink"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </aside>
        <section className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-bronze">Business portal</p>
            <h1 className="mt-2 font-display text-5xl text-ink">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">{description}</p>
          </div>
          {children}
        </section>
      </main>
    </div>
  );
}
