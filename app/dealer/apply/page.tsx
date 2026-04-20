import { DealerApplicationForm } from "@/components/forms/dealer-application-form";
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
            Submit your business details and LMCT proof so the CarNest team can review and verify your dealer account.
          </p>
          <div className="mt-8">
            <DealerApplicationForm />
          </div>
        </section>
      </main>
    </div>
  );
}
