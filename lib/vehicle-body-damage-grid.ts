import { BUYER_BODY_MAP_PANEL_AREAS } from "@/lib/buyer-body-map-artwork";
import { VEHICLE_BODY_PANEL_LABELS } from "@/lib/vehicle-condition-config";
import type { VehicleBodyPanelKey } from "@/types";

type GridLayout = {
  rows: number;
  cols: number;
};

export type VehicleBodyDamageGridCell = {
  id: string;
  panelKey: VehicleBodyPanelKey;
  panelLabel: string;
  row: number;
  col: number;
  code: string;
  x: number;
  y: number;
  width: number;
  height: number;
  markerX: number;
  markerY: number;
};

const PANEL_GRID_LAYOUTS: Record<VehicleBodyPanelKey, GridLayout> = {
  frontBumper: { rows: 1, cols: 4 },
  bonnet: { rows: 3, cols: 3 },
  roof: { rows: 3, cols: 2 },
  bootLid: { rows: 2, cols: 3 },
  leftFrontGuard: { rows: 3, cols: 1 },
  rightFrontGuard: { rows: 3, cols: 1 },
  leftFrontDoor: { rows: 3, cols: 1 },
  rightFrontDoor: { rows: 3, cols: 1 },
  leftRearDoor: { rows: 2, cols: 1 },
  rightRearDoor: { rows: 2, cols: 1 },
  leftRearQuarter: { rows: 3, cols: 1 },
  rightRearQuarter: { rows: 3, cols: 1 },
  rearBumper: { rows: 1, cols: 4 },
};

function buildGridCells() {
  return BUYER_BODY_MAP_PANEL_AREAS.flatMap((panel) => {
    const layout = PANEL_GRID_LAYOUTS[panel.key];
    const cellWidth = panel.width / layout.cols;
    const cellHeight = panel.height / layout.rows;

    return Array.from({ length: layout.rows * layout.cols }, (_, index) => {
      const row = Math.floor(index / layout.cols);
      const col = index % layout.cols;
      const code = `${String.fromCharCode(65 + row)}${col + 1}`;
      const x = panel.x + (cellWidth * col);
      const y = panel.y + (cellHeight * row);
      return {
        id: `${panel.key}-${code.toLowerCase()}`,
        panelKey: panel.key,
        panelLabel: VEHICLE_BODY_PANEL_LABELS[panel.key],
        row,
        col,
        code,
        x,
        y,
        width: cellWidth,
        height: cellHeight,
        markerX: x + (cellWidth / 2),
        markerY: y + (cellHeight / 2),
      } satisfies VehicleBodyDamageGridCell;
    });
  });
}

export const VEHICLE_BODY_DAMAGE_GRID_CELLS = buildGridCells();

const VEHICLE_BODY_DAMAGE_GRID_CELL_MAP = new Map(
  VEHICLE_BODY_DAMAGE_GRID_CELLS.map((cell) => [cell.id, cell] as const)
);

export function getVehicleBodyDamageGridCell(gridCellId?: string | null) {
  if (!gridCellId) return null;
  return VEHICLE_BODY_DAMAGE_GRID_CELL_MAP.get(gridCellId) ?? null;
}

export function formatVehicleBodyDamageGridCellLabel(gridCellId?: string | null) {
  const cell = getVehicleBodyDamageGridCell(gridCellId);
  if (!cell) return "Unlinked grid area";
  return `${cell.panelLabel} · ${cell.code}`;
}
