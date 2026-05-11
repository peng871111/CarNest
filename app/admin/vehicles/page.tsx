"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/layout/admin-shell";
import { VehicleManagementHub } from "@/components/admin/vehicle-management-hub";
import { useAuth } from "@/lib/auth";
import { getCustomerProfilesData, getVehicleRecordsData, getVehiclesData, getWarehouseIntakesData, listUsers } from "@/lib/data";
import { canAccessRole } from "@/lib/permissions";
import { AppUser, CustomerProfile, Vehicle, VehicleRecord, WarehouseIntakeRecord } from "@/types";

export default function AdminVehiclesPage() {
  const searchParams = useSearchParams();
  const { appUser, firebaseUser, loading } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [owners, setOwners] = useState<AppUser[]>([]);
  const [customerProfiles, setCustomerProfiles] = useState<CustomerProfile[]>([]);
  const [vehicleRecords, setVehicleRecords] = useState<VehicleRecord[]>([]);
  const [intakes, setIntakes] = useState<WarehouseIntakeRecord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadVehiclesPage() {
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

    void loadVehiclesPage();

    return () => {
      cancelled = true;
    };
  }, [appUser?.role, firebaseUser, loading]);

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
      title="Vehicle Management"
      description="Manage customers, vehicle records, warehouse paperwork, and public listings from one simple staff workspace."
    >
      <VehicleManagementHub
        vehicles={vehicles}
        owners={owners}
        customerProfiles={customerProfiles}
        vehicleRecords={vehicleRecords}
        intakes={intakes}
        writeStatus={writeStatus}
        error={error}
      />
    </AdminShell>
  );
}
