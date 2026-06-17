import { notFound } from "next/navigation";
import { VehicleReportPage } from "@/components/vehicles/vehicle-report-page";
import { getVehicleById } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function VehicleReportRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vehicle = await getVehicleById(id);

  if (
    !vehicle
    || vehicle.deleted
    || vehicle.status !== "approved"
    || (vehicle.sellerStatus !== "ACTIVE" && vehicle.sellerStatus !== "UNDER_OFFER")
    || !vehicle.vehicleReportAvailable
  ) {
    notFound();
  }

  return <VehicleReportPage vehicle={vehicle} />;
}
