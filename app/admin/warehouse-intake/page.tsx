import { AdminShell } from "@/components/layout/admin-shell";
import { WarehouseIntakeDashboard } from "@/components/admin/warehouse-intake-dashboard";

export const dynamic = "force-dynamic";

export default function AdminWarehouseIntakePage() {
  return (
    <AdminShell
      title="Warehouse Intake"
      description="Manage reusable customer profiles, private vehicle records, intake-event documentation, signed PDFs, and customer handover emails for CarNest warehouse assistance."
      requiredPermission="manageVehicles"
    >
      <WarehouseIntakeDashboard />
    </AdminShell>
  );
}
