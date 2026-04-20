import { Suspense } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/forms/auth-form";

type LoginPageProps = {
  searchParams?: Promise<{
    reset?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : undefined;

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
          <h1 className="mt-3 font-display text-5xl text-ink">Sign in to CarNest</h1>
          <p className="mt-4 text-sm leading-6 text-ink/65">
            Sign in to your CarNest account to save vehicles, submit offers, book inspections, and manage your activity.
          </p>
        </div>
        {params?.reset === "success" ? (
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
            Password reset complete. Sign in with your new password.
          </div>
        ) : null}
        <Suspense fallback={<div className="rounded-[28px] border border-black/5 bg-white p-8 text-sm text-ink/60 shadow-panel">Loading sign in form...</div>}>
          <AuthForm mode="login" />
        </Suspense>
        <div className="space-y-3 text-sm text-ink/60">
          <p>
            <Link href="/auth/forgot-password" className="text-ink transition hover:text-bronze">
              Forgot password?
            </Link>
          </p>
          <p>
            New here?{" "}
            <Link href="/register" className="text-ink">
              Create an account
            </Link>
          </p>
          <p>
            Dealer?{" "}
            <Link href="/register?accountType=dealer" className="text-ink transition hover:text-bronze">
              Apply for a dealer account
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
