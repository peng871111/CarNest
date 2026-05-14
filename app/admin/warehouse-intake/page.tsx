import { AdminShell } from "@/components/layout/admin-shell";
import { WarehouseIntakeDashboard } from "@/components/admin/warehouse-intake-dashboard";

export const dynamic = "force-dynamic";

export default function AdminWarehouseIntakePage() {
  return (
    <AdminShell
      title="Warehouse Intake"
      description="Start paperwork from active listings or continue recent intake records."
      requiredPermission="manageVehicles"
    >
      <WarehouseIntakeDashboard />
    </AdminShell>
  );
}
