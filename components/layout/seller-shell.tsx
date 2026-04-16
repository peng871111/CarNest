"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { SELLER_LINKS } from "@/lib/constants";
import { useAuth } from "@/lib/auth";
import { canAccessRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { WorkspaceHeader } from "@/components/layout/workspace-header";

export function SellerShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { appUser, loading } = useAuth();

  useEffect(() => {
    if (!loading && !canAccessRole("seller", appUser?.role)) {
      router.replace(appUser ? "/dashboard" : `/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [appUser, appUser?.role, loading, pathname, router]);

  if (loading) {
    return <main className="mx-auto max-w-7xl px-6 py-16 text-sm text-ink/60">Loading seller area...</main>;
  }

  if (!canAccessRole("seller", appUser?.role)) return null;

  return (
    <div>
      <WorkspaceHeader workspaceLabel="SELLER" />
      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-[240px,1fr]">
        <aside className="rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
          <p className="text-xs uppercase tracking-[0.32em] text-bronze">Seller</p>
          <div className="mt-6 space-y-2">
            {SELLER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "block rounded-2xl px-4 py-3 text-sm text-ink/65 transition hover:bg-shell hover:text-ink",
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
            <p className="text-xs uppercase tracking-[0.32em] text-bronze">Vehicle management</p>
            <h1 className="mt-2 font-display text-5xl text-ink">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">{description}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.22em] text-ink/45">Seller access: own vehicles only</p>
          </div>
          {children}
        </section>
      </main>
    </div>
  );
}
