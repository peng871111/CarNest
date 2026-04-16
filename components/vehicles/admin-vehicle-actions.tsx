"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateVehicleStatus } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { Vehicle } from "@/types";

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

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        disabled={busy || vehicle.status === "approved"}
        onClick={() => handleStatus("approved")}
        className="text-sm font-medium text-emerald-700 disabled:opacity-40"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={busy || vehicle.status === "rejected"}
        onClick={() => handleStatus("rejected")}
        className="text-sm font-medium text-red-700 disabled:opacity-40"
      >
        Reject
      </button>
    </div>
  );
}
