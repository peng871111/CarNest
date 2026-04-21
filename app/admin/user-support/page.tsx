import { AdminShell } from "@/components/layout/admin-shell";
import { UserSupportPanel } from "@/components/admin/user-support-panel";
import { getContactMessagesData, getInspectionRequestsData, getOffersData, getVehiclesData, listUsers } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminUserSupportPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const query = ((await searchParams)?.q ?? "").trim();
  const [users, vehiclesResult, offersResult, contactMessagesResult, inspectionsResult] = await Promise.all([
    listUsers(),
    getVehiclesData(),
    getOffersData(),
    getContactMessagesData(),
    getInspectionRequestsData()
  ]);

  return (
    <AdminShell
      title="User Support"
      description="Search a specific customer or listing, review account-linked activity, and perform support actions without scanning the full user base."
      requiredPermission="manageUsers"
    >
      <UserSupportPanel
        initialQuery={query}
        users={users}
        vehicles={vehiclesResult.items}
        offers={offersResult.items}
        contactMessages={contactMessagesResult.items}
        inspectionRequests={inspectionsResult.items}
      />
    </AdminShell>
  );
}
