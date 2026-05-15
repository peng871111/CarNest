import { AdminShell } from "@/components/layout/admin-shell";
import { WarehouseIntakeDashboard } from "@/components/admin/warehouse-intake-dashboard";

export const dynamic = "force-dynamic";

export default function AdminWarehouseIntakePage() {
  return (
    <AdminShell
      title="Storage Contracts"
      description="Open and continue existing storage contract records."
      requiredPermission="manageVehicles"
    >
      <WarehouseIntakeDashboard />
    </AdminShell>
  );
}
