import { getVehicleStatusLabel, getVehicleStatusTone } from "@/lib/permissions";
import { VehicleStatus } from "@/types";

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getVehicleStatusTone(status)}`}>
      {getVehicleStatusLabel(status)}
    </span>
  );
}
