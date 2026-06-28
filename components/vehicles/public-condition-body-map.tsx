"use client";

import { VEHICLE_BODY_PANEL_LABELS, VEHICLE_BODY_PANEL_ORDER } from "@/lib/vehicle-condition-config";
import type { VehicleBodyPanelCondition, VehicleBodyPanelKey, VehicleBodyPanelMap } from "@/types";

const INSPECTION_LEGEND: Array<[string, string]> = [
  ["A1", "Scratch (Small)"],
  ["A2", "Scratch (Medium)"],
  ["A3", "Scratch (Large)"],
  ["U1", "Dent (Small)"],
  ["U2", "Dent (Medium)"],
  ["U3", "Dent (Large)"],
  ["R", "Repaired Panel"],
  ["W", "Paint Wave / Paint Defect"],
  ["S", "Rust"],
  ["X", "Needs Replacement"],
  ["C", "Corrosion"],
  ["Y", "Crack"],
  ["O", "Other"]
];

const DAMAGE_MARKER_MAP: Record<VehicleBodyPanelCondition, { code: string | null; fill: string; stroke: string }> = {
  original: { code: null, fill: "#FBF7F1", stroke: "#D6C8B5" },
  scratch: { code: "A1", fill: "#FDECC5", stroke: "#D4A347" },
  dent: { code: "U1", fill: "#F9DFC9", stroke: "#C57647" },
  repaint: { code: "W", fill: "#E5EEF6", stroke: "#6A8DAF" },
  repaired_damage: { code: "R", fill: "#EEE6F7", stroke: "#8A73B2" }
};

const PANEL_GEOMETRY: Array<{ key: VehicleBodyPanelKey; labelX: number; labelY: number; markerX: number; markerY: number; shortLabel: string; path: string }> = [
  { key: "frontBumper", labelX: 160, labelY: 92, markerX: 160, markerY: 66, shortLabel: "FB", path: "M108 54 Q160 18 212 54 L196 88 Q160 70 124 88 Z" },
  { key: "bonnet", labelX: 160, labelY: 152, markerX: 160, markerY: 132, shortLabel: "BN", path: "M118 94 Q160 62 202 94 L194 196 Q160 212 126 196 Z" },
  { key: "leftFrontGuard", labelX: 78, labelY: 148, markerX: 84, markerY: 132, shortLabel: "LFG", path: "M78 98 Q94 94 110 104 L118 194 Q102 206 84 200 L62 134 Q62 110 78 98 Z" },
  { key: "rightFrontGuard", labelX: 242, labelY: 148, markerX: 236, markerY: 132, shortLabel: "RFG", path: "M242 98 Q226 94 210 104 L202 194 Q218 206 236 200 L258 134 Q258 110 242 98 Z" },
  { key: "roof", labelX: 160, labelY: 292, markerX: 160, markerY: 266, shortLabel: "RF", path: "M122 214 Q160 186 198 214 L190 364 Q160 386 130 364 Z" },
  { key: "leftFrontDoor", labelX: 88, labelY: 260, markerX: 94, markerY: 244, shortLabel: "LFD", path: "M82 206 Q104 206 122 218 L130 306 Q108 314 88 306 L68 262 Q66 226 82 206 Z" },
  { key: "rightFrontDoor", labelX: 232, labelY: 260, markerX: 226, markerY: 244, shortLabel: "RFD", path: "M238 206 Q216 206 198 218 L190 306 Q212 314 232 306 L252 262 Q254 226 238 206 Z" },
  { key: "leftRearDoor", labelX: 88, labelY: 352, markerX: 96, markerY: 344, shortLabel: "LRD", path: "M88 316 Q110 316 128 324 L134 392 Q114 404 94 398 L72 360 Q72 330 88 316 Z" },
  { key: "rightRearDoor", labelX: 232, labelY: 352, markerX: 224, markerY: 344, shortLabel: "RRD", path: "M232 316 Q210 316 192 324 L186 392 Q206 404 226 398 L248 360 Q248 330 232 316 Z" },
  { key: "leftRearQuarter", labelX: 92, labelY: 446, markerX: 100, markerY: 438, shortLabel: "LRQ", path: "M94 406 Q116 410 132 424 L138 486 Q120 500 98 498 L76 462 Q72 426 94 406 Z" },
  { key: "rightRearQuarter", labelX: 228, labelY: 446, markerX: 220, markerY: 438, shortLabel: "RRQ", path: "M226 406 Q204 410 188 424 L182 486 Q200 500 222 498 L244 462 Q248 426 226 406 Z" },
  { key: "bootLid", labelX: 160, labelY: 458, markerX: 160, markerY: 438, shortLabel: "BT", path: "M126 390 Q160 372 194 390 L200 488 Q160 516 120 488 Z" },
  { key: "rearBumper", labelX: 160, labelY: 552, markerX: 160, markerY: 538, shortLabel: "RB", path: "M124 500 Q160 530 196 500 L214 554 Q160 586 106 554 Z" }
];

function VehicleOutline() {
  return (
    <>
      <path
        d="M116 46 Q160 12 204 46 L252 114 Q266 136 264 174 L254 250 L252 356 L246 438 Q244 470 224 494 L198 524 Q186 540 184 564 L136 564 Q134 540 122 524 L96 494 Q76 470 74 438 L68 356 L66 250 L56 174 Q54 136 68 114 Z"
        fill="#FCFAF7"
        stroke="#C5B69F"
        strokeWidth="3"
      />
      <path d="M120 90 Q160 62 200 90" fill="none" stroke="#D7CCBE" strokeWidth="2" />
      <path d="M126 206 Q160 186 194 206" fill="none" stroke="#D7CCBE" strokeWidth="2" />
      <path d="M132 392 Q160 374 188 392" fill="none" stroke="#D7CCBE" strokeWidth="2" />
      <path d="M124 500 Q160 526 196 500" fill="none" stroke="#D7CCBE" strokeWidth="2" />
      <rect x="44" y="132" width="22" height="84" rx="10" fill="#1F1F1D" opacity="0.14" />
      <rect x="254" y="132" width="22" height="84" rx="10" fill="#1F1F1D" opacity="0.14" />
      <rect x="42" y="356" width="22" height="94" rx="10" fill="#1F1F1D" opacity="0.14" />
      <rect x="256" y="356" width="22" height="94" rx="10" fill="#1F1F1D" opacity="0.14" />
    </>
  );
}

function getDamagePanels(bodyMap?: VehicleBodyPanelMap | null) {
  if (!bodyMap) return [] as VehicleBodyPanelKey[];
  return VEHICLE_BODY_PANEL_ORDER.filter((key) => (bodyMap[key] ?? "original") !== "original");
}

export function PublicConditionBodyMap({
  bodyMap,
  note
}: {
  bodyMap?: VehicleBodyPanelMap | null;
  note?: string | null;
}) {
  const damagePanels = getDamagePanels(bodyMap);
  const hasDamage = damagePanels.length > 0;

  return (
    <div className="rounded-[32px] border border-[#C9B79C]/35 bg-[radial-gradient(circle_at_top,rgba(233,218,190,0.28),transparent_44%),linear-gradient(180deg,#fffdf9_0%,#f7f1e7_100%)] p-5 shadow-[0_24px_60px_rgba(31,24,18,0.08)] sm:p-7">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
        <div className="rounded-[28px] border border-[#D8CCBD]/70 bg-white/80 p-4 sm:p-6">
          <svg viewBox="0 0 320 610" className="mx-auto block w-full max-w-[24rem]">
            <VehicleOutline />
            {PANEL_GEOMETRY.map((panel) => {
              const condition = bodyMap?.[panel.key] ?? "original";
              const marker = DAMAGE_MARKER_MAP[condition];
              return (
                <g key={panel.key}>
                  <path
                    d={panel.path}
                    fill={marker.fill}
                    stroke={marker.stroke}
                    strokeWidth={condition === "original" ? 1.3 : 2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <text
                    x={panel.labelX}
                    y={panel.labelY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="8.5"
                    fontWeight="700"
                    fill="#7B6851"
                    letterSpacing="0.08em"
                  >
                    {panel.shortLabel}
                  </text>
                  {marker.code ? (
                    <>
                      <rect
                        x={panel.markerX - 15}
                        y={panel.markerY - 9}
                        width={30}
                        height={18}
                        rx={5}
                        fill="#161616"
                        stroke="#D1A75F"
                        strokeWidth="1"
                      />
                      <text
                        x={panel.markerX}
                        y={panel.markerY + 0.5}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="9"
                        fontWeight="700"
                        fill="#D1A75F"
                        letterSpacing="0.08em"
                      >
                        {marker.code}
                      </text>
                    </>
                  ) : null}
                </g>
              );
            })}
          </svg>

          <div className="mt-5 space-y-2">
            {!hasDamage ? (
              <p className="text-sm font-medium text-[#65543F]">No body damage notes recorded.</p>
            ) : null}
            <p className="text-sm leading-6 text-[#6E6256]">
              {note?.trim() || "No body damage notes recorded."}
            </p>
          </div>
        </div>

        <div className="rounded-[28px] border border-[#D8CCBD]/70 bg-white/85 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#B8893F]">Inspection Legend</p>
          <div className="mt-4 space-y-2.5">
            {INSPECTION_LEGEND.map(([code, label]) => (
              <div key={code} className="grid grid-cols-[2.4rem_minmax(0,1fr)] items-center gap-3">
                <span className="inline-flex justify-center rounded-full border border-[#D1A75F]/55 bg-[#191919] px-2 py-1 text-[11px] font-semibold tracking-[0.1em] text-[#E0BD77]">
                  {code}
                </span>
                <span className="text-sm text-[#2F2A24]">{label}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-[#E2D8CA] pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8F7A5C]">Panel Reference</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PANEL_GEOMETRY.map((panel) => (
                <span
                  key={panel.key}
                  className="rounded-full border border-[#E1D5C6] bg-[#FBF7F0] px-2.5 py-1 text-[11px] font-medium text-[#665747]"
                >
                  {VEHICLE_BODY_PANEL_LABELS[panel.key]}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
