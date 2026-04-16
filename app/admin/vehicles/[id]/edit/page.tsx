import { notFound } from "next/navigation";
import { VehicleForm } from "@/components/forms/vehicle-form";
import { AdminShell } from "@/components/layout/admin-shell";
import { getVehicleById } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminEditVehiclePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vehicle = await getVehicleById(id);

  if (!vehicle) notFound();

  return (
    <AdminShell
      title="Edit Vehicle"
      description="Update the existing vehicle details and return to the admin list with a visible success status."
    >
      <VehicleForm vehicle={vehicle} />
    </AdminShell>
  );
}
