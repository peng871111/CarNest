import { getSellerListingStatusLabel, getSellerListingStatusTone } from "@/lib/permissions";
import { Vehicle } from "@/types";

export function SellerListingStatusBadge({ vehicle }: { vehicle: Pick<Vehicle, "status" | "sellerStatus"> }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getSellerListingStatusTone(vehicle)}`}
    >
      {getSellerListingStatusLabel(vehicle)}
    </span>
  );
}
