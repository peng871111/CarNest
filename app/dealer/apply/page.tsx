import Link from "next/link";
import { WorkspaceHeader } from "@/components/layout/workspace-header";

export default function DealerApplyPage() {
  return (
    <div>
      <WorkspaceHeader workspaceLabel="ACCOUNT" />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
          <p className="text-xs uppercase tracking-[0.28em] text-bronze">Dealer verification</p>
          <h1 className="mt-4 font-display text-4xl text-ink">Complete your dealer application</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
            Your dealer account has been created and is currently pending verification. Complete the dealer application process to submit your
            business details and required documents for review.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/dealer/application-status" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
              View application status
            </Link>
            <Link href="/dashboard/settings" className="rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-ink">
              Account Settings
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
