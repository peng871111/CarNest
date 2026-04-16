import { VehicleForm } from "@/components/forms/vehicle-form";
import { AdminShell } from "@/components/layout/admin-shell";

export default function AdminNewVehiclePage() {
  return (
    <AdminShell
      title="Create Vehicle"
      description="Add a new vehicle to the marketplace and upload imagery for the listing."
    >
      <VehicleForm />
    </AdminShell>
  );
}
