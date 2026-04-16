import { AdminShell } from "@/components/layout/admin-shell";

export default function AdminInspectionsLoading() {
  return (
    <AdminShell title="Inspections" description="Loading inspection requests...">
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="h-14 rounded-[24px] bg-shell" />
        ))}
      </div>
      <section className="overflow-hidden rounded-[32px] border border-black/5 bg-white shadow-panel">
        <div className="h-14 border-b border-black/5 bg-shell" />
        <div className="space-y-4 px-6 py-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-16 rounded-[20px] bg-shell" />
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
