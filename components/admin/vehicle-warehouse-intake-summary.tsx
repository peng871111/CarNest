"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getWarehouseRelationshipTreeByVehicleId } from "@/lib/data";
import { hasAdminPermission } from "@/lib/permissions";
import { formatAdminDateTime } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { WarehouseRelationshipTree } from "@/types";

function isWarehouseIntakePermissionError(message?: string) {
  const normalized = (message ?? "").toLowerCase();
  return normalized.includes("missing or insufficient permissions")
    || normalized.includes("permission-denied")
    || normalized.includes("unauthenticated");
}

export function VehicleWarehouseIntakeSummary({ vehicleId }: { vehicleId: string }) {
  const { appUser, firebaseUser, loading: authLoading } = useAuth();
  const [tree, setTree] = useState<WarehouseRelationshipTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (authLoading) return;
      if (!hasAdminPermission(appUser, "manageVehicles")) {
        setLoading(false);
        return;
      }
      if (!firebaseUser) {
        setLoading(false);
        setErrorMessage("Admin authentication is still loading. Please refresh and try again.");
        return;
      }

      try {
        await firebaseUser.getIdToken();
        let result = await getWarehouseRelationshipTreeByVehicleId(vehicleId);

        if (!result.intakeRecords.length) {
          await firebaseUser.getIdToken(true);
          result = await getWarehouseRelationshipTreeByVehicleId(vehicleId);
        }

        if (cancelled) return;
        setTree(result);
        setErrorMessage("");
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load warehouse intake status.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [appUser, authLoading, firebaseUser, vehicleId]);

  return (
    <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.25em] text-bronze">Warehouse intake</p>
      {errorMessage ? (
        <p className="mt-4 text-sm text-red-700">{errorMessage}</p>
      ) : null}
      {loading ? (
        <p className="mt-4 text-sm text-ink/60">Loading intake status...</p>
      ) : tree?.intakeRecords?.[0] ? (
        <div className="mt-4 space-y-3 text-sm text-ink/70">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Customer profile</p>
            <p className="mt-1 text-ink">{tree.customerProfile?.fullName || tree.customerProfile?.email || "Pending"}</p>
            <p className="mt-1 text-xs text-ink/55">{tree.customerProfile?.id || "Profile will be created on save"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Vehicle record</p>
            <p className="mt-1 text-ink">
              {tree.vehicleRecord?.title
                || [tree.vehicleRecord?.year, tree.vehicleRecord?.make, tree.vehicleRecord?.model].filter(Boolean).join(" ")
                || "Pending"}
            </p>
            <p className="mt-1 text-xs text-ink/55">{tree.vehicleRecord?.id || "Record will be created on save"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Public listing</p>
            <p className="mt-1 text-ink">
              {tree.listing ? `${tree.listing.year} ${tree.listing.make} ${tree.listing.model}` : tree.intakeRecords[0].vehicleTitle || "Standalone onboarding record"}
            </p>
            <p className="mt-1 text-xs text-ink/55">{tree.listing?.id || tree.intakeRecords[0].vehicleId || "No public listing linked yet"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Completed date</p>
            <p className="mt-1 text-ink">{tree.intakeRecords[0].completedAt ? formatAdminDateTime(tree.intakeRecords[0].completedAt) : "In progress"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Signed agreement</p>
            <p className="mt-1 text-ink">{tree.intakeRecords[0].signature.signedAt ? "Signed" : "Pending"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Finance declaration</p>
            <p className="mt-1 text-ink">{tree.intakeRecords[0].declarations.financeOwing}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Ownership proof</p>
            <p className="mt-1 text-ink">{tree.vehicleRecord?.ownershipProof ? "Uploaded" : "Pending"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Documentation completed</p>
            <p className="mt-1 text-ink">{tree.intakeRecords[0].photos.length ? "Yes" : "Pending photos"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Number of photos</p>
            <p className="mt-1 text-ink">{tree.intakeRecords[0].photos.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">PDF available</p>
            <p className="mt-1 text-ink">{tree.intakeRecords[0].signedPdfStoragePath ? "Yes" : "Pending"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Admin staff responsible</p>
            <p className="mt-1 text-ink">{tree.intakeRecords[0].signature.adminStaffName || tree.intakeRecords[0].adminStaffName || "Pending"}</p>
          </div>
          <Link
            href={`/admin/warehouse-intake/${tree.intakeRecords[0].id}`}
            className="inline-flex rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
          >
            Open intake record
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-6 text-ink/60">No warehouse intake record is attached to this listing yet.</p>
          <Link
            href={`/admin/warehouse-intake/new?vehicleId=${vehicleId}`}
            className="inline-flex rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink/92"
          >
            Start warehouse intake
          </Link>
        </div>
      )}
    </div>
  );
}
