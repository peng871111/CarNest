import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DealerTermsGate } from "@/components/dealer/dealer-terms-gate";
import { SellFlow } from "@/components/forms/sell-flow";
import { WorkspaceHeader } from "@/components/layout/workspace-header";

export default async function DealerNewInventoryPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get("carnest_role")?.value;
  const dealerStatus = cookieStore.get("carnest_dealer_status")?.value;

  if (role !== "dealer" || dealerStatus !== "approved") {
    redirect("/dealer/application-status");
  }

  return (
    <div>
      <WorkspaceHeader workspaceLabel="DEALER" />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <DealerTermsGate>
          <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
            <p className="text-xs uppercase tracking-[0.28em] text-bronze">Dealer inventory</p>
            <h1 className="mt-4 font-display text-4xl text-ink">Add Vehicle</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
              Add a vehicle to your dealer inventory.
            </p>
            <div className="mt-8">
              <SellFlow />
            </div>
          </section>
        </DealerTermsGate>
      </main>
    </div>
  );
}
