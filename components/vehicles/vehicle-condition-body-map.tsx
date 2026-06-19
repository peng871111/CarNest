"use client";

import { VEHICLE_BODY_PANEL_CONDITION_LABELS, VEHICLE_BODY_PANEL_LABELS, VEHICLE_BODY_PANEL_ORDER } from "@/lib/vehicle-condition-config";
import type { VehicleBodyPanelCondition, VehicleBodyPanelMap } from "@/types";

const PANEL_CLASSES: Record<VehicleBodyPanelCondition, string> = {
  original: "border-emerald-200 bg-emerald-50 text-emerald-800",
  scratch: "border-amber-200 bg-amber-50 text-amber-800",
  dent: "border-orange-200 bg-orange-50 text-orange-800",
  repaint: "border-sky-200 bg-sky-50 text-sky-800",
  repaired_damage: "border-violet-200 bg-violet-50 text-violet-800"
};

const LEGEND_ORDER: VehicleBodyPanelCondition[] = ["original", "scratch", "dent", "repaint", "repaired_damage"];

export function VehicleConditionBodyMap({ bodyMap }: { bodyMap?: VehicleBodyPanelMap | null }) {
  if (!bodyMap) return null;

  return (
    <div className="rounded-[24px] border border-black/6 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {LEGEND_ORDER.map((key) => (
          <span
            key={key}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${PANEL_CLASSES[key]}`}
          >
            {VEHICLE_BODY_PANEL_CONDITION_LABELS[key]}
          </span>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {VEHICLE_BODY_PANEL_ORDER.map((panelKey) => {
          const panelCondition = bodyMap[panelKey] ?? "original";
          return (
            <div
              key={panelKey}
              className={`rounded-[18px] border px-3 py-3 ${PANEL_CLASSES[panelCondition]}`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">
                {VEHICLE_BODY_PANEL_LABELS[panelKey]}
              </p>
              <p className="mt-2 text-sm font-semibold">
                {VEHICLE_BODY_PANEL_CONDITION_LABELS[panelCondition]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
