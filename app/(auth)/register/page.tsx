import { Suspense } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/forms/auth-form";

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-16">
      <div className="w-full space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-bronze">Register</p>
          <h1 className="mt-3 font-display text-5xl text-ink">Create your CarNest account</h1>
          <p className="mt-4 text-sm leading-6 text-ink/65">Choose a placeholder role now so the project is ready for buyer, seller, and admin workflows in the next iteration.</p>
        </div>
        <Suspense fallback={<div className="rounded-[28px] border border-black/5 bg-white p-8 text-sm text-ink/60 shadow-panel">Loading registration form...</div>}>
          <AuthForm mode="register" />
        </Suspense>
        <p className="text-sm text-ink/60">
          Already have an account?{" "}
          <Link href="/login" className="text-ink">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
