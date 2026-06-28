"use client";

import { useMemo, useState } from "react";
import {
  BUYER_BODY_MAP_OUTLINE_PATHS,
  BUYER_BODY_MAP_PANEL_GEOMETRY,
  BUYER_BODY_MAP_VIEWBOX,
  BUYER_BODY_MAP_WHEELS
} from "@/lib/buyer-body-map-artwork";
import { VEHICLE_BODY_PANEL_CONDITION_LABELS, VEHICLE_BODY_PANEL_CONDITION_OPTIONS, VEHICLE_BODY_PANEL_LABELS } from "@/lib/vehicle-condition-config";
import type { VehicleBodyPanelCondition, VehicleBodyPanelKey, VehicleBodyPanelMap } from "@/types";

const PANEL_STYLES: Record<VehicleBodyPanelCondition, { fill: string; stroke: string; text: string }> = {
  original: { fill: "#ECFDF5", stroke: "#6EE7B7", text: "#065F46" },
  scratch: { fill: "#FEF3C7", stroke: "#F59E0B", text: "#92400E" },
  dent: { fill: "#FFEDD5", stroke: "#F97316", text: "#9A3412" },
  repaint: { fill: "#E0F2FE", stroke: "#38BDF8", text: "#075985" },
  repaired_damage: { fill: "#F3E8FF", stroke: "#A78BFA", text: "#6B21A8" }
};

const LEGEND_ORDER: VehicleBodyPanelCondition[] = ["original", "scratch", "dent", "repaint", "repaired_damage"];

function Legend() {
  return (
    <div className="flex flex-wrap gap-2">
      {LEGEND_ORDER.map((key) => (
        <span
          key={key}
          className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
          style={{
            borderColor: PANEL_STYLES[key].stroke,
            backgroundColor: PANEL_STYLES[key].fill,
            color: PANEL_STYLES[key].text
          }}
        >
          {VEHICLE_BODY_PANEL_CONDITION_LABELS[key]}
        </span>
      ))}
    </div>
  );
}

function VehicleOutline() {
  return (
    <>
      <path
        d={BUYER_BODY_MAP_OUTLINE_PATHS.shell}
        fill="#FBF7F1"
        stroke="#C9BAA7"
        strokeWidth="3"
      />
      {[
        BUYER_BODY_MAP_OUTLINE_PATHS.bonnetBreak,
        BUYER_BODY_MAP_OUTLINE_PATHS.roofBreak,
        BUYER_BODY_MAP_OUTLINE_PATHS.sillBreak
      ].map((path) => (
        <path key={path} d={path} fill="none" stroke="#D8CCBD" strokeWidth="2" />
      ))}
      <path d={BUYER_BODY_MAP_OUTLINE_PATHS.frontGlassLeft} fill="#FFFDF9" stroke="#D8CCBD" strokeWidth="1.7" />
      <path d={BUYER_BODY_MAP_OUTLINE_PATHS.frontGlassRight} fill="#FFFDF9" stroke="#D8CCBD" strokeWidth="1.7" />
      <path d={BUYER_BODY_MAP_OUTLINE_PATHS.rearGlass} fill="#FFFDF9" stroke="#D8CCBD" strokeWidth="1.8" />
      {BUYER_BODY_MAP_WHEELS.map((wheel) => (
        <g key={`${wheel.cx}-${wheel.cy}`}>
          <circle cx={wheel.cx} cy={wheel.cy} r={wheel.outerR} fill="none" stroke="#BDAE9B" strokeWidth="2.4" />
          <circle cx={wheel.cx} cy={wheel.cy} r={wheel.innerR} fill="none" stroke="#CFC2B1" strokeWidth="1.8" />
        </g>
      ))}
    </>
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
  const [selectedPanel, setSelectedPanel] = useState<VehicleBodyPanelKey>("bonnet");

  const selectedCondition = bodyMap?.[selectedPanel] ?? "original";
  const selectedStyle = PANEL_STYLES[selectedCondition];

  const validSelectedPanel = useMemo<VehicleBodyPanelKey>(() => {
    if (bodyMap && selectedPanel in bodyMap) return selectedPanel;
    return "bonnet";
  }, [bodyMap, selectedPanel]);

  if (!bodyMap) return null;

  return (
    <div className="rounded-[24px] border border-black/6 bg-white p-4 shadow-sm">
      <Legend />

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="rounded-[28px] border border-black/6 bg-shell/80 p-4 sm:p-6">
          <svg viewBox={`0 0 ${BUYER_BODY_MAP_VIEWBOX.width} ${BUYER_BODY_MAP_VIEWBOX.height}`} className="mx-auto block w-full max-w-[22rem] overflow-visible">
            <VehicleOutline />
            {BUYER_BODY_MAP_PANEL_GEOMETRY.map((panel) => {
              const condition = bodyMap[panel.key] ?? "original";
              const isSelected = editable && validSelectedPanel === panel.key;
              const style = PANEL_STYLES[condition];
              return (
                <g
                  key={panel.key}
                  onClick={() => editable && setSelectedPanel(panel.key)}
                  className={editable ? "cursor-pointer" : ""}
                >
                  <path
                    d={panel.path}
                    fill={style.fill}
                    stroke={isSelected ? "#1F1F1D" : style.stroke}
                    strokeWidth={isSelected ? 3.5 : 2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {editable ? (
          <div className="rounded-[24px] border border-black/6 bg-shell/70 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Selected panel</p>
            <p className="mt-2 text-base font-semibold text-ink">{VEHICLE_BODY_PANEL_LABELS[validSelectedPanel]}</p>
            <p className="mt-2 text-xs leading-5 text-ink/58">
              Tap any highlighted vehicle panel to update its current condition.
            </p>
            <div className="mt-4 rounded-[18px] border px-3 py-3" style={{ borderColor: selectedStyle.stroke, backgroundColor: selectedStyle.fill }}>
              <label className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: selectedStyle.text }}>
                Panel condition
              </label>
              <select
                value={selectedCondition}
                onChange={(event) => onPanelChange?.(validSelectedPanel, event.target.value as VehicleBodyPanelCondition)}
                className="mt-2 w-full rounded-[14px] border border-black/8 bg-white px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-[#C6A87D]"
              >
                {VEHICLE_BODY_PANEL_CONDITION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
