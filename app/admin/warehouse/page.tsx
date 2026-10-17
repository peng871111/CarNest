"use client";

import { AdminShell } from "@/components/layout/admin-shell";
import { WarehousePmsWorkspace } from "@/components/admin/warehouse-pms-workspace";

export default function WarehousePmsPage() {
  return (
    <AdminShell
      title="Warehouse"
      description="Vehicle storage operations, capacity and billing."
      requiredPermission="manageVehicles"
    >
      <WarehousePmsWorkspace />
    </AdminShell>
  );
}
