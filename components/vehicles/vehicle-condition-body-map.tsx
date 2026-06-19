"use client";

import { VEHICLE_BODY_PANEL_CONDITION_LABELS, VEHICLE_BODY_PANEL_LABELS, VEHICLE_BODY_PANEL_ORDER } from "@/lib/vehicle-condition-config";
import type { VehicleBodyPanelCondition, VehicleBodyPanelKey, VehicleBodyPanelMap } from "@/types";

const PANEL_CLASSES: Record<VehicleBodyPanelCondition, string> = {
  original: "border-emerald-200 bg-emerald-50 text-emerald-800",
  scratch: "border-amber-200 bg-amber-50 text-amber-800",
  dent: "border-orange-200 bg-orange-50 text-orange-800",
  repaint: "border-sky-200 bg-sky-50 text-sky-800",
  repaired_damage: "border-violet-200 bg-violet-50 text-violet-800"
};

const LEGEND_ORDER: VehicleBodyPanelCondition[] = ["original", "scratch", "dent", "repaint", "repaired_damage"];

const BODY_PANEL_LAYOUT: Array<Array<VehicleBodyPanelKey | null>> = [
  [null, null, "bonnet", null, null],
  [null, "leftFrontGuard", "frontBumper", "rightFrontGuard", null],
  [null, "leftFrontDoor", "roof", "rightFrontDoor", null],
  [null, "leftRearDoor", null, "rightRearDoor", null],
  [null, "leftRearQuarter", "bootLid", "rightRearQuarter", null],
  [null, null, "rearBumper", null, null]
];

const PANEL_SHAPE_CLASSES: Record<VehicleBodyPanelKey, string> = {
  frontBumper: "rounded-[18px_18px_28px_28px]",
  bonnet: "rounded-[28px_28px_18px_18px]",
  roof: "rounded-[24px]",
  bootLid: "rounded-[18px_18px_24px_24px]",
  leftFrontGuard: "rounded-[26px_18px_18px_28px]",
  rightFrontGuard: "rounded-[18px_26px_28px_18px]",
  leftFrontDoor: "rounded-[20px_16px_16px_22px]",
  rightFrontDoor: "rounded-[16px_20px_22px_16px]",
  leftRearDoor: "rounded-[16px_16px_18px_22px]",
  rightRearDoor: "rounded-[16px_16px_22px_18px]",
  leftRearQuarter: "rounded-[18px_18px_24px_28px]",
  rightRearQuarter: "rounded-[18px_18px_28px_24px]",
  rearBumper: "rounded-[24px_24px_30px_30px]"
};

function PanelLegend() {
  return (
    <div className="flex flex-wrap gap-2">
      {LEGEND_ORDER.map((key) => (
        <span key={key} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${PANEL_CLASSES[key]}`}>
          {VEHICLE_BODY_PANEL_CONDITION_LABELS[key]}
        </span>
      ))}
    </div>
  );
}

export function VehicleConditionBodyMap({
  bodyMap,
  editable = false,
  onPanelChange
}: {
  bodyMap?: VehicleBodyPanelMap | null;
  editable?: boolean;
  onPanelChange?: (panelKey: VehicleBodyPanelKey, condition: VehicleBodyPanelCondition) => void;
}) {
  if (!bodyMap) return null;

  return (
    <div className="rounded-[24px] border border-black/6 bg-white p-4 shadow-sm">
      <PanelLegend />

      <div className="mt-5 rounded-[28px] border border-black/6 bg-shell/80 p-3 sm:p-5">
        <div className="mx-auto max-w-[34rem]">
          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {BODY_PANEL_LAYOUT.flatMap((row, rowIndex) =>
              row.map((panelKey, columnIndex) => {
                if (!panelKey) {
                  return <div key={`empty-${rowIndex}-${columnIndex}`} className="min-h-[3.8rem] sm:min-h-[4.6rem]" />;
                }

                const panelCondition = bodyMap[panelKey] ?? "original";
                return (
                  <div
                    key={panelKey}
                    className={`min-h-[3.8rem] border px-2.5 py-2 shadow-sm transition sm:min-h-[4.6rem] sm:px-3 sm:py-3 ${PANEL_CLASSES[panelCondition]} ${PANEL_SHAPE_CLASSES[panelKey]}`}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80 sm:text-[11px]">
                      {VEHICLE_BODY_PANEL_LABELS[panelKey]}
                    </p>
                    {editable ? (
                      <select
                        value={panelCondition}
                        onChange={(event) => onPanelChange?.(panelKey, event.target.value as VehicleBodyPanelCondition)}
                        className="mt-1.5 w-full rounded-[12px] border border-black/8 bg-white/90 px-2 py-1.5 text-[11px] font-medium text-ink outline-none transition focus:border-[#C6A87D] sm:text-xs"
                      >
                        {LEGEND_ORDER.map((key) => (
                          <option key={key} value={key}>
                            {VEHICLE_BODY_PANEL_CONDITION_LABELS[key]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="mt-2 text-[11px] font-semibold sm:text-sm">
                        {VEHICLE_BODY_PANEL_CONDITION_LABELS[panelCondition]}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {VEHICLE_BODY_PANEL_ORDER.map((panelKey) => {
          const panelCondition = bodyMap[panelKey] ?? "original";
          return (
            <div key={panelKey} className="flex items-center justify-between rounded-[18px] border border-black/6 bg-shell/60 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/72">
                {VEHICLE_BODY_PANEL_LABELS[panelKey]}
              </p>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${PANEL_CLASSES[panelCondition]}`}>
                {VEHICLE_BODY_PANEL_CONDITION_LABELS[panelCondition]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
