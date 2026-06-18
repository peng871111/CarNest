import { notFound } from "next/navigation";
import { VehicleReportPage } from "@/components/vehicles/vehicle-report-page";
import { getVehicleById } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function VehicleReportRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let vehicle = null;

  try {
    vehicle = await getVehicleById(id);
  } catch {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-[28px] border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700 shadow-panel">
          Condition Overview temporarily unavailable.
          <br />
          Please try again later.
        </div>
      </main>
    );
  }

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
