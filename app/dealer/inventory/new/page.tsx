import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DealerTermsGate } from "@/components/dealer/dealer-terms-gate";
import { SellFlow } from "@/components/forms/sell-flow";
import { DealerShell } from "@/components/layout/dealer-shell";

export default async function DealerNewInventoryPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get("carnest_role")?.value;
  const dealerStatus = cookieStore.get("carnest_dealer_status")?.value;

  if (role !== "dealer" || dealerStatus !== "approved") {
    redirect("/dealer/application-status");
  }

  return (
    <DealerShell title="Add Vehicle" description="Add a vehicle to your dealer inventory.">
      <DealerTermsGate>
        <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
          <SellFlow />
        </section>
      </DealerTermsGate>
    </DealerShell>
  );
}
