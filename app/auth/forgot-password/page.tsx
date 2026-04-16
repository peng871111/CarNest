import Link from "next/link";
import { PasswordResetRequestForm } from "@/components/forms/password-reset-request-form";

export default function AuthForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-16">
      <div className="w-full space-y-6">
        <div>
          <Link href="/login" className="inline-flex text-sm font-medium text-ink/60 transition hover:text-bronze">
            ← Back to sign in
          </Link>
        </div>
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-bronze">Password reset</p>
          <h1 className="mt-3 font-display text-5xl text-ink">Reset your password</h1>
          <p className="mt-4 text-sm leading-6 text-ink/65">
            Enter your account email and CarNest will send you a Firebase password reset link.
          </p>
        </div>
        <PasswordResetRequestForm />
      </div>
    </main>
  );
}
