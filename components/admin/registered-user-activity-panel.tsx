"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { formatAdminDateTime, getAccountDisplayReference } from "@/lib/utils";
import { AppUser, RegisteredUserVehicleViewActivity } from "@/types";

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function matchesUser(user: AppUser, search: string) {
  if (!search) return true;
  return [user.email, user.displayName, user.name, user.phone, user.id, user.accountReference]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
    .some((value) => value.includes(search));
}

export function RegisteredUserActivityPanel({ users }: { users: AppUser[] }) {
  const { firebaseUser } = useAuth();
  const [search, setSearch] = useState("");
  const [activityUser, setActivityUser] = useState<AppUser | null>(null);
  const [activityItems, setActivityItems] = useState<RegisteredUserVehicleViewActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");

  const visibleUsers = useMemo(() => {
    const normalized = normalizeSearch(search);
    return users
      .filter((user) => matchesUser(user, normalized))
      .sort((left, right) => (left.displayName || left.name || left.email).localeCompare(right.displayName || right.name || right.email));
  }, [search, users]);

  async function openActivity(user: AppUser) {
    setActivityUser(user);
    setActivityItems([]);
    setActivityError("");
    setActivityLoading(true);

    try {
      const idToken = await firebaseUser?.getIdToken(true);
      if (!idToken) {
        throw new Error("Admin authentication has expired. Please sign in again.");
      }

      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/vehicle-view-history`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`
        },
        cache: "no-store"
      });
      const result = await response.json().catch(() => null) as {
        success?: boolean;
        error?: string;
        items?: RegisteredUserVehicleViewActivity[];
      } | null;

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to load vehicle viewing activity.");
      }

      setActivityItems(result.items ?? []);
    } catch (error) {
      setActivityItems([]);
      setActivityError(error instanceof Error ? error.message : "Unable to load vehicle viewing activity.");
    } finally {
      setActivityLoading(false);
    }
  }

  return (
    <section className="rounded-[32px] border border-black/5 bg-white shadow-panel">
      <div className="border-b border-black/5 px-6 py-5">
        <p className="text-xs uppercase tracking-[0.24em] text-bronze">Registered users</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">Vehicle viewing activity</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/65">
          Review authenticated customer vehicle viewing history without changing admin access or role controls.
        </p>
        <div className="mt-4 max-w-xl">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search users by email, name, phone, or UID"
            className="h-12"
          />
        </div>
      </div>

      <div className="px-6 py-5">
        {visibleUsers.length ? (
          <div className="space-y-3">
            {visibleUsers.map((user) => (
              <div key={user.id} className="rounded-[22px] border border-black/6 bg-shell px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">{user.displayName || user.name || user.email}</p>
                      <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/60">
                        {user.role}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-3 text-sm text-ink/65 md:grid-cols-2 xl:grid-cols-3">
                      <p>Email: {user.email || "No email"}</p>
                      <p>Phone: {user.phone || "Not provided"}</p>
                      <p>UID: {user.id}</p>
                      <p>Created: {formatAdminDateTime(user.createdAt, "Not available")}</p>
                      <p>Reference: {getAccountDisplayReference(user)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void openActivity(user)}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-ink transition hover:border-black/15 hover:bg-white"
                  >
                    View activity
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink/60">No registered users matched that search.</p>
        )}
      </div>

      {activityUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 px-4 py-6">
          <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/5 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-bronze">Vehicle viewing activity</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">
                  {activityUser.displayName || activityUser.name || activityUser.email}
                </h3>
                <p className="mt-1 text-sm text-ink/60">{activityUser.email || activityUser.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setActivityUser(null)}
                className="rounded-full border border-black/10 bg-shell px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white"
              >
                Close
              </button>
            </div>
            <div className="max-h-[68vh] overflow-y-auto px-6 py-5">
              {activityLoading ? (
                <p className="text-sm text-ink/60">Loading vehicle viewing activity...</p>
              ) : activityError ? (
                <p className="text-sm text-red-600">{activityError}</p>
              ) : activityItems.length ? (
                <div className="space-y-3">
                  {activityItems.map((item) => (
                    <div key={item.id} className="rounded-[20px] border border-black/6 bg-shell px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          {item.vehicle ? (
                            <Link href={item.vehicle.adminHref} className="font-semibold text-ink underline-offset-4 hover:underline">
                              {item.vehicle.year ? `${item.vehicle.year} ` : ""}
                              {item.vehicle.make} {item.vehicle.model}
                              {item.vehicle.variant ? ` ${item.vehicle.variant}` : ""}
                            </Link>
                          ) : (
                            <p className="font-semibold text-ink">Vehicle no longer available</p>
                          )}
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink/45">
                            Reference: {item.vehicle?.reference || item.listingId || item.vehicleId}
                          </p>
                        </div>
                        <div className="text-right text-sm text-ink/65">
                          <p className="font-semibold text-ink">{item.viewCount.toLocaleString()} view{item.viewCount === 1 ? "" : "s"}</p>
                          <p>First viewed: {formatAdminDateTime(item.firstViewedAt, "Not recorded")}</p>
                          <p>Last viewed: {formatAdminDateTime(item.lastViewedAt, "Not recorded")}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink/60">No vehicle viewing history yet.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
