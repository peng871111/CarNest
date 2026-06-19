"use client";

import { useMemo, useState } from "react";
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

type PanelGeometry = {
  key: VehicleBodyPanelKey;
  labelX: number;
  labelY: number;
  path: string;
};

const PANEL_GEOMETRY: PanelGeometry[] = [
  { key: "frontBumper", labelX: 160, labelY: 86, path: "M108 54 Q160 18 212 54 L196 88 Q160 70 124 88 Z" },
  { key: "bonnet", labelX: 160, labelY: 146, path: "M118 94 Q160 62 202 94 L194 196 Q160 212 126 196 Z" },
  { key: "leftFrontGuard", labelX: 78, labelY: 144, path: "M78 98 Q94 94 110 104 L118 194 Q102 206 84 200 L62 134 Q62 110 78 98 Z" },
  { key: "rightFrontGuard", labelX: 242, labelY: 144, path: "M242 98 Q226 94 210 104 L202 194 Q218 206 236 200 L258 134 Q258 110 242 98 Z" },
  { key: "roof", labelX: 160, labelY: 292, path: "M122 214 Q160 186 198 214 L190 364 Q160 386 130 364 Z" },
  { key: "leftFrontDoor", labelX: 86, labelY: 260, path: "M82 206 Q104 206 122 218 L130 306 Q108 314 88 306 L68 262 Q66 226 82 206 Z" },
  { key: "rightFrontDoor", labelX: 234, labelY: 260, path: "M238 206 Q216 206 198 218 L190 306 Q212 314 232 306 L252 262 Q254 226 238 206 Z" },
  { key: "leftRearDoor", labelX: 86, labelY: 352, path: "M88 316 Q110 316 128 324 L134 392 Q114 404 94 398 L72 360 Q72 330 88 316 Z" },
  { key: "rightRearDoor", labelX: 234, labelY: 352, path: "M232 316 Q210 316 192 324 L186 392 Q206 404 226 398 L248 360 Q248 330 232 316 Z" },
  { key: "leftRearQuarter", labelX: 90, labelY: 446, path: "M94 406 Q116 410 132 424 L138 486 Q120 500 98 498 L76 462 Q72 426 94 406 Z" },
  { key: "rightRearQuarter", labelX: 230, labelY: 446, path: "M226 406 Q204 410 188 424 L182 486 Q200 500 222 498 L244 462 Q248 426 226 406 Z" },
  { key: "bootLid", labelX: 160, labelY: 458, path: "M126 390 Q160 372 194 390 L200 488 Q160 516 120 488 Z" },
  { key: "rearBumper", labelX: 160, labelY: 556, path: "M124 500 Q160 530 196 500 L214 554 Q160 586 106 554 Z" }
];

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
        d="M116 46 Q160 12 204 46 L252 114 Q266 136 264 174 L254 250 L252 356 L246 438 Q244 470 224 494 L198 524 Q186 540 184 564 L136 564 Q134 540 122 524 L96 494 Q76 470 74 438 L68 356 L66 250 L56 174 Q54 136 68 114 Z"
        fill="#FBF7F1"
        stroke="#C9BAA7"
        strokeWidth="3"
      />
      <path d="M120 90 Q160 62 200 90" fill="none" stroke="#D8CCBD" strokeWidth="2" />
      <path d="M126 206 Q160 186 194 206" fill="none" stroke="#D8CCBD" strokeWidth="2" />
      <path d="M132 392 Q160 374 188 392" fill="none" stroke="#D8CCBD" strokeWidth="2" />
      <path d="M124 500 Q160 526 196 500" fill="none" stroke="#D8CCBD" strokeWidth="2" />
      <rect x="44" y="132" width="22" height="84" rx="10" fill="#1F1F1D" opacity="0.16" />
      <rect x="254" y="132" width="22" height="84" rx="10" fill="#1F1F1D" opacity="0.16" />
      <rect x="42" y="356" width="22" height="94" rx="10" fill="#1F1F1D" opacity="0.16" />
      <rect x="256" y="356" width="22" height="94" rx="10" fill="#1F1F1D" opacity="0.16" />
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
          <svg viewBox="0 0 320 610" className="mx-auto block w-full max-w-[22rem] overflow-visible">
            <VehicleOutline />
            {PANEL_GEOMETRY.map((panel) => {
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
                  <text
                    x={panel.labelX}
                    y={panel.labelY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill={style.text}
                    letterSpacing="0.08em"
                  >
                    {VEHICLE_BODY_PANEL_LABELS[panel.key].replace(/\b(front|rear|left|right)\b/gi, "").trim().toUpperCase()}
                  </text>
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
