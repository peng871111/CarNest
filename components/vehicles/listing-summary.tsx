import { getListingDescriptionLines } from "@/lib/permissions";
import { Vehicle } from "@/types";

export function ListingSummary({ vehicle, compact = false }: { vehicle: Vehicle; compact?: boolean }) {
  const lines = getListingDescriptionLines(vehicle);

  return (
    <div className={compact ? "rounded-[20px] border border-black/5 bg-shell p-4" : "rounded-[24px] border border-black/5 bg-shell p-5"}>
      <p className={compact ? "text-[11px] uppercase tracking-[0.24em] text-bronze" : "text-xs uppercase tracking-[0.28em] text-bronze"}>Listing details</p>
      <div className={compact ? "mt-3 space-y-1.5" : "mt-4 space-y-2"}>
        {lines.map((line) => (
          <p key={line} className={compact ? "text-xs leading-5 text-ink/68" : "text-sm leading-6 text-ink/70"}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
