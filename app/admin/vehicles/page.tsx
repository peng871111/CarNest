"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { VehicleWorkspaceScreen } from "@/components/admin/vehicle-workspace-screen";

export default function AdminVehiclesPage() {
  const searchParams = useSearchParams();

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
    <VehicleWorkspaceScreen
      title="Vehicles"
      description="Manage active listings, linked owners, and warehouse paperwork from one operational vehicle screen."
      defaultView="vehicles"
      writeStatus={writeStatus}
    />
  );
}
