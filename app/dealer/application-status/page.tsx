import Link from "next/link";
import { WorkspaceHeader } from "@/components/layout/workspace-header";

export default function DealerApplicationStatusPage() {
  return (
    <div>
      <WorkspaceHeader workspaceLabel="ACCOUNT" />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
          <p className="text-xs uppercase tracking-[0.28em] text-bronze">Dealer status</p>
          <h1 className="mt-4 font-display text-4xl text-ink">Application under review</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
            Your dealer account is pending manual verification. We&apos;ll notify you once the review is complete or if more information is
            required.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/dealer/apply" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
              Review application steps
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
