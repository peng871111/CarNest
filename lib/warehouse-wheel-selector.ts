import type { VehicleWheelPosition, WarehouseVehicleWheelDamageRecord } from "@/types";

export type WarehouseWheelSelectorStatus = "original" | "damage_recorded" | "mixed_condition" | "repaired";

export const WAREHOUSE_WHEEL_POSITION_SHORT_LABELS: Record<VehicleWheelPosition, string> = {
  "front-left": "FL",
  "front-right": "FR",
  "rear-left": "RL",
  "rear-right": "RR",
};

export const WAREHOUSE_WHEEL_SELECTOR_STATUS_LABELS: Record<WarehouseWheelSelectorStatus, string> = {
  original: "Original",
  damage_recorded: "Damage recorded",
  mixed_condition: "Mixed condition",
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

  const hasRepairedDamage = recordedDamage.some((record) => (
    record.damageType === "repaired_damage" || record.repairStatus === "verified"
  ));
  const hasUnresolvedDamage = recordedDamage.some((record) => (
    record.damageType !== "repaired_damage" && record.repairStatus !== "verified"
  ));

  if (hasRepairedDamage && hasUnresolvedDamage) return "mixed_condition";
  return hasRepairedDamage ? "repaired" : "damage_recorded";
}
