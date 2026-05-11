import { AdminShell } from "@/components/layout/admin-shell";
import { WarehouseIntakeDashboard } from "@/components/admin/warehouse-intake-dashboard";

export const dynamic = "force-dynamic";

export default function AdminWarehouseIntakePage() {
  return (
    <AdminShell
      title="Warehouse Intake"
      description="Manage customer profiles, vehicle records, intake events, signed PDFs, and customer handover emails."
      requiredPermission="manageVehicles"
    >
      <WarehouseIntakeDashboard />
    </AdminShell>
  );
}
