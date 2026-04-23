import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DealerAnalyticsPanel } from "@/components/dealer/dealer-analytics-panel";
import { DealerShell } from "@/components/layout/dealer-shell";

export default async function DealerAnalyticsPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get("carnest_role")?.value;
  const dealerStatus = cookieStore.get("carnest_dealer_status")?.value;

  if (role !== "dealer" || dealerStatus !== "approved") {
    redirect("/dealer/application-status");
  }

  return (
    <DealerShell title="Analytics" description="Review dealer inventory and lead activity using available CarNest data.">
      <DealerAnalyticsPanel />
    </DealerShell>
  );
}
