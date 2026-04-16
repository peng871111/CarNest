"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { updateSellerVehicleStatus } from "@/lib/data";
import { getSellerVehicleActionLabel, getSellerVehicleAvailableStatuses } from "@/lib/permissions";
import { SellerVehicleStatus, Vehicle } from "@/types";

export function SellerVehicleActions({ vehicle, redirectPath = "/seller/vehicles" }: { vehicle: Vehicle; redirectPath?: string }) {
  const router = useRouter();
  const { appUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const availableActions: SellerVehicleStatus[] = getSellerVehicleAvailableStatuses(vehicle.sellerStatus);

  async function handleStatus(nextStatus: SellerVehicleStatus) {
    if (!appUser) return;
    setBusy(true);

    try {
      const result = await updateSellerVehicleStatus(vehicle.id, nextStatus, appUser, vehicle);
      router.replace(
        `${redirectPath}?write=${result.writeSucceeded ? "success" : "mock"}&sellerStatus=${nextStatus}&vehicleId=${vehicle.id}`
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!availableActions.length) {
    return <span className="text-xs uppercase tracking-[0.18em] text-ink/40">No listing actions</span>;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {availableActions.map((status) => (
        <button
          key={status}
          type="button"
          disabled={busy}
          onClick={() => void handleStatus(status)}
          className="text-sm font-medium text-ink/72 transition hover:text-ink disabled:opacity-40"
        >
          {getSellerVehicleActionLabel(status)}
        </button>
      ))}
    </div>
  );
}
