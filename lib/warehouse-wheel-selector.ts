import type { VehicleWheelPosition, WarehouseVehicleWheelDamageRecord } from "@/types";

export type WarehouseWheelSelectorStatus = "original" | "damage_recorded" | "repaired";

export const WAREHOUSE_WHEEL_POSITION_SHORT_LABELS: Record<VehicleWheelPosition, string> = {
  "front-left": "FL",
  "front-right": "FR",
  "rear-left": "RL",
  "rear-right": "RR",
};

export const WAREHOUSE_WHEEL_SELECTOR_STATUS_LABELS: Record<WarehouseWheelSelectorStatus, string> = {
  original: "Original",
  damage_recorded: "Damage recorded",
  repaired: "Repaired",
};

export function getWarehouseWheelSelectorStatus(
  records: WarehouseVehicleWheelDamageRecord[],
  position: VehicleWheelPosition
): WarehouseWheelSelectorStatus {
  const recordedDamage = records.filter((record) => (
    record.wheelPosition === position && record.damageType !== "original"
  ));

  if (!recordedDamage.length) return "original";

  return recordedDamage.every((record) => (
    record.damageType === "repaired_damage" || record.repairStatus === "verified"
  ))
    ? "repaired"
    : "damage_recorded";
}
