import { AdminShell } from "@/components/layout/admin-shell";
import { WarehouseIntakeWorkspace } from "@/components/admin/warehouse-intake-workspace";

export const dynamic = "force-dynamic";

export default function AdminWarehouseIntakeNewPage() {
  return (
    <AdminShell
      title="New Warehouse Intake"
      description="Use the iPad-friendly workflow to select or create a reusable customer profile, capture a private vehicle record, document the intake event, and complete the final agreement."
      requiredPermission="manageVehicles"
    >
      <WarehouseIntakeWorkspace />
    </AdminShell>
  );
}
