"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/layout/admin-shell";
import { AdminVehiclesReviewBoard } from "@/components/admin/admin-vehicles-review-board";
import { useAuth } from "@/lib/auth";
import { getVehiclesData, listUsers } from "@/lib/data";
import { canAccessRole } from "@/lib/permissions";
import { AppUser, Vehicle } from "@/types";

export default function AdminVehiclesPage() {
  const searchParams = useSearchParams();
  const { appUser, loading } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [owners, setOwners] = useState<AppUser[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadVehiclesPage() {
      if (loading || !canAccessRole("admin", appUser?.role)) return;
      const [vehiclesResult, nextOwners] = await Promise.all([getVehiclesData(), listUsers()]);
      if (cancelled) return;
      setVehicles(vehiclesResult.items);
      setOwners(nextOwners);
      setError(vehiclesResult.error ?? "");
    }

    void loadVehiclesPage();

    return () => {
      cancelled = true;
    };
  }, [appUser?.role, loading]);

  const writeStatus = useMemo(() => {
    const write = searchParams.get("write");
    const action = searchParams.get("action");

    return !write
      ? undefined
      : write === "success"
        ? action === "update"
          ? "Vehicle updated successfully"
          : action === "approved"
            ? "Vehicle approved successfully"
            : action === "rejected"
              ? "Vehicle rejected successfully"
              : action === "deleted"
                ? "Vehicle soft deleted successfully"
                : "Vehicle saved successfully"
        : action === "update"
          ? "Recent update completed"
          : "Recent save completed";
  }, [searchParams]);

  return (
    <AdminShell
      title="Admin Vehicles"
      description="Review, approve, reject, and batch-manage vehicle listings from one moderation queue."
    >
      <AdminVehiclesReviewBoard initialVehicles={vehicles} owners={owners} writeStatus={writeStatus} error={error} />
    </AdminShell>
  );
}
