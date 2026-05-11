"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { VehicleManagementHub } from "@/components/admin/vehicle-management-hub";
import { useAuth } from "@/lib/auth";
import { getCustomerProfilesData, getVehicleRecordsData, getVehiclesData, getWarehouseIntakesData, listUsers } from "@/lib/data";
import { canAccessRole } from "@/lib/permissions";
import { AdminPermissionKey, AppUser, CustomerProfile, Vehicle, VehicleRecord, WarehouseIntakeRecord } from "@/types";

export function VehicleWorkspaceScreen({
  title,
  description,
  defaultView,
  writeStatus,
  requiredPermission = "manageVehicles"
}: {
  title: string;
  description: string;
  defaultView: "customers" | "vehicles" | "warehouse" | "listings";
  writeStatus?: string;
  requiredPermission?: AdminPermissionKey;
}) {
  const { appUser, firebaseUser, loading } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [owners, setOwners] = useState<AppUser[]>([]);
  const [customerProfiles, setCustomerProfiles] = useState<CustomerProfile[]>([]);
  const [vehicleRecords, setVehicleRecords] = useState<VehicleRecord[]>([]);
  const [intakes, setIntakes] = useState<WarehouseIntakeRecord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      if (loading || !canAccessRole("admin", appUser?.role)) return;
      if (!firebaseUser) {
        setError("Admin authentication is still loading. Please refresh and try again.");
        return;
      }

      await firebaseUser.getIdToken();
      const [vehiclesResult, nextOwners, customerProfilesResult, vehicleRecordsResult, intakesResult] = await Promise.all([
        getVehiclesData(),
        listUsers(),
        getCustomerProfilesData(),
        getVehicleRecordsData(),
        getWarehouseIntakesData()
      ]);
      if (cancelled) return;
      setVehicles(vehiclesResult.items);
      setOwners(nextOwners);
      setCustomerProfiles(customerProfilesResult.items);
      setVehicleRecords(vehicleRecordsResult.items);
      setIntakes(intakesResult.items);
      setError(
        vehiclesResult.error
        || customerProfilesResult.error
        || vehicleRecordsResult.error
        || intakesResult.error
        || ""
      );
    }

    void loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [appUser?.role, firebaseUser, loading]);

  const memoWriteStatus = useMemo(() => writeStatus, [writeStatus]);

  return (
    <AdminShell title={title} description={description} requiredPermission={requiredPermission}>
      <VehicleManagementHub
        vehicles={vehicles}
        owners={owners}
        customerProfiles={customerProfiles}
        vehicleRecords={vehicleRecords}
        intakes={intakes}
        writeStatus={memoWriteStatus}
        error={error}
        defaultView={defaultView}
      />
    </AdminShell>
  );
}
