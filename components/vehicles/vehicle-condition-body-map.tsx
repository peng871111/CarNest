"use client";

import { useMemo, useState } from "react";
import {
  BUYER_BODY_MAP_PANEL_AREAS,
  BUYER_BODY_MAP_REFERENCE_SVG_PATH,
  BUYER_BODY_MAP_VIEWBOX,
} from "@/lib/buyer-body-map-artwork";
import {
  formatVehicleBodyDamageGridCellLabel,
  getVehicleBodyDamageGridCell,
  VEHICLE_BODY_DAMAGE_GRID_CELLS,
} from "@/lib/vehicle-body-damage-grid";
import {
  VEHICLE_BODY_PANEL_CONDITION_LABELS,
  VEHICLE_BODY_PANEL_CONDITION_OPTIONS,
  VEHICLE_BODY_PANEL_LABELS,
  VEHICLE_DAMAGE_TYPE_OPTIONS,
} from "@/lib/vehicle-condition-config";
import type {
  VehicleBodyPanelCondition,
  VehicleBodyPanelKey,
  VehicleBodyPanelMap,
  VehicleDamageType,
  WarehouseVehicleDamageRecord,
} from "@/types";

const PANEL_STYLES: Record<VehicleBodyPanelCondition, { fill: string; stroke: string; text: string }> = {
  original: { fill: "#ECFDF5", stroke: "#6EE7B7", text: "#065F46" },
  scratch: { fill: "#FEF3C7", stroke: "#F59E0B", text: "#92400E" },
  dent: { fill: "#FFEDD5", stroke: "#F97316", text: "#9A3412" },
  repaint: { fill: "#E0F2FE", stroke: "#38BDF8", text: "#075985" },
  repaired_damage: { fill: "#F3E8FF", stroke: "#A78BFA", text: "#6B21A8" }
};

const LEGEND_ORDER: VehicleBodyPanelCondition[] = ["original", "scratch", "dent", "repaint", "repaired_damage"];
const DAMAGE_CELL_TONE = {
  fill: "#F5D8A9",
  stroke: "#B8893F",
  text: "#704F1A",
};

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
      <span
        className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
        style={{
          borderColor: DAMAGE_CELL_TONE.stroke,
          backgroundColor: DAMAGE_CELL_TONE.fill,
          color: DAMAGE_CELL_TONE.text,
        }}
      >
        Grid damage marker
      </span>
    </div>
  );
}

type DamageTypeOption = VehicleDamageType | "none";

export function VehicleConditionBodyMap({
  bodyMap,
  editable = false,
  onPanelChange,
  selectedPanel,
  onPanelSelect,
  damageRecords = [],
  selectedGridCellId,
  onGridCellSelect,
  onGridCellDamageTypeChange,
}: {
  bodyMap?: VehicleBodyPanelMap | null;
  editable?: boolean;
  onPanelChange?: (panelKey: VehicleBodyPanelKey, condition: VehicleBodyPanelCondition) => void;
  selectedPanel?: VehicleBodyPanelKey;
  onPanelSelect?: (panelKey: VehicleBodyPanelKey) => void;
  damageRecords?: WarehouseVehicleDamageRecord[];
  selectedGridCellId?: string;
  onGridCellSelect?: (gridCellId: string, panelKey: VehicleBodyPanelKey) => void;
  onGridCellDamageTypeChange?: (
    gridCellId: string,
    panelKey: VehicleBodyPanelKey,
    damageType: DamageTypeOption
  ) => void;
}) {
  const [internalSelectedPanel, setInternalSelectedPanel] = useState<VehicleBodyPanelKey>("bonnet");
  const [pickerGridCellId, setPickerGridCellId] = useState<string>("");
  const activeSelectedPanel = selectedPanel ?? internalSelectedPanel;

  const selectedCondition = bodyMap?.[activeSelectedPanel] ?? "original";
  const selectedStyle = PANEL_STYLES[selectedCondition];
  const damageRecordsByGridCell = useMemo(() => {
    const next = new Map<string, WarehouseVehicleDamageRecord[]>();
    for (const record of damageRecords) {
      const gridCellId = record.gridCellId?.trim();
      if (!gridCellId) continue;
      next.set(gridCellId, [...(next.get(gridCellId) ?? []), record]);
    }
    return next;
  }, [damageRecords]);
  const pickerCell = getVehicleBodyDamageGridCell(pickerGridCellId);
  const activeGridCell = getVehicleBodyDamageGridCell(selectedGridCellId);

  const validSelectedPanel = useMemo<VehicleBodyPanelKey>(() => {
    if (bodyMap && activeSelectedPanel in bodyMap) return activeSelectedPanel;
    return "bonnet";
  }, [activeSelectedPanel, bodyMap]);

  if (!bodyMap) return null;

  return (
    <div className="rounded-[24px] border border-black/6 bg-white p-4 shadow-sm">
      <Legend />

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="rounded-[28px] border border-black/6 bg-shell/80 p-4 sm:p-6">
          <div className="relative mx-auto w-full max-w-[22rem]">
            <svg viewBox={`0 0 ${BUYER_BODY_MAP_VIEWBOX.width} ${BUYER_BODY_MAP_VIEWBOX.height}`} className="block w-full overflow-visible">
              <image
                href={BUYER_BODY_MAP_REFERENCE_SVG_PATH}
                x="0"
                y="0"
                width={BUYER_BODY_MAP_VIEWBOX.width}
                height={BUYER_BODY_MAP_VIEWBOX.height}
                preserveAspectRatio="xMidYMid meet"
              />
              {BUYER_BODY_MAP_PANEL_AREAS.map((panel) => {
                const condition = bodyMap[panel.key] ?? "original";
                const isSelected = editable && validSelectedPanel === panel.key;
                const style = PANEL_STYLES[condition];
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
                    stroke={isSelected ? "#1F1F1D" : style.stroke}
                    strokeOpacity={condition === "original" && !isSelected ? 0 : 0.92}
                    strokeWidth={isSelected ? 3 : 1.6}
                  />
                );
              })}

              {VEHICLE_BODY_DAMAGE_GRID_CELLS.map((cell) => {
                const cellRecords = damageRecordsByGridCell.get(cell.id) ?? [];
                const isSelectedCell = selectedGridCellId === cell.id;
                return (
                  <g
                    key={cell.id}
                    onClick={() => {
                      if (!editable) return;
                      setInternalSelectedPanel(cell.panelKey);
                      onPanelSelect?.(cell.panelKey);
                      onGridCellSelect?.(cell.id, cell.panelKey);
                      setPickerGridCellId(cell.id);
                    }}
                    className={editable ? "cursor-pointer" : ""}
                  >
                    <rect
                      x={cell.x}
                      y={cell.y}
                      width={cell.width}
                      height={cell.height}
                      fill={cellRecords.length ? DAMAGE_CELL_TONE.fill : "transparent"}
                      fillOpacity={cellRecords.length ? 0.18 : 0}
                      stroke={isSelectedCell ? "#1F1F1D" : "#CDBCA3"}
                      strokeOpacity={0.85}
                      strokeWidth={isSelectedCell ? 2.2 : 1}
                    />
                    {cellRecords.length ? (
                      <>
                        <circle
                          cx={cell.markerX}
                          cy={cell.markerY}
                          r={Math.max(Math.min(cell.width, cell.height) * 0.16, 8)}
                          fill="#171512"
                          stroke="#D1A75F"
                          strokeWidth="1.4"
                        />
                        <text
                          x={cell.markerX}
                          y={cell.markerY + 0.5}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="8"
                          fontWeight="700"
                          fill="#F2D39A"
                        >
                          {cellRecords.length}
                        </text>
                      </>
                    ) : null}
                  </g>
                );
              })}
            </svg>

            {editable && pickerCell ? (
              <div
                className="absolute z-10 w-44 rounded-[20px] border border-black/10 bg-white p-2 shadow-[0_18px_42px_rgba(17,12,8,0.18)]"
                style={{
                  left: `${(pickerCell.markerX / BUYER_BODY_MAP_VIEWBOX.width) * 100}%`,
                  top: `${(pickerCell.markerY / BUYER_BODY_MAP_VIEWBOX.height) * 100}%`,
                  transform: "translate(-50%, -110%)",
                }}
              >
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/45">
                  {formatVehicleBodyDamageGridCellLabel(pickerCell.id)}
                </p>
                <div className="mt-1 max-h-56 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      onGridCellDamageTypeChange?.(pickerCell.id, pickerCell.panelKey, "none");
                      setPickerGridCellId("");
                    }}
                    className="flex w-full items-center justify-between rounded-[14px] px-3 py-2 text-left text-sm text-ink transition hover:bg-shell"
                  >
                    <span>None</span>
                  </button>
                  {VEHICLE_DAMAGE_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onGridCellDamageTypeChange?.(pickerCell.id, pickerCell.panelKey, option.value);
                        setPickerGridCellId("");
                      }}
                      className="flex w-full items-center justify-between rounded-[14px] px-3 py-2 text-left text-sm text-ink transition hover:bg-shell"
                    >
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {editable ? (
          <div className="rounded-[24px] border border-black/6 bg-shell/70 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Selected panel</p>
            <p className="mt-2 text-base font-semibold text-ink">{VEHICLE_BODY_PANEL_LABELS[validSelectedPanel]}</p>
            <p className="mt-2 text-xs leading-5 text-ink/58">
              Tap a grid cell to choose a precise damage location, then pick a damage type from the floating menu.
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
            <div className="mt-4 rounded-[18px] border border-black/8 bg-white px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Selected grid area</p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {activeGridCell ? formatVehicleBodyDamageGridCellLabel(activeGridCell.id) : "Tap a grid cell"}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
