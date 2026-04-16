"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { updateSellerVehicleStatus } from "@/lib/data";
import { getSellerVehicleAvailableStatuses } from "@/lib/permissions";
import { SellerVehicleStatus, Vehicle } from "@/types";

function getSellerVehicleSelectLabel(status: SellerVehicleStatus) {
  if (status === "ACTIVE") return "Live";
  if (status === "PAUSED") return "Paused";
  if (status === "WITHDRAWN") return "Withdrawn";
  return "Sold";
}

export function SellerVehicleStatusEditor({ vehicle }: { vehicle: Vehicle }) {
  const router = useRouter();
  const { appUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<SellerVehicleStatus>(vehicle.sellerStatus);

  useEffect(() => {
    setStatus(vehicle.sellerStatus);
  }, [vehicle.sellerStatus]);

  const options = useMemo(() => {
    return Array.from(new Set([vehicle.sellerStatus, ...getSellerVehicleAvailableStatuses(vehicle.sellerStatus)]));
  }, [vehicle.sellerStatus]);

  async function handleSave() {
    if (!appUser) return;
    setBusy(true);

    try {
      const result = await updateSellerVehicleStatus(vehicle.id, status, appUser, vehicle);
      router.replace(
        `/seller/vehicles?write=${result.writeSucceeded ? "success" : "mock"}&sellerStatus=${status}&vehicleId=${vehicle.id}`
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <select
        value={status}
        onChange={(event) => setStatus(event.target.value as SellerVehicleStatus)}
        disabled={busy}
        className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-ink"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {getSellerVehicleSelectLabel(option)}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={busy || status === vehicle.sellerStatus}
        className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
