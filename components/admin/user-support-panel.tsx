"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { getUserSupportActionTarget, getUserSupportRecord, getUserSupportSuggestions, listUsers, softDeleteVehicle, updateUserAccess, updateUserSupportStatus } from "@/lib/data";
import { hasAdminPermission, isSuperAdminUser } from "@/lib/permissions";
import { formatAdminDateTime, formatCurrency, getAccountDisplayReference, getVehicleDisplayReference } from "@/lib/utils";
import { AppUser, UserSupportDealerRiskAccount, UserSupportHighActivityAccount, UserSupportRecord, UserSupportSuggestion, VehicleActor } from "@/types";

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function buildActor(appUser: AppUser | null): VehicleActor | null {
  if (!appUser) return null;
  return {
    id: appUser.id,
    role: appUser.role,
    email: appUser.email,
    emailVerified: appUser.emailVerified,
    accountBanned: appUser.accountBanned,
    adminPermissions: appUser.adminPermissions,
    dealerVerified: appUser.dealerVerified,
    dealerStatus: appUser.dealerStatus,
    listingRestricted: appUser.listingRestricted
  };
}

function createEmptyUserSupportRecord(): UserSupportRecord {
  return {
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
  };
}

function getRoleAccessLabel(user: AppUser) {
  if (user.role === "super_admin") return "Super Admin";
  if (user.role === "admin") return "Admin";
  return "View only";
}

function getRoleActionLabel(nextRole: AppUser["role"]) {
  if (nextRole === "super_admin") return "Grant super admin";
  if (nextRole === "admin") return "Grant admin";
  return "Revoke admin";
}

function getEffectiveLastLoginLabel(user: AppUser) {
  return user.lastLoginAt ? formatAdminDateTime(user.lastLoginAt) : "Not recorded";
}

function resolveRevokedRole(user: AppUser): AppUser["role"] {
  if (user.role === "buyer") return "buyer";
  if (user.role === "dealer" || user.accountType === "dealer" || user.dealerStatus === "approved") return "dealer";
  return "seller";
}

function matchesUserSearch(user: AppUser, normalizedSearch: string) {
  if (!normalizedSearch) return true;

  const haystacks = [
    user.email,
    user.displayName,
    user.name,
    user.phone,
    user.id,
    user.accountReference
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return haystacks.some((value) => value.includes(normalizedSearch));
}

export function UserSupportPanel({
  initialQuery,
  initialRecord,
  initialHighActivityAccounts,
  initialDealerRiskAccounts
}: {
  initialQuery: string;
  initialRecord: UserSupportRecord;
  initialHighActivityAccounts: UserSupportHighActivityAccount[];
  initialDealerRiskAccounts: UserSupportDealerRiskAccount[];
}) {
  const router = useRouter();
  const { appUser, requestPasswordReset } = useAuth();
  const [query, setQuery] = useState(initialQuery);
  const [record, setRecord] = useState(initialRecord);
  const [suggestions, setSuggestions] = useState<UserSupportSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [highActivityOpen, setHighActivityOpen] = useState(false);
  const [expandedHighActivityUsers, setExpandedHighActivityUsers] = useState<Record<string, boolean>>({});
  const [dealerRiskOpen, setDealerRiskOpen] = useState(false);
  const [expandedDealerRiskUsers, setExpandedDealerRiskUsers] = useState<Record<string, boolean>>({});
  const [busyAction, setBusyAction] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [userDirectory, setUserDirectory] = useState<AppUser[]>([]);
  const [loadingUserDirectory, setLoadingUserDirectory] = useState(false);
  const [userDirectoryError, setUserDirectoryError] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [pendingRoleChange, setPendingRoleChange] = useState<{ user: AppUser; nextRole: AppUser["role"] } | null>(null);
  const normalizedQuery = normalizeQuery(query);
  const matchedUser = record.matchedUser;
  const matchedVehicle = record.matchedVehicle;
  const ownedVehicles = record.ownedVehicles;
  const accountMetrics = record.metrics;
  const canDeleteListings = hasAdminPermission(appUser, "deleteListings");
  const canViewUsers = hasAdminPermission(appUser, "manageUsers");
  const canManageRoles = isSuperAdminUser(appUser);
  const matchedUserDisplayName = matchedUser?.displayName || matchedUser?.name || matchedUser?.email || "Unknown user";
  const matchedUserEmail = matchedUser?.email || "No email on file";
  const matchedUserSearchValue = matchedUser?.email || "";
  const filteredUserDirectory = useMemo(
    () => userDirectory.filter((user) => matchesUserSearch(user, normalizeQuery(roleSearch))),
    [roleSearch, userDirectory]
  );

  useEffect(() => {
    setRecord(initialRecord);
  }, [initialRecord]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const nextQuery = initialQuery.trim();
    let isCancelled = false;

    if (!nextQuery) {
      setRecord(initialRecord);
      setLoadingRecord(false);
      return;
    }

    setLoadingRecord(true);
    setError("");

    void getUserSupportRecord(nextQuery)
      .then((nextRecord) => {
        if (isCancelled) return;
        setRecord(nextRecord);
      })
      .catch((recordError) => {
        if (isCancelled) return;
        setRecord(createEmptyUserSupportRecord());
        setError(recordError instanceof Error ? recordError.message : "Unable to load that support record right now.");
      })
      .finally(() => {
        if (isCancelled) return;
        setLoadingRecord(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [initialQuery, initialRecord]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery || trimmedQuery === initialQuery.trim()) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const nextSuggestions = await getUserSupportSuggestions(trimmedQuery, 10);
        setSuggestions(nextSuggestions);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [initialQuery, query]);

  useEffect(() => {
    let cancelled = false;

    async function loadUserDirectory() {
      if (!canViewUsers) return;
      setLoadingUserDirectory(true);
      setUserDirectoryError("");

      try {
        const nextUsers = await listUsers();
        if (cancelled) return;
        setUserDirectory(nextUsers);
      } catch (directoryError) {
        if (cancelled) return;
        setUserDirectory([]);
        setUserDirectoryError(directoryError instanceof Error ? directoryError.message : "Unable to load registered users right now.");
      } finally {
        if (cancelled) return;
        setLoadingUserDirectory(false);
      }
    }

    void loadUserDirectory();

    return () => {
      cancelled = true;
    };
  }, [canViewUsers]);

  async function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess("");
    setError("");
    setShowSuggestions(false);
    const nextQuery = query.trim();
    router.replace(nextQuery ? `/admin/user-support?q=${encodeURIComponent(nextQuery)}` : "/admin/user-support");
  }

  async function handleSupportStatusAction(action: "ban" | "unban" | "restrict" | "remove_restriction") {
    if (!matchedUser) return;
    const actor = buildActor(appUser);
    if (!actor) {
      setError("You need to be signed in to use support actions.");
      return;
    }

    setBusyAction(action);
    setSuccess("");
    setError("");

    try {
      const result = await updateUserSupportStatus(matchedUser.id, action, actor, matchedUser);
      setRecord((current) => ({
        ...current,
        matchedUser: result.user
      }));
      setSuccess(
        action === "ban"
          ? "Account banned."
          : action === "unban"
            ? "Account unbanned."
            : action === "restrict"
              ? "Account restricted."
              : "Restriction removed."
      );
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Something went wrong. Please try again.");
    } finally {
      setBusyAction("");
    }
  }

  async function handlePasswordReset() {
    if (!matchedUser?.email) return;
    const actor = buildActor(appUser);
    if (!actor) {
      setError("You need to be signed in to use support actions.");
      return;
    }

    setBusyAction("password-reset");
    setSuccess("");
    setError("");

    try {
      const targetUser = await getUserSupportActionTarget(matchedUser.id, actor, matchedUser);
      console.log("SUPPORT_ACTION", {
        action: "password_reset",
        targetUserId: targetUser.id,
        adminUserId: actor.id,
        adminEmail: actor.email ?? ""
      });
      await requestPasswordReset(targetUser.email);
      setSuccess(`Password reset link sent to ${targetUser.email}.`);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Unable to send password reset link.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleDeleteVehicle(vehicleId: string) {
    const actor = buildActor(appUser);
    const targetVehicle =
      (matchedVehicle?.id === vehicleId ? matchedVehicle : null)
      ?? ownedVehicles.find((vehicle) => vehicle.id === vehicleId)
      ?? null;

    if (!actor || !targetVehicle || !canDeleteListings || targetVehicle.deleted) return;
    if (!window.confirm("Soft delete this listing? It will be removed from normal public inventory.")) return;

    const deleteReason = window.prompt("Optional delete reason", targetVehicle.deleteReason ?? "") ?? "";

    setBusyAction(`delete-${vehicleId}`);
    setSuccess("");
    setError("");

    try {
      const result = await softDeleteVehicle(vehicleId, actor, targetVehicle, deleteReason);
      setRecord((current) => ({
        ...current,
        matchedVehicle: current.matchedVehicle?.id === vehicleId ? result.vehicle : current.matchedVehicle,
        ownedVehicles: current.ownedVehicles.map((vehicle) => (vehicle.id === vehicleId ? result.vehicle : vehicle))
      }));
      setSuccess("Listing soft deleted.");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete listing.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleConfirmRoleChange() {
    if (!pendingRoleChange) return;

    const actor = buildActor(appUser);
    if (!actor || !canManageRoles) {
      setError("Only the super admin can change backend access.");
      setPendingRoleChange(null);
      return;
    }

    const { user, nextRole } = pendingRoleChange;
    setBusyAction(`role-${user.id}`);
    setSuccess("");
    setError("");

    try {
      const result = await updateUserAccess(
        user.id,
        {
          role: nextRole
        },
        actor,
        user
      );

      setUserDirectory((current) => current.map((entry) => (entry.id === user.id ? result.user : entry)));
      if (matchedUser?.id === user.id) {
        setRecord((current) => ({
          ...current,
          matchedUser: result.user
        }));
      }
      setSuccess(`${user.displayName || user.email} is now ${getRoleAccessLabel(result.user)}.`);
      setPendingRoleChange(null);
      router.refresh();
    } catch (roleError) {
      setError(roleError instanceof Error ? roleError.message : "Unable to update that role right now.");
    } finally {
      setBusyAction("");
    }
  }

  function getRiskBadgeClasses(riskLevel: UserSupportDealerRiskAccount["riskLevel"]) {
    if (riskLevel === "high") {
      return "border-[#B42318]/15 bg-[#FEF3F2] text-[#B42318]";
    }
    if (riskLevel === "medium") {
      return "border-[#B54708]/15 bg-[#FFF7ED] text-[#B54708]";
    }
    return "border-[#067647]/15 bg-[#ECFDF3] text-[#067647]";
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
        <p className="text-xs uppercase tracking-[0.26em] text-bronze">Phase 1 support</p>
        <h2 className="mt-3 text-2xl font-semibold text-ink">Find a user or listing</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
          Search by exact email, listing ID, or vehicle ID to open a focused support view without loading every customer account at once.
        </p>
        <form onSubmit={handleSearchSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Exact email, listing ID, or vehicle ID"
            className="h-12"
          />
          <div className="flex gap-3">
            <Button type="submit">Search</Button>
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSuccess("");
                  setError("");
                  router.replace("/admin/user-support");
                }}
                className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-black/15 hover:bg-shell"
              >
                Clear
              </button>
            ) : null}
          </div>
        </form>
        {showSuggestions && (loadingSuggestions || suggestions.length) ? (
          <div className="mt-3 rounded-[24px] border border-black/10 bg-white shadow-panel">
            {loadingSuggestions ? (
              <div className="px-4 py-3 text-sm text-ink/60">Searching...</div>
            ) : (
              suggestions.map((item) => (
                <button
                  key={`${item.type}:${item.id}`}
                  type="button"
                  onClick={() => {
                    setQuery(item.queryValue);
                    setShowSuggestions(false);
                    setSuccess("");
                    setError("");
                    router.replace(`/admin/user-support?q=${encodeURIComponent(item.queryValue)}`);
                  }}
                  className="flex w-full items-start justify-between gap-4 border-b border-black/5 px-4 py-3 text-left last:border-b-0 hover:bg-shell"
                >
                  <div>
                    <p className="font-medium text-ink">{item.email || item.name}</p>
                    <p className="mt-1 text-sm text-ink/60">{item.email && item.name !== item.email ? item.name : item.id}</p>
                  </div>
                  <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/60">
                    {item.type === "user" ? "User" : "Listing"}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : null}
        {success ? <p className="mt-4 text-sm text-emerald-700">{success}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="rounded-[28px] border border-black/5 bg-white shadow-panel">
        <div className="border-b border-black/5 px-6 py-5">
          <p className="text-xs uppercase tracking-[0.22em] text-bronze">Access support</p>
          <h3 className="mt-2 text-xl font-semibold text-ink">Registered users</h3>
          <p className="mt-2 max-w-3xl text-sm text-ink/65">
            Search by email, name, phone, or UID. Only trusted super admins should change backend access.
          </p>
          <p className="mt-3 rounded-[18px] border border-[#9D6B2F]/15 bg-[#FFF7ED] px-4 py-3 text-sm text-[#9D6B2F]">
            Role changes affect backend access. Only grant admin access to trusted staff.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Input
              value={roleSearch}
              onChange={(event) => setRoleSearch(event.target.value)}
              placeholder="Search users by email, name, phone, or UID"
              className="h-12"
            />
            <div className="inline-flex items-center rounded-full border border-black/10 bg-shell px-4 py-3 text-sm text-ink/65">
              {canManageRoles ? "Super Admin" : "View only"}
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          {loadingUserDirectory ? (
            <p className="text-sm text-ink/60">Loading registered users...</p>
          ) : userDirectoryError ? (
            <p className="text-sm text-red-600">{userDirectoryError}</p>
          ) : filteredUserDirectory.length ? (
            <div className="space-y-3">
              {filteredUserDirectory.slice(0, 25).map((user) => {
                const revokeRole = resolveRevokedRole(user);
                const canGrantAdmin = canManageRoles && user.role !== "admin" && user.role !== "super_admin";
                const canGrantSuperAdmin = canManageRoles && user.role !== "super_admin";
                const canRevokeAdmin = canManageRoles && (user.role === "admin" || user.role === "super_admin");
                const isSelfSuperAdmin = appUser?.id === user.id && user.role === "super_admin";

                return (
                  <div key={user.id} className="rounded-[22px] border border-black/6 bg-shell px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-ink">{user.displayName || user.name || user.email}</p>
                          <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/60">
                            {getRoleAccessLabel(user)}
                          </span>
                        </div>
                        <div className="mt-2 grid gap-3 text-sm text-ink/65 md:grid-cols-2 xl:grid-cols-3">
                          <p>Email: {user.email || "No email"}</p>
                          <p>Phone: {user.phone || "Not provided"}</p>
                          <p>UID: {user.id}</p>
                          <p>Created: {formatAdminDateTime(user.createdAt)}</p>
                          <p>Last login: {getEffectiveLastLoginLabel(user)}</p>
                          <p>Reference: {getAccountDisplayReference(user)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {canGrantAdmin ? (
                          <button
                            type="button"
                            onClick={() => setPendingRoleChange({ user, nextRole: "admin" })}
                            disabled={busyAction === `role-${user.id}`}
                            className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-ink transition hover:border-black/15 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Grant admin
                          </button>
                        ) : null}
                        {canGrantSuperAdmin ? (
                          <button
                            type="button"
                            onClick={() => setPendingRoleChange({ user, nextRole: "super_admin" })}
                            disabled={busyAction === `role-${user.id}`}
                            className="rounded-full border border-[#9D6B2F]/20 bg-[#FFF7ED] px-4 py-2 text-xs font-semibold text-[#9D6B2F] transition hover:border-[#9D6B2F]/30 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Grant super admin
                          </button>
                        ) : null}
                        {canRevokeAdmin ? (
                          <button
                            type="button"
                            onClick={() => setPendingRoleChange({ user, nextRole: revokeRole })}
                            disabled={busyAction === `role-${user.id}` || isSelfSuperAdmin}
                            className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-red-800 transition hover:border-black/15 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Revoke admin
                          </button>
                        ) : null}
                        {!canManageRoles ? (
                          <span className="inline-flex items-center rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-ink/60">
                            View only
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-ink/60">No registered users matched that search.</p>
          )}
        </div>
      </div>

      <div className="rounded-[28px] border border-black/5 bg-white shadow-panel">
        <button
          type="button"
          onClick={() => setDealerRiskOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-bronze">Admin signal</p>
            <h3 className="mt-2 text-xl font-semibold text-ink">Dealer Risk Monitoring</h3>
            <p className="mt-2 text-sm text-ink/60">Risk-scored accounts based on recent selling activity, account overlap, and listing patterns.</p>
          </div>
          <span className={`text-xl text-ink/50 transition-transform ${dealerRiskOpen ? "rotate-180" : ""}`}>⌄</span>
        </button>
        {dealerRiskOpen ? (
          <div className="border-t border-black/5 px-6 py-5">
            {initialDealerRiskAccounts.length ? (
              <div className="space-y-3">
                {initialDealerRiskAccounts.map((account) => {
                  const isExpanded = expandedDealerRiskUsers[account.user.id] ?? false;

                  return (
                    <div key={account.user.id} className="rounded-[24px] border border-black/8 bg-shell">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedDealerRiskUsers((current) => ({
                            ...current,
                            [account.user.id]: !isExpanded
                          }))
                        }
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-ink">{account.user.displayName || account.user.name || account.user.email}</p>
                            <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getRiskBadgeClasses(account.riskLevel)}`}>
                              {account.riskLevel} risk
                            </span>
                          </div>
                          <p className="text-sm text-ink/65">{account.user.email}</p>
                          <p className="text-sm text-ink/60">
                            Risk score: {account.riskScore} · Sold listings (12 months): {account.soldListingsLast12Months} · Active listings: {account.activeListings}
                            {" · "}Listings created last 30 days: {account.listingsCreatedLast30Days}
                          </p>
                        </div>
                        <span className={`text-lg text-ink/45 transition-transform ${isExpanded ? "rotate-180" : ""}`}>⌄</span>
                      </button>

                      {isExpanded ? (
                        <div className="border-t border-black/8 px-5 py-4">
                          <div className="mb-4 flex flex-wrap gap-3">
                            <Link
                              href={`/admin/user-support?q=${encodeURIComponent(account.user.email)}`}
                              className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-ink transition hover:border-black/15"
                            >
                              Open support view
                            </Link>
                          </div>
                          <div className="mb-4 rounded-[18px] bg-white px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-bronze">Risk reasons</p>
                            <div className="mt-3 space-y-2">
                              {account.riskReasons.map((reason) => (
                                <p key={reason} className="text-sm text-ink/70">
                                  {reason}
                                </p>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-3">
                            {account.listings.map((vehicle) => (
                              <div key={vehicle.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[18px] bg-white px-4 py-3">
                                <div>
                                  <p className="font-medium text-ink">
                                    {vehicle.year} {vehicle.make} {vehicle.model}
                                  </p>
                                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink/45">Listing ID: {getVehicleDisplayReference(vehicle)}</p>
                                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink/45">Vehicle ID: {vehicle.id}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-sm text-ink/65">
                                  <span>{formatCurrency(vehicle.price)}</span>
                                  <span>{vehicle.status}</span>
                                  <span>{vehicle.sellerStatus}</span>
                                  <Link href={`/admin/vehicles/${vehicle.id}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                                    Open listing
                                  </Link>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-ink/60">No elevated dealer-risk accounts were found from the current listing activity signals.</p>
            )}
          </div>
        ) : null}
      </div>

      <div className="rounded-[28px] border border-black/5 bg-white shadow-panel">
        <button
          type="button"
          onClick={() => setHighActivityOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-bronze">Admin signal</p>
            <h3 className="mt-2 text-xl font-semibold text-ink">High activity accounts (last 12 months)</h3>
            <p className="mt-2 text-sm text-ink/60">Users with more than 4 sold listings in the last 12 months, ranked by sold volume.</p>
          </div>
          <span className={`text-xl text-ink/50 transition-transform ${highActivityOpen ? "rotate-180" : ""}`}>⌄</span>
        </button>
        {highActivityOpen ? (
          <div className="border-t border-black/5 px-6 py-5">
            {initialHighActivityAccounts.length ? (
              <div className="space-y-3">
                {initialHighActivityAccounts.map((account) => {
                  const isExpanded = expandedHighActivityUsers[account.user.id] ?? false;

                  return (
                    <div key={account.user.id} className="rounded-[24px] border border-black/8 bg-shell">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedHighActivityUsers((current) => ({
                            ...current,
                            [account.user.id]: !isExpanded
                          }))
                        }
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                      >
                        <div className="space-y-1">
                          <p className="font-semibold text-ink">{account.user.displayName || account.user.name || account.user.email}</p>
                          <p className="text-sm text-ink/65">{account.user.email}</p>
                          <p className="text-sm text-ink/60">
                            Total listings: {account.totalListings} · Sold listings (12 months): {account.soldListingsLast12Months} · Member since:{" "}
                            {account.user.createdAt ? formatAdminDateTime(account.user.createdAt) : "Not available"}
                          </p>
                        </div>
                        <span className={`text-lg text-ink/45 transition-transform ${isExpanded ? "rotate-180" : ""}`}>⌄</span>
                      </button>

                      {isExpanded ? (
                        <div className="border-t border-black/8 px-5 py-4">
                          <div className="mb-4 flex flex-wrap gap-3">
                            <Link
                              href={`/admin/user-support?q=${encodeURIComponent(account.user.email)}`}
                              className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-ink transition hover:border-black/15"
                            >
                              Open support view
                            </Link>
                          </div>
                          <div className="space-y-3">
                            {account.soldListings.map((vehicle) => (
                              <div key={vehicle.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[18px] bg-white px-4 py-3">
                                <div>
                                  <p className="font-medium text-ink">
                                    {vehicle.year} {vehicle.make} {vehicle.model}
                                  </p>
                                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink/45">Listing ID: {getVehicleDisplayReference(vehicle)}</p>
                                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink/45">Vehicle ID: {vehicle.id}</p>
                                  <p className="mt-1 text-sm text-ink/60">Sold: {vehicle.soldAt ? formatAdminDateTime(vehicle.soldAt) : "Not available"}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-sm text-ink/65">
                                  <span>{formatCurrency(vehicle.price)}</span>
                                  <Link href={`/admin/vehicles/${vehicle.id}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                                    Open listing
                                  </Link>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-ink/60">No accounts currently have more than 4 sold listings in the last 12 months.</p>
            )}
          </div>
        ) : null}
      </div>

      {!normalizedQuery ? (
        <div className="rounded-[28px] border border-black/5 bg-white p-8 text-sm text-ink/60 shadow-panel">
          Enter an exact email, listing ID, or vehicle ID to open a support record.
        </div>
      ) : loadingRecord ? (
        <div className="rounded-[28px] border border-black/5 bg-white p-8 text-sm text-ink/60 shadow-panel">
          Loading support record...
        </div>
      ) : !matchedUser && !matchedVehicle ? (
        <div className="rounded-[28px] border border-black/5 bg-white p-8 text-sm text-ink/60 shadow-panel">
          No exact match found for that email or listing reference.
        </div>
      ) : (
        <>
          {matchedVehicle ? (
            <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
              <p className="text-xs uppercase tracking-[0.22em] text-bronze">Listing result</p>
              <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-ink">
                    {matchedVehicle.year} {matchedVehicle.make} {matchedVehicle.model}
                  </p>
                  <p className="mt-1 text-sm text-ink/60">Listing ID: {getVehicleDisplayReference(matchedVehicle)}</p>
                  <p className="mt-1 text-sm text-ink/60">Vehicle ID: {matchedVehicle.id}</p>
                  <p className="mt-2 text-sm text-ink/70">
                    {formatCurrency(matchedVehicle.price)} · {matchedVehicle.status} · {matchedVehicle.sellerStatus}
                  </p>
                  {matchedVehicle.deleted ? <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-700">Soft deleted</p> : null}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/admin/vehicles/${matchedVehicle.id}`}
                    className="rounded-full border border-black/10 bg-shell px-4 py-2 text-xs font-semibold text-ink transition hover:border-black/15"
                  >
                    Open listing
                  </Link>
                  {canDeleteListings ? (
                    <button
                      type="button"
                      onClick={() => void handleDeleteVehicle(matchedVehicle.id)}
                      disabled={busyAction === `delete-${matchedVehicle.id}` || matchedVehicle.deleted}
                      className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-red-800 transition hover:border-black/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {matchedVehicle.deleted ? "Deleted" : busyAction === `delete-${matchedVehicle.id}` ? "Deleting..." : "Delete listing"}
                    </button>
                  ) : null}
                  {matchedUser && matchedUserSearchValue ? (
                    <Link
                      href={`/admin/user-support?q=${encodeURIComponent(matchedUserSearchValue)}`}
                      className="rounded-full border border-black/10 bg-shell px-4 py-2 text-xs font-semibold text-ink transition hover:border-black/15"
                    >
                      Open owner support view
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {matchedUser ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">Total listings: {accountMetrics.totalListings}</div>
                <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">Live listings: {accountMetrics.liveListings}</div>
                <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">Sold listings: {accountMetrics.soldListings}</div>
                <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">Pending listings: {accountMetrics.pendingListings}</div>
                <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">Total offers: {accountMetrics.totalOffers}</div>
                <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">Total enquiries: {accountMetrics.totalEnquiries}</div>
                <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">Total inspections: {accountMetrics.totalInspections}</div>
              </div>

              <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-bronze">Account</p>
                    <h3 className="mt-2 text-2xl font-semibold text-ink">{matchedUserDisplayName}</h3>
                    <p className="mt-2 text-sm text-ink/65">{matchedUserEmail}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-black/10 bg-shell px-3 py-2 text-xs font-medium text-ink/72">{matchedUser.role}</span>
                    {matchedUser.accountBanned ? (
                      <span className="rounded-full border border-[#B42318]/15 bg-[#FEF3F2] px-3 py-2 text-xs font-semibold text-[#B42318]">Banned</span>
                    ) : null}
                    {matchedUser.listingRestricted ? (
                      <span className="rounded-full border border-[#9D6B2F]/15 bg-[#FFF7ED] px-3 py-2 text-xs font-semibold text-[#9D6B2F]">Restricted</span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Name</p>
                    <p className="mt-2 text-sm text-ink">{matchedUserDisplayName}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Phone</p>
                    <p className="mt-2 text-sm text-ink">{matchedUser.phone || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Reference</p>
                    <p className="mt-2 text-sm text-ink">{getAccountDisplayReference(matchedUser)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Email verified</p>
                    <p className="mt-2 text-sm text-ink">{matchedUser.emailVerified ? "Verified" : "Not verified"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Created</p>
                    <p className="mt-2 text-sm text-ink">{formatAdminDateTime(matchedUser.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Restricted</p>
                    <p className="mt-2 text-sm text-ink">{matchedUser.listingRestricted ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Banned</p>
                    <p className="mt-2 text-sm text-ink">{matchedUser.accountBanned ? "Yes" : "No"}</p>
                  </div>
                </div>

                <details className="mt-6 rounded-[20px] border border-black/5 bg-shell px-4 py-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.18em] text-ink/55">
                    Technical details
                  </summary>
                  <div className="mt-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Firebase UID</p>
                    <p className="mt-2 break-all text-sm text-ink">{matchedUser.id}</p>
                  </div>
                </details>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button onClick={handlePasswordReset} disabled={busyAction === "password-reset"}>
                    {busyAction === "password-reset" ? "Sending..." : "Send password reset link"}
                  </Button>
                  {matchedUser.accountBanned ? (
                    <button
                      type="button"
                      onClick={() => void handleSupportStatusAction("unban")}
                      disabled={busyAction === "unban"}
                      className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-black/15 hover:bg-shell disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyAction === "unban" ? "Saving..." : "Unban account"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleSupportStatusAction("ban")}
                      disabled={busyAction === "ban"}
                      className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-black/15 hover:bg-shell disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyAction === "ban" ? "Saving..." : "Ban account"}
                    </button>
                  )}
                  {matchedUser.listingRestricted ? (
                    <button
                      type="button"
                      onClick={() => void handleSupportStatusAction("remove_restriction")}
                      disabled={busyAction === "remove_restriction"}
                      className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-black/15 hover:bg-shell disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyAction === "remove_restriction" ? "Saving..." : "Remove restriction"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleSupportStatusAction("restrict")}
                      disabled={busyAction === "restrict"}
                      className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-black/15 hover:bg-shell disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyAction === "restrict" ? "Saving..." : "Restrict account"}
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
                <p className="text-xs uppercase tracking-[0.22em] text-bronze">Owned listings</p>
                <div className="mt-4 space-y-3">
                  {ownedVehicles.length ? (
                    ownedVehicles
                      .slice()
                      .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""))
                      .map((vehicle) => (
                        <div key={vehicle.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-shell px-4 py-3">
                          <div>
                            <p className="font-medium text-ink">
                              {vehicle.year} {vehicle.make} {vehicle.model}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink/45">Listing ID: {getVehicleDisplayReference(vehicle)}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink/45">Vehicle ID: {vehicle.id}</p>
                            {vehicle.deleted ? <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-700">Soft deleted</p> : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-ink/65">
                            <span>{formatCurrency(vehicle.price)}</span>
                            <span>{vehicle.status}</span>
                            <span>{vehicle.sellerStatus}</span>
                            <Link href={`/admin/vehicles/${vehicle.id}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                              Open listing
                            </Link>
                            {canDeleteListings ? (
                              <button
                                type="button"
                                onClick={() => void handleDeleteVehicle(vehicle.id)}
                                disabled={busyAction === `delete-${vehicle.id}` || vehicle.deleted}
                                className="font-semibold text-red-800 underline-offset-4 hover:underline disabled:no-underline disabled:opacity-60"
                              >
                                {vehicle.deleted ? "Deleted" : busyAction === `delete-${vehicle.id}` ? "Deleting..." : "Delete"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="text-sm text-ink/60">No listings are currently linked to this account.</p>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </>
      )}

      {pendingRoleChange ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
            <p className="text-xs uppercase tracking-[0.22em] text-bronze">Confirm role change</p>
            <h3 className="mt-2 text-2xl font-semibold text-ink">{getRoleActionLabel(pendingRoleChange.nextRole)}</h3>
            <p className="mt-3 text-sm leading-6 text-ink/65">
              {pendingRoleChange.user.displayName || pendingRoleChange.user.email} will move from{" "}
              <span className="font-semibold text-ink">{getRoleAccessLabel(pendingRoleChange.user)}</span> to{" "}
              <span className="font-semibold text-ink">
                {pendingRoleChange.nextRole === "super_admin" ? "Super Admin" : pendingRoleChange.nextRole === "admin" ? "Admin" : "View only"}
              </span>.
            </p>
            <p className="mt-3 text-sm leading-6 text-ink/65">
              This updates backend access immediately. Continue only if this staff member should have that level of access.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingRoleChange(null)}
                className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-black/15 hover:bg-shell"
              >
                Cancel
              </button>
              <Button onClick={() => void handleConfirmRoleChange()} disabled={busyAction === `role-${pendingRoleChange.user.id}`}>
                {busyAction === `role-${pendingRoleChange.user.id}` ? "Saving..." : "Confirm change"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
