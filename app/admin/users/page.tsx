import { AdminShell } from "@/components/layout/admin-shell";
import { getComplianceAlertsData, listUsers } from "@/lib/data";
import { AdminAccessManager } from "@/components/admin/admin-access-manager";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const [users, complianceAlertsResult] = await Promise.all([listUsers(), getComplianceAlertsData()]);
  const adminUsers = users.filter((user) => user.role === "admin" || user.role === "super_admin");
  const openComplianceAlerts = complianceAlertsResult.items.filter((item) => item.status === "open");

  return (
    <AdminShell
      title="Admin Access"
      description="Review internal admin accounts alongside seller compliance alerts that may indicate possible unlicensed trading activity."
      requiredPermission="manageAdmins"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          Admin accounts: {adminUsers.length}
        </div>
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          Super admins: {adminUsers.filter((user) => user.role === "super_admin").length}
        </div>
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          User accounts loaded: {users.length}
        </div>
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          Open compliance alerts: {openComplianceAlerts.length}
        </div>
      </div>
      <AdminAccessManager users={users} complianceAlerts={complianceAlertsResult.items} />
    </AdminShell>
  );
}
