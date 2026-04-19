import { AdminShell } from "@/components/layout/admin-shell";

export const dynamic = "force-dynamic";

export default function AdminDealerApplicationsPage() {
  return (
    <AdminShell
      title="Dealer Applications"
      description="Review dealer account applications and manage their internal approval workflow."
      requiredPermission="manageUsers"
    >
      <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
        <p className="text-xs uppercase tracking-[0.28em] text-bronze">Coming soon</p>
        <h2 className="mt-3 font-display text-3xl text-ink">Dealer review queue</h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
          This area will show pending dealer applications, review status, and internal verification actions.
        </p>
      </section>
    </AdminShell>
  );
}
