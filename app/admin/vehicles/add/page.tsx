import { VehicleForm } from "@/components/forms/vehicle-form";
import { AdminShell } from "@/components/layout/admin-shell";

export default function AdminAddVehiclePage() {
  return (
    <AdminShell
      title="Create Vehicle"
      description="Add a new vehicle to the marketplace. Admin-created vehicles are published as approved immediately."
    >
      <VehicleForm />
    </AdminShell>
  );
}
