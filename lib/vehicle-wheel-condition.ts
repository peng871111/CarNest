import type {
  VehicleWheelDamageType,
  VehicleWheelPosition,
  VehicleWheelZone,
} from "@/types";

export const VEHICLE_WHEEL_POSITIONS = [
  "front-left",
  "front-right",
  "rear-left",
  "rear-right",
] as const satisfies readonly VehicleWheelPosition[];

export const VEHICLE_WHEEL_ZONES = [
  "tyre_sidewall",
  "outer_rim_top",
  "outer_rim_right",
  "outer_rim_bottom",
  "outer_rim_left",
  "inner_rim_top",
  "inner_rim_right",
  "inner_rim_bottom",
  "inner_rim_left",
  "centre",
] as const satisfies readonly VehicleWheelZone[];

export const VEHICLE_WHEEL_DAMAGE_TYPES = [
  "original",
  "scratch",
  "curb_rash",
  "dent_bend",
  "crack",
  "repaired_damage",
] as const satisfies readonly VehicleWheelDamageType[];

export const VEHICLE_WHEEL_POSITION_LABELS: Record<VehicleWheelPosition, string> = {
  "front-left": "Front Left Wheel",
  "front-right": "Front Right Wheel",
  "rear-left": "Rear Left Wheel",
  "rear-right": "Rear Right Wheel",
};

export const VEHICLE_WHEEL_ZONE_LABELS: Record<VehicleWheelZone, string> = {
  tyre_sidewall: "Tyre sidewall",
  outer_rim_top: "Outer rim - top",
  outer_rim_right: "Outer rim - right",
  outer_rim_bottom: "Outer rim - bottom",
  outer_rim_left: "Outer rim - left",
  inner_rim_top: "Inner rim - top",
  inner_rim_right: "Inner rim - right",
  inner_rim_bottom: "Inner rim - bottom",
  inner_rim_left: "Inner rim - left",
  centre: "Centre cap / hub",
};

export const VEHICLE_WHEEL_DAMAGE_TYPE_LABELS: Record<VehicleWheelDamageType, string> = {
  original: "Original",
  scratch: "Scratch",
  curb_rash: "Curb Rash",
  dent_bend: "Dent / Bend",
  crack: "Crack",
  repaired_damage: "Repaired damage",
};

export const VEHICLE_WHEEL_ZONE_MARKERS: Record<VehicleWheelZone, { x: number; y: number }> = {
  tyre_sidewall: { x: 100, y: 18 },
  outer_rim_top: { x: 100, y: 43 },
  outer_rim_right: { x: 157, y: 100 },
  outer_rim_bottom: { x: 100, y: 157 },
  outer_rim_left: { x: 43, y: 100 },
  inner_rim_top: { x: 100, y: 66 },
  inner_rim_right: { x: 134, y: 100 },
  inner_rim_bottom: { x: 100, y: 134 },
  inner_rim_left: { x: 66, y: 100 },
  centre: { x: 100, y: 100 },
};

export function isVehicleWheelPosition(value: unknown): value is VehicleWheelPosition {
  return typeof value === "string" && VEHICLE_WHEEL_POSITIONS.includes(value as VehicleWheelPosition);
}

export function isVehicleWheelZone(value: unknown): value is VehicleWheelZone {
  return typeof value === "string" && VEHICLE_WHEEL_ZONES.includes(value as VehicleWheelZone);
}

export function normalizeVehicleWheelDamageType(value: unknown): VehicleWheelDamageType {
  if (typeof value === "string" && VEHICLE_WHEEL_DAMAGE_TYPES.includes(value as VehicleWheelDamageType)) {
    return value as VehicleWheelDamageType;
  }

  if (value === "dent" || value === "bend") return "dent_bend";
  if (value === "gutter_rash" || value === "kerb_rash") return "curb_rash";
  if (value === "repaint" || value === "previous_repair") return "repaired_damage";
  return "original";
}

export function formatVehicleWheelDamageLocation(position: VehicleWheelPosition, zone: VehicleWheelZone) {
  return `${VEHICLE_WHEEL_POSITION_LABELS[position]} · ${VEHICLE_WHEEL_ZONE_LABELS[zone]}`;
}
