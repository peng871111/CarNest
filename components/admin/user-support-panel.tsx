"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { getUserSupportSuggestions, updateUserSupportStatus } from "@/lib/data";
import { formatAdminDateTime, formatCurrency, getAccountDisplayReference, getVehicleDisplayReference } from "@/lib/utils";
import { AppUser, UserSupportRecord, UserSupportSuggestion, VehicleActor } from "@/types";

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

export function UserSupportPanel({
  initialQuery,
  initialRecord
}: {
  initialQuery: string;
  initialRecord: UserSupportRecord;
}) {
  const router = useRouter();
  const { appUser, requestPasswordReset } = useAuth();
  const [query, setQuery] = useState(initialQuery);
  const [record, setRecord] = useState(initialRecord);
  const [suggestions, setSuggestions] = useState<UserSupportSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const normalizedQuery = normalizeQuery(query);
  const matchedUser = record.matchedUser;
  const matchedVehicle = record.matchedVehicle;
  const ownedVehicles = record.ownedVehicles;
  const accountMetrics = record.metrics;

  useEffect(() => {
    setRecord(initialRecord);
  }, [initialRecord]);

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

    setBusyAction("password-reset");
    setSuccess("");
    setError("");

    try {
      await requestPasswordReset(matchedUser.email);
      setSuccess(`Password reset link sent to ${matchedUser.email}.`);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Unable to send password reset link.");
    } finally {
      setBusyAction("");
    }
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

      {!normalizedQuery ? (
        <div className="rounded-[28px] border border-black/5 bg-white p-8 text-sm text-ink/60 shadow-panel">
          Enter an exact email, listing ID, or vehicle ID to open a support record.
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
                  <p className="mt-1 text-sm text-ink/60">{getVehicleDisplayReference(matchedVehicle)}</p>
                  <p className="mt-2 text-sm text-ink/70">{formatCurrency(matchedVehicle.price)}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/admin/vehicles/${matchedVehicle.id}`}
                    className="rounded-full border border-black/10 bg-shell px-4 py-2 text-xs font-semibold text-ink transition hover:border-black/15"
                  >
                    Open listing
                  </Link>
                  {matchedUser ? (
                    <Link
                      href={`/admin/user-support?q=${encodeURIComponent(matchedUser.email)}`}
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
                    <h3 className="mt-2 text-2xl font-semibold text-ink">{matchedUser.displayName || matchedUser.name || matchedUser.email}</h3>
                    <p className="mt-2 text-sm text-ink/65">{matchedUser.email}</p>
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
                    <p className="mt-2 text-sm text-ink">{matchedUser.displayName || matchedUser.name || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Phone</p>
                    <p className="mt-2 text-sm text-ink">{matchedUser.phone || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-ink/45">User ID</p>
                    <p className="mt-2 text-sm text-ink">{matchedUser.id}</p>
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
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink/45">{getVehicleDisplayReference(vehicle)}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-ink/65">
                            <span>{vehicle.status}</span>
                            <span>{vehicle.sellerStatus}</span>
                            <Link href={`/admin/vehicles/${vehicle.id}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                              Open listing
                            </Link>
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
    </section>
  );
}
