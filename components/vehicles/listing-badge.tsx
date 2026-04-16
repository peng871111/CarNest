import { getListingLabel } from "@/lib/permissions";
import { Vehicle } from "@/types";

export function ListingBadge({ vehicle }: { vehicle: Vehicle }) {
  return (
    <span className="inline-flex rounded-full border border-bronze/20 bg-bronze/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-bronze">
      {getListingLabel(vehicle.listingType)}
    </span>
  );
}
