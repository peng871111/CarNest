import { AdminShell } from "@/components/layout/admin-shell";
import { WarehouseIntakeWorkspace } from "@/components/admin/warehouse-intake-workspace";

export const dynamic = "force-dynamic";

export default async function AdminWarehouseIntakeDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AdminShell
      title="Warehouse Intake"
      description="Review the intake record, continue the condition report, regenerate the signed PDF, and resend the customer copy when required."
      requiredPermission="manageVehicles"
    >
      <WarehouseIntakeWorkspace intakeId={id} />
    </AdminShell>
  );
}
