import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DealerInventoryPanel } from "@/components/dealer/dealer-inventory-panel";
import { DealerShell } from "@/components/layout/dealer-shell";

export default async function DealerInventoryPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get("carnest_role")?.value;
  const dealerStatus = cookieStore.get("carnest_dealer_status")?.value;

  if (role !== "dealer" || dealerStatus !== "approved") {
    redirect("/dealer/application-status");
  }

  return (
    <DealerShell title="Inventory" description="Manage multi-vehicle dealer stock and listing readiness.">
      <DealerInventoryPanel />
    </DealerShell>
  );
}
