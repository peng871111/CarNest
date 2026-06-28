import { formatBuyerFacingConditionScore, getBuyerFacingConditionScores, hasBuyerFacingConditionSummary } from "@/lib/vehicle-public-report";
import { Vehicle } from "@/types";

function ScoreRow({
  label,
  value,
  compact
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#E7DDD0] bg-white/80 px-3 py-2.5">
      <span className={compact ? "text-[11px] font-medium text-[#65584A]" : "text-sm font-medium text-[#65584A]"}>{label}</span>
      <span className={compact ? "text-xs font-semibold text-[#1F1F1D]" : "text-sm font-semibold text-[#1F1F1D]"}>{value}</span>
    </div>
  );
}

export function ConditionSummaryPreview({ vehicle, compact = false }: { vehicle: Vehicle; compact?: boolean }) {
  const scores = getBuyerFacingConditionScores(vehicle.vehicleReportSummary);
  const hasSummary = hasBuyerFacingConditionSummary(vehicle);

  return (
    <div
      className={
        compact
          ? "rounded-[22px] border border-[#DCCDBA]/60 bg-[linear-gradient(180deg,#fffdf9_0%,#f7f1e7_100%)] p-4"
          : "rounded-[26px] border border-[#DCCDBA]/60 bg-[linear-gradient(180deg,#fffdf9_0%,#f7f1e7_100%)] p-5"
      }
    >
      <p className={compact ? "text-sm font-semibold text-[#1F1F1D]" : "text-base font-semibold text-[#1F1F1D]"}>Vehicle Condition Summary</p>
      {hasSummary ? (
        <div className={compact ? "mt-3 space-y-2.5" : "mt-4 space-y-3"}>
          <ScoreRow label="Exterior Condition" value={formatBuyerFacingConditionScore(scores.exterior)} compact={compact} />
          <ScoreRow label="Interior Condition" value={formatBuyerFacingConditionScore(scores.interior)} compact={compact} />
        </div>
      ) : (
        <p className={compact ? "mt-3 text-xs leading-5 text-[#6D6255]" : "mt-4 text-sm leading-6 text-[#6D6255]"}>
          Please contact us to obtain the Vehicle Condition Summary.
        </p>
      )}
    </div>
  );
}
