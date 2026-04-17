import { AdminShell } from "@/components/layout/admin-shell";
import { listUsers } from "@/lib/data";
import { AdminAccessManager } from "@/components/admin/admin-access-manager";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await listUsers();
  const adminUsers = users.filter((user) => user.role === "admin" || user.role === "super_admin");

  return (
    <AdminShell
      title="Admin Access"
      description="Review the current internal admin accounts, their roles, and the permission model used across the CarNest admin workspace."
      requiredPermission="manageAdmins"
    >
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          Admin accounts: {adminUsers.length}
        </div>
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          Super admins: {adminUsers.filter((user) => user.role === "super_admin").length}
        </div>
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          User accounts loaded: {users.length}
        </div>
      </div>
      <AdminAccessManager users={users} />
    </AdminShell>
  );
}
