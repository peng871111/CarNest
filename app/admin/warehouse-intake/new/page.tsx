import { AdminShell } from "@/components/layout/admin-shell";
import { WarehouseIntakeWorkspace } from "@/components/admin/warehouse-intake-workspace";

export const dynamic = "force-dynamic";

export default function AdminWarehouseIntakeNewPage() {
  return (
    <AdminShell
      title="New Warehouse Intake"
      description="Use the iPad-friendly intake workflow to capture owner details, declarations, photos, signatures, and the final storage agreement."
      requiredPermission="manageVehicles"
    >
      <WarehouseIntakeWorkspace />
    </AdminShell>
  );
}
