"use client";

import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AppUser, UserRole } from "@/types";
import { updateUserAccess } from "@/lib/data";
import { ADMIN_PERMISSION_KEYS, createAdminPermissions } from "@/lib/permissions";
import { formatMonthYear, getAccountDisplayReference } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

function normalizePermissions(user: AppUser) {
  return createAdminPermissions(user.adminPermissions ?? {});
}

function createDraft(user: AppUser) {
  return {
    role: user.role,
    adminPermissions: normalizePermissions(user)
  };
}

export function AdminAccessManager({ users }: { users: AppUser[] }) {
  const router = useRouter();
  const { appUser } = useAuth();
  const [drafts, setDrafts] = useState<Record<string, ReturnType<typeof createDraft>>>(
    Object.fromEntries(users.map((user) => [user.id, createDraft(user)]))
  );
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const orderedUsers = useMemo(() => {
    return [...users].sort((left, right) => {
      const leftScore = Number(left.role === "super_admin") * 2 + Number(left.role === "admin");
      const rightScore = Number(right.role === "super_admin") * 2 + Number(right.role === "admin");
      return rightScore - leftScore || (left.displayName || left.email).localeCompare(right.displayName || right.email);
    });
  }, [users]);

  function updateDraft(userId: string, next: Partial<ReturnType<typeof createDraft>>) {
    setDrafts((current) => ({
      ...current,
      [userId]: {
        ...current[userId],
        ...next
      }
    }));
  }

  async function saveUser(user: AppUser) {
    if (!appUser) {
      setError("You need to be signed in to manage admin access.");
      return;
    }

    const draft = drafts[user.id];
    if (!draft) return;

    setSavingUserId(user.id);
    setError("");
    setSuccess("");

    try {
      const nextRole = draft.role as UserRole;
      const nextPermissions = nextRole === "admin" || nextRole === "super_admin" ? draft.adminPermissions : undefined;

      await updateUserAccess(
        user.id,
        {
          role: nextRole,
          adminPermissions: nextPermissions
        },
        {
          id: appUser.id,
          role: appUser.role,
          email: appUser.email,
          adminPermissions: appUser.adminPermissions
        },
        user
      );

      setSuccess(`Access updated for ${user.displayName || user.email}.`);
      startTransition(() => {
        router.refresh();
      });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Something went wrong. Please try again.");
    } finally {
      setSavingUserId(null);
    }
  }

  return (
    <section className="rounded-[32px] border border-black/5 bg-white shadow-panel">
      <div className="border-b border-black/5 px-6 py-5">
        <p className="text-xs uppercase tracking-[0.24em] text-bronze">Internal access</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">User roles and admin permissions</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/65">
          Craig remains the only super admin. This screen lets the super admin review accounts, promote or revoke admin access, and update the
          working permission set stored in Firestore.
        </p>
        {success ? <p className="mt-4 text-sm text-emerald-700">{success}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </div>

      <div>
        {orderedUsers.length ? (
          orderedUsers.map((user) => {
            const draft = drafts[user.id] ?? createDraft(user);
            const isSuperAdmin = user.role === "super_admin";
            const isAdminLike = draft.role === "admin" || draft.role === "super_admin";

            return (
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
                      {user.role === "super_admin" ? "Super admin" : user.role}
                    </span>
                    <span className="rounded-full border border-black/10 bg-shell px-3 py-2 text-xs font-medium text-ink/72">
                      Member since {formatMonthYear(user.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-6 lg:grid-cols-[220px,1fr]">
                  <div className="space-y-3">
                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-ink/45">Role</span>
                      <select
                        value={draft.role}
                        disabled={isSuperAdmin || savingUserId === user.id}
                        onChange={(event) =>
                          updateDraft(user.id, {
                            role: event.target.value as UserRole,
                            adminPermissions:
                              event.target.value === "admin"
                                ? draft.adminPermissions
                                : createAdminPermissions({
                                    manageVehicles: false,
                                    manageOffers: false,
                                    manageEnquiries: false,
                                    manageInspections: false,
                                    managePricing: false,
                                    manageQuotes: false,
                                    manageUsers: false,
                                    manageAdmins: false
                                  })
                          })
                        }
                        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink"
                      >
                        <option value="buyer">Buyer</option>
                        <option value="seller">Seller</option>
                        <option value="admin">Admin</option>
                        {isSuperAdmin ? <option value="super_admin">Super admin</option> : null}
                      </select>
                    </label>
                    <Button onClick={() => saveUser(user)} disabled={isSuperAdmin || savingUserId === user.id}>
                      {savingUserId === user.id ? "Saving..." : isSuperAdmin ? "Managed by Craig" : "Save access"}
                    </Button>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Permissions</p>
                    {isAdminLike ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {ADMIN_PERMISSION_KEYS.map((permission) => (
                          <label key={permission} className="flex items-center gap-3 rounded-[20px] border border-black/5 bg-shell px-4 py-3">
                            <input
                              type="checkbox"
                              checked={draft.adminPermissions[permission]}
                              disabled={isSuperAdmin || savingUserId === user.id}
                              onChange={(event) =>
                                updateDraft(user.id, {
                                  adminPermissions: {
                                    ...draft.adminPermissions,
                                    [permission]: event.target.checked
                                  }
                                })
                              }
                              className="h-4 w-4 rounded border-black/20 text-ink"
                            />
                            <span className="text-sm text-ink">{permission}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-ink/60">Non-admin accounts do not use admin permission flags.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="px-6 py-12 text-sm text-ink/60">No user accounts are available yet.</div>
        )}
      </div>
    </section>
  );
}
