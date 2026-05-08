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
  const [highActivityAccounts, dealerRiskAccounts] = await Promise.all([
    getHighActivityUserSupportAccounts(20),
    getDealerRiskSupportAccounts(20)
  ]);

  return (
    <AdminShell
      title="User Support"
      description="Search a specific customer or listing, review account-linked activity, and perform support actions without scanning the full user base."
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
      />
    </AdminShell>
  );
}
