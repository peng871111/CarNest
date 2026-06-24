import { VEHICLE_CONDITION_CATEGORY_LABELS } from "@/lib/vehicle-condition-config";
import { Vehicle, VehicleConditionCategoryKey } from "@/types";

const CATEGORY_ORDER: VehicleConditionCategoryKey[] = [
  "exteriorBody",
  "interiorCondition",
  "mechanicalFunction",
  "documentationRecords"
];

function hasConditionSummary(vehicle: Vehicle) {
  const categories = vehicle.vehicleReportSummary?.conditionCategories;

  if (!categories) {
    return false;
  }

  return CATEGORY_ORDER.every((key) => Boolean(categories[key]?.score));
}

export function ConditionSummaryPreview({ vehicle, compact = false }: { vehicle: Vehicle; compact?: boolean }) {
  const categories = vehicle.vehicleReportSummary?.conditionCategories;
  const showScores = hasConditionSummary(vehicle) && categories;

  return (
    <div className={compact ? "rounded-[20px] border border-black/5 bg-shell p-4" : "rounded-[24px] border border-black/5 bg-shell p-5"}>
      <p className={compact ? "text-sm font-semibold text-ink" : "text-base font-semibold text-ink"}>Condition Summary</p>
      {showScores ? (
        <div className={compact ? "mt-3 space-y-2" : "mt-4 space-y-2.5"}>
          {CATEGORY_ORDER.map((key) => (
            <div key={key} className="flex items-baseline justify-between gap-4">
              <span className={compact ? "text-xs leading-5 text-ink/68" : "text-sm leading-6 text-ink/70"}>
                {VEHICLE_CONDITION_CATEGORY_LABELS[key]}
              </span>
              <span className={compact ? "text-xs font-semibold text-ink" : "text-sm font-semibold text-ink"}>
                {categories[key].score} / 5.0
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className={compact ? "mt-3 text-xs leading-5 text-ink/68" : "mt-4 text-sm leading-6 text-ink/70"}>
          Please contact us to arrange an inspection and receive a Condition Summary.
        </p>
      )}
    </div>
  );
}
