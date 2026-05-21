"use client";

import { useEffect, useMemo, useState } from "react";
import { createEmptyVehicleRecord, saveVehicleRecord } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { getVehicleDisplayReference } from "@/lib/utils";
import { Vehicle, VehicleActor, VehiclePublicationChecklist, VehicleRecord } from "@/types";

const PUBLICATION_PLATFORMS: Array<{
  key: keyof VehiclePublicationChecklist;
  label: string;
}> = [
  { key: "carsales", label: "Carsales" },
  { key: "facebookMarketplace", label: "Facebook Marketplace" },
  { key: "xiaohongshu", label: "Xiaohongshu" },
  { key: "website", label: "Website" },
  { key: "other", label: "Other" }
];

const PRIORITY_PUBLICATION_PLATFORMS: Array<keyof VehiclePublicationChecklist> = ["carsales", "xiaohongshu"];

function createActorFromUser(user: ReturnType<typeof useAuth>["appUser"]): VehicleActor | null {
  if (!user) return null;
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    displayName: user.displayName,
    name: user.name,
    adminPermissions: user.adminPermissions
  };
}

function createEmptyChecklist(): VehiclePublicationChecklist {
  return {
    carsales: false,
    facebookMarketplace: false,
    xiaohongshu: false,
    website: false,
    other: false
  };
}

function getPlatformTone(platform: keyof VehiclePublicationChecklist, checked: boolean) {
  const isPriorityPlatform = PRIORITY_PUBLICATION_PLATFORMS.includes(platform);
  if (checked) {
    return "border-emerald-200 bg-emerald-50/70 text-emerald-800";
  }
  if (isPriorityPlatform) {
    return "border-amber-200 bg-amber-50/70 text-amber-800";
  }
  return "border-black/8 bg-shell text-ink";
}

function buildVehicleRecordForChecklist(
  vehicle: Vehicle,
  vehicleRecord: VehicleRecord | null,
  checklist: VehiclePublicationChecklist
): Omit<VehicleRecord, "id" | "createdAt" | "updatedAt"> {
  return {
    ...createEmptyVehicleRecord(),
    ...vehicleRecord,
    customerProfileId: vehicleRecord?.customerProfileId || "",
    publicListingId: vehicle.id,
    displayReference: vehicleRecord?.displayReference || getVehicleDisplayReference(vehicle),
    title: vehicleRecord?.title || `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.variant}`.trim(),
    make: vehicleRecord?.make || vehicle.make || "",
    model: vehicleRecord?.model || vehicle.model || "",
    variant: vehicleRecord?.variant || vehicle.variant || "",
    year: vehicleRecord?.year || String(vehicle.year || ""),
    registrationPlate: vehicleRecord?.registrationPlate || vehicle.rego || "",
    vin: vehicleRecord?.vin || vehicle.vin || "",
    colour: vehicleRecord?.colour || vehicle.colour || "",
    odometer: vehicleRecord?.odometer || String(vehicle.mileage || ""),
    fuelType: vehicleRecord?.fuelType || vehicle.fuelType || "",
    transmission: vehicleRecord?.transmission || vehicle.transmission || "",
    askingPrice: vehicleRecord?.askingPrice || String(vehicle.price || ""),
    publicationChecklist: checklist,
    status:
      vehicleRecord?.status
      || (vehicle.sellerStatus === "SOLD"
        ? "sold"
        : vehicle.sellerStatus === "WITHDRAWN"
          ? "withdrawn"
          : vehicle.storedInWarehouse || vehicle.listingType === "warehouse"
            ? "warehouse_managed"
            : "listed")
  };
}

export function ListingPublicationChecklist({
  vehicle,
  vehicleRecord,
  compact = false,
  onSaved
}: {
  vehicle: Vehicle;
  vehicleRecord?: VehicleRecord | null;
  compact?: boolean;
  onSaved?: (vehicleRecord: VehicleRecord) => void;
}) {
  const { appUser } = useAuth();
  const actor = useMemo(() => createActorFromUser(appUser), [appUser]);
  const canManageVehicles = hasAdminPermission(appUser, "manageVehicles");
  const [localChecklist, setLocalChecklist] = useState<VehiclePublicationChecklist>(vehicleRecord?.publicationChecklist ?? createEmptyChecklist());
  const [savingKey, setSavingKey] = useState<keyof VehiclePublicationChecklist | "">("");
  const [errorMessage, setErrorMessage] = useState("");
  const checklist = localChecklist;

  useEffect(() => {
    setLocalChecklist(vehicleRecord?.publicationChecklist ?? createEmptyChecklist());
  }, [vehicleRecord?.id, vehicleRecord?.publicationChecklist]);

  if (!canManageVehicles) {
    return null;
  }

  async function handleToggle(platform: keyof VehiclePublicationChecklist, checked: boolean) {
    if (!actor) return;

    const previousChecklist = checklist;
    const nextChecklist = {
      ...previousChecklist,
      [platform]: checked
    };

    try {
      setSavingKey(platform);
      setErrorMessage("");
      setLocalChecklist(nextChecklist);
      const result = await saveVehicleRecord(
        buildVehicleRecordForChecklist(vehicle, vehicleRecord ?? null, nextChecklist),
        actor,
        vehicleRecord?.id
      );
      setLocalChecklist(result.vehicleRecord.publicationChecklist ?? nextChecklist);
      onSaved?.(result.vehicleRecord);
    } catch (error) {
      setLocalChecklist(previousChecklist);
      setErrorMessage(error instanceof Error ? error.message : "We couldn't update the publication checklist.");
    } finally {
      setSavingKey("");
    }
  }

  return (
    <div className={`rounded-[18px] border border-black/6 bg-white/80 ${compact ? "px-3 py-3" : "px-4 py-4"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bronze">Publication checklist</p>
        <p className="text-[11px] text-ink/50">Admin only</p>
      </div>
      <div className={`mt-3 grid gap-2 ${compact ? "sm:grid-cols-2 xl:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {PUBLICATION_PLATFORMS.map((platform) => (
          <div
            key={`${vehicle.id}-${platform.key}`}
            className={`flex min-h-[42px] items-center gap-3 rounded-2xl border px-3 py-2 text-sm transition ${getPlatformTone(platform.key, checklist[platform.key])}`}
          >
            <input
              id={`publication-${vehicle.id}-${platform.key}`}
              type="checkbox"
              checked={checklist[platform.key]}
              disabled={savingKey === platform.key}
              onChange={(event) => void handleToggle(platform.key, event.target.checked)}
              className="h-4 w-4 rounded border-black/20 text-ink"
            />
            <label htmlFor={`publication-${vehicle.id}-${platform.key}`} className="flex min-w-0 cursor-pointer items-center justify-between gap-2 text-sm">
              <span>{platform.label}</span>
              <span className="text-[11px] font-semibold">
                {checklist[platform.key] ? "Published" : PRIORITY_PUBLICATION_PLATFORMS.includes(platform.key) ? "Not published" : "Pending"}
              </span>
            </label>
          </div>
        ))}
      </div>
      {errorMessage ? <p className="mt-2 text-xs text-amber-700">{errorMessage}</p> : null}
    </div>
  );
}
