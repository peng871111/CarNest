import { Suspense } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/forms/auth-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-16">
      <div className="w-full space-y-6">
        <div>
          <Link href="/" className="inline-flex text-sm font-medium text-ink/60 transition hover:text-bronze">
            ← Back to site
          </Link>
        </div>
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-bronze">Sign in</p>
          <h1 className="mt-3 font-display text-5xl text-ink">Access CarNest</h1>
          <p className="mt-4 text-sm leading-6 text-ink/65">
            Sign in to save vehicles, submit offers, and book inspections. Create an account to manage your activity and get updates.
          </p>
        </div>
        <Suspense fallback={<div className="rounded-[28px] border border-black/5 bg-white p-8 text-sm text-ink/60 shadow-panel">Loading sign in form...</div>}>
          <AuthForm mode="login" />
        </Suspense>
        <div className="space-y-3 text-sm text-ink/60">
          <p>
            New here?{" "}
            <Link href="/register" className="text-ink">
              Create an account
            </Link>
          </p>
          <p>
            <Link href="/inventory" className="text-ink transition hover:text-bronze">
              Continue without an account
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
