import { AdminShell } from "@/components/layout/admin-shell";

export default function AdminPricingLoading() {
  return (
    <AdminShell
      title="Pricing"
      description="Review manual pricing advice requests, respond with human guidance, and move each lead through the CarNest follow-up process."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="h-12 animate-pulse rounded-[24px] bg-shell" />
        <div className="h-12 animate-pulse rounded-[24px] bg-shell" />
      </div>
      <section className="rounded-[32px] border border-black/5 bg-white shadow-panel">
        <div className="grid grid-cols-[1fr,1fr,1.1fr,1.3fr,1.3fr] gap-4 border-b border-black/5 bg-shell px-6 py-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-4 animate-pulse rounded bg-black/5" />
          ))}
        </div>
        <div className="space-y-0">
          {Array.from({ length: 4 }).map((_, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-[1fr,1fr,1.1fr,1.3fr,1.3fr] gap-4 border-b border-black/5 px-6 py-5 last:border-b-0">
              {Array.from({ length: 5 }).map((_, columnIndex) => (
                <div key={columnIndex} className="h-16 animate-pulse rounded-[20px] bg-black/[0.04]" />
              ))}
            </div>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
