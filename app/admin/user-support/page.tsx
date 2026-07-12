import { AdminShell } from "@/components/layout/admin-shell";
import { UserSupportPanel } from "@/components/admin/user-support-panel";
import { getDealerRiskSupportAccounts, getHighActivityUserSupportAccounts } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminUserSupportPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const query = ((await searchParams)?.q ?? "").trim();
  let highActivityAccounts = [] as Awaited<ReturnType<typeof getHighActivityUserSupportAccounts>>;
  let dealerRiskAccounts = [] as Awaited<ReturnType<typeof getDealerRiskSupportAccounts>>;
  let initialLoadError = "";

  try {
    [highActivityAccounts, dealerRiskAccounts] = await Promise.all([
      getHighActivityUserSupportAccounts(20),
      getDealerRiskSupportAccounts(20)
    ]);
  } catch (error) {
    console.error("[admin-user-support] Failed to load user support data.", error);
    initialLoadError = "User support data could not be loaded right now. Please check server logs.";
  }

  return (
    <AdminShell
      title="User Support"
      description="Search registered users, review account activity, and handle support or access tasks from one internal workspace."
      requiredPermission="manageUsers"
    >
      <UserSupportPanel
        initialQuery={query}
        initialRecord={{
          matchedUser: null,
          matchedVehicle: null,
          ownedVehicles: [],
          metrics: {
            totalListings: 0,
            liveListings: 0,
            soldListings: 0,
            pendingListings: 0,
            totalOffers: 0,
            totalEnquiries: 0,
            totalInspections: 0
          }
        }}
        initialHighActivityAccounts={highActivityAccounts}
        initialDealerRiskAccounts={dealerRiskAccounts}
        initialLoadError={initialLoadError}
      />
    </AdminShell>
  );
}
