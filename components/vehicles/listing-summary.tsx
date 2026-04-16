import { getListingDescriptionLines } from "@/lib/permissions";
import { Vehicle } from "@/types";

export function ListingSummary({ vehicle }: { vehicle: Vehicle }) {
  const lines = getListingDescriptionLines(vehicle);

  return (
    <div className="rounded-[24px] border border-black/5 bg-shell p-5">
      <p className="text-xs uppercase tracking-[0.28em] text-bronze">Listing details</p>
      <div className="mt-4 space-y-2">
        {lines.map((line) => (
          <p key={line} className="text-sm leading-6 text-ink/70">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
