"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AppUser, ComplianceAlert, ComplianceVehicleActivity, UserRole } from "@/types";
import { ADMIN_PERMISSION_KEYS, createAdminPermissions } from "@/lib/permissions";
import { formatMonthYear, getAccountDisplayReference } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

function normalizePermissions(user: AppUser) {
  if (user.role !== "admin" && user.role !== "super_admin") {
    return createAdminPermissions({
      manageVehicles: false,
      deleteListings: false,
      manageOffers: false,
      manageEnquiries: false,
      manageInspections: false,
      managePricing: false,
      manageQuotes: false,
      manageUsers: false,
      manageAdmins: false
    });
  }
  return createAdminPermissions(user.adminPermissions ?? {});
}

function createDraft(user: AppUser) {
  return {
    role: user.role,
    adminPermissions: normalizePermissions(user),
    roleTouched: false
  };
}

function formatComplianceEventType(eventType: ComplianceVehicleActivity["eventType"]) {
  if (eventType === "listing_published") return "Listing published";
  if (eventType === "listing_sold") return "Listing sold";
  return "Listing created";
}

function formatComplianceDate(value?: string) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

export function AdminAccessManager({
  users,
  complianceAlerts,
  onUserAccessUpdated,
}: {
  users: AppUser[];
  complianceAlerts: ComplianceAlert[];
  onUserAccessUpdated?: (user: AppUser) => void;
}) {
  const { appUser, firebaseUser } = useAuth();
  const [drafts, setDrafts] = useState<Record<string, ReturnType<typeof createDraft>>>(
    Object.fromEntries(users.map((user) => [user.id, createDraft(user)]))
  );
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedAlerts, setExpandedAlerts] = useState<Record<string, boolean>>({});
  const [showAllActivities, setShowAllActivities] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setDrafts(Object.fromEntries(users.map((user) => [user.id, createDraft(user)])));
  }, [users]);

  const orderedUsers = useMemo(() => {
    const complianceAlertsByUserId = new Map(complianceAlerts.map((alert) => [alert.userId, alert]));
    return [...users].sort((left, right) => {
      const leftAlertScore = Number(
        complianceAlertsByUserId.get(left.id)?.status === "open" || left.complianceStatus === "possible_unlicensed_trader"
      );
      const rightAlertScore = Number(
        complianceAlertsByUserId.get(right.id)?.status === "open" || right.complianceStatus === "possible_unlicensed_trader"
      );
      const leftScore = Number(left.role === "super_admin") * 2 + Number(left.role === "admin");
      const rightScore = Number(right.role === "super_admin") * 2 + Number(right.role === "admin");
      return (
        rightAlertScore - leftAlertScore
        || rightScore - leftScore
        || (left.displayName || left.email).localeCompare(right.displayName || right.email)
      );
    });
  }, [complianceAlerts, users]);

  const complianceAlertsByUserId = useMemo(
    () => new Map(complianceAlerts.map((alert) => [alert.userId, alert])),
    [complianceAlerts]
  );

  function updateDraft(userId: string, next: Partial<ReturnType<typeof createDraft>>) {
    setDrafts((current) => ({
      ...current,
      [userId]: {
        ...current[userId],
        ...next
      }
    }));
  }

  function toggleAlert(alertId: string) {
    setExpandedAlerts((current) => ({
      ...current,
      [alertId]: !current[alertId]
    }));
  }

  function toggleAllActivities(alertId: string) {
    setShowAllActivities((current) => ({
      ...current,
      [alertId]: !current[alertId]
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
      const nextRole = (draft.roleTouched ? draft.role : user.role) as UserRole;
      const nextPermissions = nextRole === "admin" || nextRole === "super_admin" ? draft.adminPermissions : undefined;
      const idToken = await firebaseUser?.getIdToken(true);

      if (!idToken) {
        throw new Error("Admin authentication has expired. Please sign in again.");
      }

      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/access`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          role: nextRole,
          adminPermissions: nextPermissions
        })
      });

      const result = await response.json().catch(() => null) as { success?: boolean; error?: string; message?: string; user?: AppUser } | null;
      if (!response.ok || !result?.success || !result.user) {
        throw new Error(result?.error || "Unable to update admin access.");
      }

      setDrafts((current) => ({
        ...current,
        [user.id]: createDraft(result.user as AppUser)
      }));
      onUserAccessUpdated?.(result.user);
      if (result.user.id === appUser.id) {
        await firebaseUser?.getIdToken(true).catch(() => undefined);
      }
      setSuccess(result.message || "Admin access updated successfully.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Something went wrong. Please try again.");
    } finally {
      setSavingUserId(null);
    }
  }

  async function repairKnownAdmins() {
    if (!appUser) {
      setError("You need to be signed in to manage admin access.");
      return;
    }

    setSavingUserId("repair-known-admins");
    setError("");
    setSuccess("");

    try {
      const idToken = await firebaseUser?.getIdToken(true);
      if (!idToken) {
        throw new Error("Admin authentication has expired. Please sign in again.");
      }

      const response = await fetch("/api/admin/users/repair-known-admins", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      });

      const result = await response.json().catch(() => null) as { success?: boolean; error?: string; message?: string; results?: Array<{ user: AppUser }> } | null;
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to repair known admin access.");
      }

      for (const item of result.results ?? []) {
        onUserAccessUpdated?.(item.user);
      }
      setSuccess(result.message || "Known admin access repaired successfully.");
    } catch (repairError) {
      setError(repairError instanceof Error ? repairError.message : "Unable to repair known admin access.");
    } finally {
      setSavingUserId(null);
    }
  }

  return (
    <section className="rounded-[32px] border border-black/5 bg-white shadow-panel">
      <div className="border-b border-black/5 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-bronze">Internal access</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">User roles and admin permissions</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/65">
              This screen is focused on internal admin accounts, promotion and revocation of admin access,
              and the working permission set stored in Firestore.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => repairKnownAdmins()}
            disabled={savingUserId === "repair-known-admins"}
            className="border border-black/10 bg-white text-ink hover:bg-shell"
          >
            {savingUserId === "repair-known-admins" ? "Repairing..." : "Repair Guanchao & Kevin"}
          </Button>
        </div>
        {success ? <p className="mt-4 text-sm text-emerald-700">{success}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </div>

      <div>
        {orderedUsers.length ? (
          orderedUsers.map((user) => {
            const draft = drafts[user.id] ?? createDraft(user);
            const isSuperAdmin = user.role === "super_admin";
            const isAdminLike = draft.role === "admin" || draft.role === "super_admin";
            const complianceAlert = complianceAlertsByUserId.get(user.id);
            const hasOpenComplianceAlert =
              complianceAlert?.status === "open" || user.complianceStatus === "possible_unlicensed_trader";
            const isAlertExpanded = complianceAlert ? Boolean(expandedAlerts[complianceAlert.id]) : false;
            const isShowingAllActivities = complianceAlert ? Boolean(showAllActivities[complianceAlert.id]) : false;
            const visibleActivities = complianceAlert
              ? (isShowingAllActivities ? complianceAlert.activities : complianceAlert.activities.slice(0, 10))
              : [];

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
                    {hasOpenComplianceAlert ? (
                      <span className="rounded-full border border-[#B42318]/15 bg-[#FEF3F2] px-3 py-2 text-xs font-semibold text-[#B42318]">
                        Possible Unlicensed Trader
                      </span>
                    ) : null}
                    <span className="rounded-full border border-black/10 bg-shell px-3 py-2 text-xs font-medium text-ink/72">
                      {user.role === "super_admin" ? "Super admin" : user.role}
                    </span>
                    <span className="rounded-full border border-black/10 bg-shell px-3 py-2 text-xs font-medium text-ink/72">
                      Member since {formatMonthYear(user.createdAt)}
                    </span>
                  </div>
                </div>

                {complianceAlert ? (
                  <div className="mt-5 rounded-[24px] border border-[#B42318]/10 bg-[#FEF3F2] px-5 py-4">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleAlert(complianceAlert.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleAlert(complianceAlert.id);
                        }
                      }}
                      className="flex cursor-pointer flex-wrap items-start justify-between gap-3"
                      aria-expanded={isAlertExpanded}
                    >
                      <div className="flex-1">
                        <p className="text-xs uppercase tracking-[0.18em] text-[#B42318]">Compliance alert</p>
                        <p className="mt-2 text-sm text-ink/75">
                          Rolling 12-month activity count: <span className="font-semibold text-ink">{complianceAlert.activityCount}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Link
                          href="/admin/vehicles"
                          onClick={(event) => event.stopPropagation()}
                          className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-ink transition hover:border-black/15 hover:bg-shell"
                        >
                          Review pending listings
                        </Link>
                        <span
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#B42318]/12 bg-white/80 text-[#B42318] transition ${isAlertExpanded ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        >
                          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                            <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </div>
                    </div>
                    {isAlertExpanded ? (
                      <div className="mt-4 space-y-2">
                        {visibleActivities.length ? (
                          <>
                            {visibleActivities.map((activity) => (
                              <div
                                key={`${complianceAlert.id}-${activity.vehicleId}-${activity.qualifyingAt}`}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/5 bg-white/80 px-4 py-3 text-sm text-ink/75"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium text-ink">{formatComplianceEventType(activity.eventType)}</span>
                                  <Link href={`/admin/vehicles/${activity.vehicleId}`} className="text-ink underline-offset-4 hover:underline">
                                    {activity.vehicleId}
                                  </Link>
                                </div>
                                <span>{formatComplianceDate(activity.qualifyingAt)}</span>
                              </div>
                            ))}
                            {complianceAlert.activities.length > 10 ? (
                              <button
                                type="button"
                                onClick={() => toggleAllActivities(complianceAlert.id)}
                                className="w-full rounded-2xl border border-black/10 bg-white/80 px-5 py-3 text-sm font-semibold text-ink transition hover:bg-white"
                              >
                                {isShowingAllActivities ? "Show fewer activities" : "View all activities"}
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <p className="text-sm text-ink/65">No qualifying listing activity has been logged yet.</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}

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
                            roleTouched: true,
                            adminPermissions:
                              event.target.value === "admin"
                                ? draft.adminPermissions
                                : createAdminPermissions({
                                    manageVehicles: false,
                                    deleteListings: false,
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
