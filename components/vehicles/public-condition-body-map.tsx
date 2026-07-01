"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BUYER_BODY_MAP_PANEL_AREAS,
  BUYER_BODY_MAP_REFERENCE_SVG_PATH,
  BUYER_BODY_MAP_VIEWBOX
} from "@/lib/buyer-body-map-artwork";
import {
  VEHICLE_BODY_PANEL_CONDITION_LABELS,
  VEHICLE_BODY_PANEL_LABELS,
  VEHICLE_DAMAGE_TYPE_LABELS,
} from "@/lib/vehicle-condition-config";
import type {
  VehicleBodyPanelCondition,
  VehicleBodyPanelKey,
  VehicleBodyPanelMap,
  VehiclePublicDamageRecordSummary,
} from "@/types";

const PANEL_STYLES: Record<VehicleBodyPanelCondition, { fill: string; stroke: string; label: string }> = {
  original: { fill: "#FBF7F1", stroke: "#D6C8B5", label: "Original" },
  scratch: { fill: "#FDECC5", stroke: "#D4A347", label: "Scratch" },
  dent: { fill: "#F9DFC9", stroke: "#C57647", label: "Dent" },
  repaint: { fill: "#E5EEF6", stroke: "#6A8DAF", label: "Repaint" },
  repaired_damage: { fill: "#EEE6F7", stroke: "#8A73B2", label: "Repaired damage" }
};

export function PublicConditionBodyMap({
  bodyMap,
  note,
  damageRecords = [],
}: {
  bodyMap?: VehicleBodyPanelMap | null;
  note?: string | null;
  damageRecords?: VehiclePublicDamageRecordSummary[];
}) {
  const damageRecordsByPanel = useMemo(() => {
    const next = new Map<VehicleBodyPanelKey, VehiclePublicDamageRecordSummary[]>();
    for (const record of damageRecords) {
      next.set(record.panelKey, [...(next.get(record.panelKey) ?? []), record]);
    }
    return next;
  }, [damageRecords]);
  const panelsWithLinkedDamage = useMemo(
    () => BUYER_BODY_MAP_PANEL_AREAS
      .map((panel) => panel.key)
      .filter((panelKey) => (damageRecordsByPanel.get(panelKey) ?? []).length > 0),
    [damageRecordsByPanel]
  );
  const [selectedPanel, setSelectedPanel] = useState<VehicleBodyPanelKey | null>(panelsWithLinkedDamage[0] ?? null);
  const [hoveredPanel, setHoveredPanel] = useState<VehicleBodyPanelKey | null>(null);

  useEffect(() => {
    const nextDefaultPanel = panelsWithLinkedDamage[0] ?? null;
    if (!nextDefaultPanel) {
      setSelectedPanel(null);
      return;
    }

    if (!selectedPanel || !panelsWithLinkedDamage.includes(selectedPanel)) {
      setSelectedPanel(nextDefaultPanel);
    }
  }, [panelsWithLinkedDamage, selectedPanel]);

  const activePanel = hoveredPanel ?? selectedPanel;
  const activePanelRecords = activePanel ? damageRecordsByPanel.get(activePanel) ?? [] : [];
  const hasLinkedDamage = panelsWithLinkedDamage.length > 0;

  return (
    <div className="rounded-[32px] border border-[#C9B79C]/35 bg-[radial-gradient(circle_at_top,rgba(233,218,190,0.28),transparent_44%),linear-gradient(180deg,#fffdf9_0%,#f7f1e7_100%)] p-5 shadow-[0_24px_60px_rgba(31,24,18,0.08)] sm:p-7">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)] xl:items-start">
        <div className="rounded-[28px] border border-[#D8CCBD]/70 bg-white/85 p-4 sm:p-6">
          <svg viewBox={`0 0 ${BUYER_BODY_MAP_VIEWBOX.width} ${BUYER_BODY_MAP_VIEWBOX.height}`} className="mx-auto block w-full max-w-[24rem] overflow-visible">
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
              const style = PANEL_STYLES[condition];
              const panelRecords = damageRecordsByPanel.get(panel.key) ?? [];
              const isActive = activePanel === panel.key;

              return (
                <g key={panel.key}>
                  <rect
                    x={panel.x}
                    y={panel.y}
                    width={panel.width}
                    height={panel.height}
                    rx={panel.rx}
                    fill={condition === "original" ? "transparent" : style.fill}
                    fillOpacity={condition === "original" ? 0 : 0.18}
                    stroke={isActive ? "#1F1F1D" : style.stroke}
                    strokeOpacity={condition === "original" && !isActive ? 0 : 0.9}
                    strokeWidth={isActive ? 3 : 1.6}
                  />
                  {panelRecords.length ? (
                    <g
                      role="button"
                      tabIndex={0}
                      onMouseEnter={() => setHoveredPanel(panel.key)}
                      onMouseLeave={() => setHoveredPanel(null)}
                      onFocus={() => setHoveredPanel(panel.key)}
                      onBlur={() => setHoveredPanel(null)}
                      onClick={() => setSelectedPanel(panel.key)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedPanel(panel.key);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={panel.markerX}
                        cy={panel.markerY}
                        r={isActive ? 17 : 15}
                        fill="#171512"
                        stroke="#D1A75F"
                        strokeWidth={isActive ? 2.4 : 1.8}
                      />
                      <text
                        x={panel.markerX}
                        y={panel.markerY + 0.5}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="10"
                        fontWeight="700"
                        fill="#F2D39A"
                      >
                        {panelRecords.length}
                      </text>
                    </g>
                  ) : null}
                </g>
              );
            })}
          </svg>

          <div className="mt-5 flex flex-wrap gap-2">
            {(Object.keys(PANEL_STYLES) as VehicleBodyPanelCondition[]).map((conditionKey) => (
              <span
                key={conditionKey}
                className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  borderColor: PANEL_STYLES[conditionKey].stroke,
                  backgroundColor: PANEL_STYLES[conditionKey].fill,
                  color: "#4B4034",
                }}
              >
                {VEHICLE_BODY_PANEL_CONDITION_LABELS[conditionKey]}
              </span>
            ))}
            <span className="rounded-full border border-[#D1A75F]/55 bg-[#191919] px-2.5 py-1 text-[11px] font-semibold text-[#E0BD77]">
              Marker = linked damage records
            </span>
          </div>

          {note?.trim() ? (
            <div className="mt-5 rounded-[20px] border border-[#E2D8CA] bg-[#FBF7F0] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8F7A5C]">General damage notes</p>
              <p className="mt-2 text-sm leading-6 text-[#6E6256]">{note}</p>
            </div>
          ) : null}
        </div>

        <div className="rounded-[28px] border border-[#D8CCBD]/70 bg-white/90 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#B8893F]">Damage Detail</p>

          {hasLinkedDamage && activePanelRecords.length ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-[20px] border border-[#E2D8CA] bg-[#FBF7F0] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#8F7A5C]">Panel / body location</p>
                <p className="mt-2 text-lg font-semibold text-[#221F1B]">{VEHICLE_BODY_PANEL_LABELS[activePanel as VehicleBodyPanelKey]}</p>
                <p className="mt-1 text-sm text-[#6E6256]">
                  Hover, click, or tap another marker on the body map to inspect a different damage location.
                </p>
              </div>

              {activePanelRecords.map((record) => (
                <div key={record.id} className="rounded-[22px] border border-[#E2D8CA] bg-white px-4 py-4 shadow-[0_10px_26px_rgba(31,24,18,0.06)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8F7A5C]">Damage Type</p>
                    <span className="rounded-full border border-[#E1D5C6] bg-[#FBF7F0] px-3 py-1 text-xs font-semibold text-[#4D4135]">
                      {VEHICLE_DAMAGE_TYPE_LABELS[record.damageType]}
                    </span>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-[#221F1B]">Notes</p>
                      <p className="mt-1 text-sm leading-6 text-[#6E6256]">
                        {record.notes.trim() || "No additional notes recorded for this damage entry."}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-[#221F1B]">Linked photos</p>
                      {record.images.length ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {record.images.map((image, index) => (
                            <div key={`${record.id}-${image.url}-${index}`} className="overflow-hidden rounded-[18px] border border-[#E2D8CA] bg-[#FBF7F0]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={image.url} alt={image.label} loading="lazy" className="aspect-[4/3] w-full object-cover object-center" />
                              <div className="px-3 py-3">
                                <p className="text-sm font-medium text-[#221F1B]">{image.label}</p>
                                {image.note?.trim() ? (
                                  <p className="mt-1 text-sm leading-6 text-[#6E6256]">{image.note}</p>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-sm leading-6 text-[#6E6256]">No linked photos recorded for this damage entry.</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-[22px] border border-dashed border-[#D8CCBD] bg-[#FBF7F0] px-4 py-5">
              <p className="text-sm font-medium text-[#65543F]">No panel-linked damage photos recorded.</p>
              <p className="mt-2 text-sm leading-6 text-[#6E6256]">
                This Condition Summary does not have any panel-linked damage records yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
