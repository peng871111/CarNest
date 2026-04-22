"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { softDeleteVehicle, updateVehicleStatus } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { Vehicle } from "@/types";
import { hasAdminPermission } from "@/lib/permissions";

export function AdminVehicleActions({
  vehicle,
  redirectBase = "/admin/vehicles"
}: {
  vehicle: Vehicle;
  redirectBase?: string;
}) {
  const router = useRouter();
  const { appUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const canDeleteListings = hasAdminPermission(appUser, "deleteListings");

  async function handleStatus(status: "approved" | "rejected") {
    if (!appUser) return;
    setBusy(true);
    try {
      await updateVehicleStatus(vehicle.id, status, appUser, vehicle);
      router.replace(`${redirectBase}?write=success&action=${status}&vehicleId=${vehicle.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!appUser || !canDeleteListings || vehicle.deleted) return;
    if (!window.confirm("Soft delete this listing? It will be removed from normal public inventory.")) return;

    const deleteReason = window.prompt("Optional delete reason", vehicle.deleteReason ?? "") ?? "";

    setBusy(true);
    try {
      await softDeleteVehicle(vehicle.id, appUser, vehicle, deleteReason);
      router.replace(`${redirectBase}?write=success&action=deleted&vehicleId=${vehicle.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        disabled={busy || vehicle.status === "approved" || vehicle.deleted}
        onClick={() => handleStatus("approved")}
        className="text-sm font-medium text-emerald-700 disabled:opacity-40"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={busy || vehicle.status === "rejected" || vehicle.deleted}
        onClick={() => handleStatus("rejected")}
        className="text-sm font-medium text-red-700 disabled:opacity-40"
      >
        Reject
      </button>
      {canDeleteListings ? (
        <button
          type="button"
          disabled={busy || vehicle.deleted}
          onClick={() => void handleDelete()}
          className="text-sm font-medium text-red-800 disabled:opacity-40"
        >
          {vehicle.deleted ? "Deleted" : "Delete"}
        </button>
      ) : null}
    </div>
  );
}
