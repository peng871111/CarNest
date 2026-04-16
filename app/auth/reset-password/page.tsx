import Link from "next/link";
import { PasswordResetCompletionForm } from "@/components/forms/password-reset-completion-form";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    mode?: string;
    oobCode?: string;
    apiKey?: string;
    continueUrl?: string;
  }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;

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
          <h1 className="mt-3 font-display text-5xl text-ink">Choose a new password</h1>
          <p className="mt-4 text-sm leading-6 text-ink/65">
            This secure CarNest page receives your Firebase reset link, verifies the code, and lets you set a new password.
          </p>
        </div>
        <PasswordResetCompletionForm
          mode={params.mode ?? ""}
          oobCode={params.oobCode ?? ""}
          apiKey={params.apiKey ?? ""}
          continueUrl={params.continueUrl ?? ""}
        />
      </div>
    </main>
  );
}
