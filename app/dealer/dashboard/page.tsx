import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DealerDashboardPanel } from "@/components/dealer/dealer-dashboard-panel";
import { DealerShell } from "@/components/layout/dealer-shell";

export default async function DealerDashboardPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get("carnest_role")?.value;
  const dealerStatus = cookieStore.get("carnest_dealer_status")?.value;

  if (role === "dealer" && dealerStatus !== "approved") {
    redirect("/dealer/application-status");
  }

  if (role !== "dealer" && dealerStatus !== "approved") {
    redirect("/dealer/application-status");
  }

  return (
    <DealerShell title="Dealer Dashboard" description="Monitor dealer inventory, buyer activity, and account readiness.">
      <DealerDashboardPanel />
    </DealerShell>
  );
}
