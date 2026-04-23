import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DealerInventoryPanel } from "@/components/dealer/dealer-inventory-panel";
import { WorkspaceHeader } from "@/components/layout/workspace-header";

export default async function DealerInventoryPage() {
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
        <DealerInventoryPanel />
      </main>
    </div>
  );
}
