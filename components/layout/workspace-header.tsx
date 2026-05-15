"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export function WorkspaceHeader({ workspaceLabel }: { workspaceLabel: "ADMIN" | "ACCOUNT" | "DASHBOARD" | "DEALER" }) {
  const router = useRouter();
  const { appUser, logout } = useAuth();

  const workspaceIdentityLabel = (() => {
    if (!appUser) return workspaceLabel;
    if (appUser.role === "admin" || appUser.role === "super_admin") return "Admin Dashboard";

    const candidates = [appUser.displayName, appUser.name, appUser.email.split("@")[0]];
    return candidates.find((candidate) => candidate && candidate.trim() && candidate.trim().toLowerCase() !== "carnest user")?.trim() ?? "Account";
  })();

  const dashboardHref =
    appUser?.role === "admin" || appUser?.role === "super_admin"
      ? "/admin"
      : appUser?.role === "dealer"
        ? "/dealer/dashboard"
        : appUser?.role === "seller" || appUser?.role === "buyer"
        ? "/seller/vehicles"
        : null;

  async function handleLogout() {
    await logout();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="relative z-40 border-b border-black/5 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-display text-2xl tracking-[0.18em] text-ink transition hover:text-bronze">
            CarNest
          </Link>
          <Link href="/" className="text-sm font-medium text-ink/65 transition hover:text-bronze">
            Back to Site
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {dashboardHref ? (
            <Link
              href={dashboardHref}
              className="relative z-50 inline-flex min-h-10 items-center justify-center rounded-full border border-sand bg-shell px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-bronze transition hover:border-bronze hover:bg-white focus:outline-none focus:ring-2 focus:ring-bronze/30"
            >
              {workspaceIdentityLabel}
            </Link>
          ) : (
            <span className="rounded-full border border-sand bg-shell px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-bronze">
              {workspaceIdentityLabel}
            </span>
          )}
          {appUser ? (
            <Link href="/dashboard/settings" className="text-sm font-medium text-ink/65 transition hover:text-bronze">
              Account Settings
            </Link>
          ) : null}
          {appUser ? (
            <button type="button" onClick={() => void handleLogout()} className="text-sm font-medium text-ink/65 transition hover:text-bronze">
              Sign out
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
