"use client";

import Link from "next/link";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { ChangePasswordForm } from "@/components/forms/change-password-form";
import { useAuth } from "@/lib/auth";

export default function AccountSettingsPage() {
  const { appUser, loading, authError } = useAuth();

  return (
    <div>
      <WorkspaceHeader workspaceLabel="DASHBOARD" />
      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="space-y-6 rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
          {loading ? (
            <p className="text-sm text-ink/65">Loading account settings...</p>
          ) : authError ? (
            <>
              <p className="text-xs uppercase tracking-[0.28em] text-bronze">Account settings</p>
              <h1 className="mt-4 font-display text-4xl text-ink">Live data is temporarily unavailable</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
                We’re having trouble loading live data right now. Please check your connection and try again.
              </p>
              <div className="mt-8">
                <Link href="/dashboard/settings" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
                  Retry
                </Link>
              </div>
            </>
          ) : !appUser ? (
            <>
              <p className="text-xs uppercase tracking-[0.28em] text-bronze">Account settings</p>
              <h1 className="mt-4 font-display text-4xl text-ink">Sign in to manage your password</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
                Your password settings are available from your protected CarNest account area.
              </p>
              <div className="mt-8">
                <Link href="/login?redirect=%2Fdashboard%2Fsettings" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
                  Go to Login
                </Link>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-bronze">Account settings</p>
                <h1 className="mt-4 font-display text-4xl text-ink">Password and account security</h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
                  Update your password for this {appUser.role === "super_admin" ? "super admin" : appUser.role} account. Firebase remains the
                  source of truth for your credentials.
                </p>
              </div>
              <ChangePasswordForm />
            </>
          )}
        </section>
      </main>
    </div>
  );
}
