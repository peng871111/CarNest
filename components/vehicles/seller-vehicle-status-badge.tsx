import { getSellerVehicleStatusLabel, getSellerVehicleStatusTone } from "@/lib/permissions";
import { SellerVehicleStatus } from "@/types";

export function SellerVehicleStatusBadge({ status }: { status: SellerVehicleStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getSellerVehicleStatusTone(status)}`}>
      {getSellerVehicleStatusLabel(status)}
    </span>
  );
}
