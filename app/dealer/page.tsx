import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function DealerDashboardPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get("carnest_role")?.value;
  const dealerStatus = cookieStore.get("carnest_dealer_status")?.value;

  if (role === "dealer" && dealerStatus === "approved") {
    redirect("/dealer/dashboard");
  }

  if (role === "dealer") {
    redirect("/dealer/application-status");
  }

  redirect("/dealer/application-status");
}
