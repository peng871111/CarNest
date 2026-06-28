"use client";

import {
  BUYER_BODY_MAP_PANEL_AREAS,
  BUYER_BODY_MAP_REFERENCE_SVG_PATH,
  BUYER_BODY_MAP_VIEWBOX
} from "@/lib/buyer-body-map-artwork";
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
          <svg viewBox={`0 0 ${BUYER_BODY_MAP_VIEWBOX.width} ${BUYER_BODY_MAP_VIEWBOX.height}`} className="mx-auto block w-full max-w-[24rem]">
            <image
              href={BUYER_BODY_MAP_REFERENCE_SVG_PATH}
              x="0"
              y="0"
              width={BUYER_BODY_MAP_VIEWBOX.width}
              height={BUYER_BODY_MAP_VIEWBOX.height}
              preserveAspectRatio="xMidYMid meet"
            />
            {BUYER_BODY_MAP_PANEL_AREAS.map((panel) => {
              const condition = bodyMap?.[panel.key] ?? "original";
              const marker = DAMAGE_MARKER_MAP[condition];
              return (
                <g key={panel.key}>
                  {marker.code ? (
                    <>
                      <rect
                        x={panel.x}
                        y={panel.y}
                        width={panel.width}
                        height={panel.height}
                        rx={panel.rx}
                        fill={marker.fill}
                        fillOpacity="0.12"
                        stroke={marker.stroke}
                        strokeOpacity="0.75"
                        strokeWidth="1.5"
                      />
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
              {BUYER_BODY_MAP_PANEL_AREAS.map((panel) => (
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
