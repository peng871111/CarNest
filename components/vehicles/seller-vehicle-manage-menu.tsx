"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { updateSellerVehicleStatus } from "@/lib/data";
import { getSellerVehicleActionLabel, getSellerVehicleAvailableStatuses } from "@/lib/permissions";
import { SellerVehicleStatus, Vehicle } from "@/types";

export function SellerVehicleManageMenu({ vehicle }: { vehicle: Vehicle }) {
  const router = useRouter();
  const { appUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const availableActions: SellerVehicleStatus[] = getSellerVehicleAvailableStatuses(vehicle.sellerStatus);

  async function handleStatus(nextStatus: SellerVehicleStatus) {
    if (!appUser) return;
    setBusy(true);

    try {
      const result = await updateSellerVehicleStatus(vehicle.id, nextStatus, appUser, vehicle);
      detailsRef.current?.removeAttribute("open");
      router.replace(`/seller/vehicles?write=${result.writeSucceeded ? "success" : "mock"}&sellerStatus=${nextStatus}&vehicleId=${vehicle.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <details ref={detailsRef} className="relative z-50">
      <summary className="list-none rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-shell [&::-webkit-details-marker]:hidden">
        Manage
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-[20px] border border-black/10 bg-white shadow-panel">
        <Link
          href={`/seller/vehicles/${vehicle.id}/edit`}
          className="block border-b border-black/5 px-4 py-3 text-sm text-ink transition hover:bg-shell"
          onClick={() => detailsRef.current?.removeAttribute("open")}
        >
          Edit
        </Link>
        {availableActions.map((status) => (
          <button
            key={status}
            type="button"
            disabled={busy}
            onClick={() => void handleStatus(status)}
            className="block w-full border-b border-black/5 px-4 py-3 text-left text-sm text-ink transition hover:bg-shell disabled:opacity-40 last:border-b-0"
          >
            {getSellerVehicleActionLabel(status)}
          </button>
        ))}
      </div>
    </details>
  );
}
