import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DealerLeadsPanel } from "@/components/dealer/dealer-leads-panel";
import { DealerShell } from "@/components/layout/dealer-shell";

export default async function DealerLeadsPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get("carnest_role")?.value;
  const dealerStatus = cookieStore.get("carnest_dealer_status")?.value;

  if (role !== "dealer" || dealerStatus !== "approved") {
    redirect("/dealer/application-status");
  }

  return (
    <DealerShell title="Leads" description="Review buyer interest and inspection activity across dealer inventory.">
      <DealerLeadsPanel />
    </DealerShell>
  );
}
