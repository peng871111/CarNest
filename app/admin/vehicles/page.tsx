import { AdminShell } from "@/components/layout/admin-shell";
import { AdminVehiclesReviewBoard } from "@/components/admin/admin-vehicles-review-board";
import { getVehiclesData, listUsers } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminVehiclesPage({
  searchParams
}: {
  searchParams?: Promise<{ write?: string; loadedHint?: string; vehicleId?: string; action?: string }>;
}) {
  const [{ items: vehicles, error }, owners] = await Promise.all([getVehiclesData(), listUsers()]);
  const params = searchParams ? await searchParams : undefined;
  const writeStatus = !params?.write
    ? undefined
    : params.write === "success"
      ? params.action === "update"
        ? "Vehicle updated successfully"
        : params.action === "approved"
          ? "Vehicle approved successfully"
          : params.action === "rejected"
            ? "Vehicle rejected successfully"
            : params.action === "deleted"
              ? "Vehicle soft deleted successfully"
              : "Vehicle saved successfully"
      : params.action === "update"
        ? "Recent update completed"
        : "Recent save completed";

  return (
    <AdminShell
      title="Admin Vehicles"
      description="Review, approve, reject, and batch-manage vehicle listings from one moderation queue."
    >
      <AdminVehiclesReviewBoard initialVehicles={vehicles} owners={owners} writeStatus={writeStatus} error={error} />
    </AdminShell>
  );
}
