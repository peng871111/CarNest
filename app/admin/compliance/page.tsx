import { AdminShell } from "@/components/layout/admin-shell";

export const dynamic = "force-dynamic";

export default function AdminCompliancePage() {
  return (
    <AdminShell
      title="Compliance"
      description="Review compliance-related activity and internal risk signals across the CarNest marketplace."
      requiredPermission="manageUsers"
    >
      <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
        <p className="text-xs uppercase tracking-[0.28em] text-bronze">Coming soon</p>
        <h2 className="mt-3 font-display text-3xl text-ink">Compliance workspace</h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
          This area will show flagged-user compliance activity, review tools, and related internal actions.
        </p>
      </section>
    </AdminShell>
  );
}
