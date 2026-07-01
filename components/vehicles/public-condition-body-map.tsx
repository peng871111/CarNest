"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BUYER_BODY_MAP_PANEL_AREAS,
  BUYER_BODY_MAP_REFERENCE_SVG_PATH,
  BUYER_BODY_MAP_VIEWBOX
} from "@/lib/buyer-body-map-artwork";
import {
  formatVehicleBodyDamageGridCellLabel,
  getVehicleBodyDamageGridCell,
  VEHICLE_BODY_DAMAGE_GRID_CELLS,
} from "@/lib/vehicle-body-damage-grid";
import {
  VEHICLE_BODY_PANEL_CONDITION_LABELS,
  VEHICLE_BODY_PANEL_LABELS,
  VEHICLE_DAMAGE_TYPE_LABELS,
} from "@/lib/vehicle-condition-config";
import type {
  VehicleBodyPanelCondition,
  VehiclePublicDamageRecordSummary,
  VehicleBodyPanelMap,
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
  const damageRecordsByGridCell = useMemo(() => {
    const next = new Map<string, VehiclePublicDamageRecordSummary[]>();
    for (const record of damageRecords) {
      const gridCellId = record.gridCellId?.trim();
      if (!gridCellId) continue;
      next.set(gridCellId, [...(next.get(gridCellId) ?? []), record]);
    }
    return next;
  }, [damageRecords]);
  const cellsWithLinkedDamage = useMemo(
    () => VEHICLE_BODY_DAMAGE_GRID_CELLS.filter((cell) => (damageRecordsByGridCell.get(cell.id) ?? []).length > 0),
    [damageRecordsByGridCell]
  );
  const [selectedGridCellId, setSelectedGridCellId] = useState<string>(cellsWithLinkedDamage[0]?.id ?? "");
  const [hoveredGridCellId, setHoveredGridCellId] = useState<string>("");

  useEffect(() => {
    const nextDefaultGridCellId = cellsWithLinkedDamage[0]?.id ?? "";
    if (!nextDefaultGridCellId) {
      setSelectedGridCellId("");
      return;
    }

    if (!selectedGridCellId || !cellsWithLinkedDamage.some((cell) => cell.id === selectedGridCellId)) {
      setSelectedGridCellId(nextDefaultGridCellId);
    }
  }, [cellsWithLinkedDamage, selectedGridCellId]);

  const activeGridCellId = hoveredGridCellId || selectedGridCellId;
  const activeGridCell = getVehicleBodyDamageGridCell(activeGridCellId);
  const activeDamageRecords = activeGridCellId ? damageRecordsByGridCell.get(activeGridCellId) ?? [] : [];
  const hasLinkedDamage = cellsWithLinkedDamage.length > 0;

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
              const isActivePanel = activeGridCell?.panelKey === panel.key;

              return (
                <rect
                  key={panel.key}
                  x={panel.x}
                  y={panel.y}
                  width={panel.width}
                  height={panel.height}
                  rx={panel.rx}
                  fill={condition === "original" ? "transparent" : style.fill}
                  fillOpacity={condition === "original" ? 0 : 0.18}
                  stroke={isActivePanel ? "#1F1F1D" : style.stroke}
                  strokeOpacity={condition === "original" && !isActivePanel ? 0 : 0.9}
                  strokeWidth={isActivePanel ? 3 : 1.6}
                />
              );
            })}
            {VEHICLE_BODY_DAMAGE_GRID_CELLS.map((cell) => {
              const cellRecords = damageRecordsByGridCell.get(cell.id) ?? [];
              const isActiveCell = activeGridCellId === cell.id;

              return (
                <g key={cell.id}>
                  <rect
                    x={cell.x}
                    y={cell.y}
                    width={cell.width}
                    height={cell.height}
                    fill={cellRecords.length ? "#F5D8A9" : "transparent"}
                    fillOpacity={cellRecords.length ? 0.18 : 0}
                    stroke={isActiveCell ? "#1F1F1D" : "#CDBCA3"}
                    strokeOpacity={0.82}
                    strokeWidth={isActiveCell ? 2.1 : 1}
                  />
                  {cellRecords.length ? (
                    <g
                      role="button"
                      tabIndex={0}
                      onMouseEnter={() => setHoveredGridCellId(cell.id)}
                      onMouseLeave={() => setHoveredGridCellId("")}
                      onFocus={() => setHoveredGridCellId(cell.id)}
                      onBlur={() => setHoveredGridCellId("")}
                      onClick={() => setSelectedGridCellId(cell.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedGridCellId(cell.id);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={cell.markerX}
                        cy={cell.markerY}
                        r={isActiveCell ? 16 : 14}
                        fill="#171512"
                        stroke="#D1A75F"
                        strokeWidth={isActiveCell ? 2.3 : 1.7}
                      />
                      <text
                        x={cell.markerX}
                        y={cell.markerY + 0.5}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="9"
                        fontWeight="700"
                        fill="#F2D39A"
                      >
                        {cellRecords.length}
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
              Marker = grid-linked damage records
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

          {hasLinkedDamage && activeGridCell && activeDamageRecords.length ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-[20px] border border-[#E2D8CA] bg-[#FBF7F0] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#8F7A5C]">Panel / body location</p>
                <p className="mt-2 text-lg font-semibold text-[#221F1B]">
                  {VEHICLE_BODY_PANEL_LABELS[activeGridCell.panelKey]}
                </p>
                <p className="mt-1 text-sm font-medium text-[#655848]">{formatVehicleBodyDamageGridCellLabel(activeGridCell.id)}</p>
                <p className="mt-2 text-sm text-[#6E6256]">
                  Hover, click, or tap another marker on the body map to inspect a different damage location.
                </p>
              </div>

              {activeDamageRecords.map((record) => (
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
                This Condition Summary does not have any grid-linked damage records yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
