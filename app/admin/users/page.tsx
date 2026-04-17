import { AdminShell } from "@/components/layout/admin-shell";
import { listUsers } from "@/lib/data";
import { ADMIN_PERMISSION_KEYS } from "@/lib/permissions";
import { formatMonthYear, getAccountDisplayReference } from "@/lib/utils";

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
          Only Craig can manage admin access and permissions
        </div>
      </div>

      <section className="rounded-[32px] border border-black/5 bg-white shadow-panel">
        <div className="border-b border-black/5 px-6 py-5">
          <p className="text-xs uppercase tracking-[0.24em] text-bronze">Internal access</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">Current admin accounts</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/65">
            This page is reserved for the super admin account. Standard admins can use the rest of the admin workspace, but they cannot assign,
            revoke, or edit admin permissions.
          </p>
        </div>

        <div>
          {adminUsers.length ? (
            adminUsers.map((user) => (
              <div key={user.id} className="border-b border-black/5 px-6 py-6 last:border-b-0">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-ink">{user.displayName || user.name || user.email}</p>
                    <p className="mt-1 text-sm text-ink/60">{user.email}</p>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-ink/45">
                      {getAccountDisplayReference({
                        id: user.id,
                        accountReference: user.accountReference,
                        role: user.role
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-black/10 bg-shell px-3 py-2 text-xs font-medium text-ink/72">
                      {user.role === "super_admin" ? "Super admin" : "Admin"}
                    </span>
                    <span className="rounded-full border border-black/10 bg-shell px-3 py-2 text-xs font-medium text-ink/72">
                      Member since {formatMonthYear(user.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {ADMIN_PERMISSION_KEYS.map((permission) => (
                    <div key={permission} className="rounded-[20px] border border-black/5 bg-shell px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-ink/45">{permission}</p>
                      <p className="mt-2 text-sm font-medium text-ink">
                        {user.role === "super_admin" || user.adminPermissions?.[permission] ? "Enabled" : "Not enabled"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-12 text-sm text-ink/60">No admin accounts are available yet.</div>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
