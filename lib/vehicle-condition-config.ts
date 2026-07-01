import type {
  VehicleBodyPanelCondition,
  VehicleBodyPanelKey,
  VehicleConditionCategoryKey,
  VehicleConditionScore,
  VehicleDamageType,
} from "@/types";

export const VEHICLE_CONDITION_SCORE_OPTIONS: VehicleConditionScore[] = [
  "5.0",
  "4.5",
  "4.0",
  "3.5",
  "3.0",
  "2.5"
];

export const VEHICLE_CONDITION_SCORE_SELECT_OPTIONS: Array<{ value: VehicleConditionScore; label: string }> = [
  { value: "5.0", label: "5.0 – Exceptional" },
  { value: "4.5", label: "4.5 – Excellent" },
  { value: "4.0", label: "4.0 – Very Good" },
  { value: "3.5", label: "3.5 – Good" },
  { value: "3.0", label: "3.0 – Fair" },
  { value: "2.5", label: "2.5 – Minimum Standard" }
];

export const VEHICLE_CONDITION_SCORED_CATEGORY_KEYS = [
  "exteriorBody",
  "interiorCondition"
] as const satisfies readonly VehicleConditionCategoryKey[];

export const VEHICLE_CONDITION_NOTES_ONLY_CATEGORY_KEYS = [
  "documentationRecords",
  "mechanicalFunction"
] as const satisfies readonly VehicleConditionCategoryKey[];

export const VEHICLE_CONDITION_CATEGORY_LABELS: Record<VehicleConditionCategoryKey, string> = {
  documentationRecords: "Documentation & Records",
  exteriorBody: "Exterior & Body",
  mechanicalFunction: "Mechanical & Function",
  interiorCondition: "Interior Condition"
};

export const VEHICLE_CONDITION_CATEGORY_HELPERS: Record<VehicleConditionCategoryKey, string> = {
  documentationRecords: "Number of keys, service history, ownership verification, PPSR status, registration status, and RWC availability.",
  exteriorBody: "Paint condition, scratches, dents, repaired or repainted panels, and wheel condition.",
  mechanicalFunction: "Engine operation, transmission, air conditioning, electrical functions, and dashboard warning lights.",
  interiorCondition: "Seat wear, steering wheel wear, carpet condition, roof lining, odours, and general presentation."
};

export const VEHICLE_BODY_PANEL_LABELS: Record<VehicleBodyPanelKey, string> = {
  frontBumper: "Front bumper",
  bonnet: "Bonnet",
  roof: "Roof",
  bootLid: "Boot lid",
  leftFrontGuard: "Left front guard",
  rightFrontGuard: "Right front guard",
  leftFrontDoor: "Left front door",
  rightFrontDoor: "Right front door",
  leftRearDoor: "Left rear door",
  rightRearDoor: "Right rear door",
  leftRearQuarter: "Left rear quarter",
  rightRearQuarter: "Right rear quarter",
  rearBumper: "Rear bumper"
};

export const VEHICLE_BODY_PANEL_ORDER: VehicleBodyPanelKey[] = [
  "frontBumper",
  "leftFrontGuard",
  "bonnet",
  "rightFrontGuard",
  "roof",
  "leftFrontDoor",
  "rightFrontDoor",
  "leftRearDoor",
  "rightRearDoor",
  "leftRearQuarter",
  "bootLid",
  "rightRearQuarter",
  "rearBumper"
];

export const VEHICLE_BODY_PANEL_CONDITION_OPTIONS: Array<{ value: VehicleBodyPanelCondition; label: string }> = [
  { value: "original", label: "Original" },
  { value: "scratch", label: "Scratch" },
  { value: "dent", label: "Dent" },
  { value: "repaint", label: "Repaint" },
  { value: "repaired_damage", label: "Repaired damage" }
];

export const VEHICLE_BODY_PANEL_CONDITION_LABELS: Record<VehicleBodyPanelCondition, string> = {
  original: "Original",
  scratch: "Scratch",
  dent: "Dent",
  repaint: "Repaint",
  repaired_damage: "Repaired damage"
};

export const VEHICLE_DAMAGE_TYPE_OPTIONS: Array<{ value: VehicleDamageType; label: string }> = [
  { value: "scratch", label: "Scratch" },
  { value: "chip", label: "Chip" },
  { value: "rust", label: "Rust" },
  { value: "respray", label: "Respray" },
  { value: "crack", label: "Crack" },
  { value: "small_dent", label: "Small Dent" },
  { value: "large_dent", label: "Large Dent" },
  { value: "previous_repair", label: "Previous" },
  { value: "loose", label: "Loose" },
  { value: "missing", label: "Missing" },
  { value: "other", label: "Other" },
];

export const VEHICLE_DAMAGE_TYPE_LABELS: Record<VehicleDamageType, string> = {
  scratch: "Scratch",
  chip: "Chip",
  rust: "Rust",
  respray: "Respray",
  crack: "Crack",
  small_dent: "Small Dent",
  large_dent: "Large Dent",
  previous_repair: "Previous",
  loose: "Loose",
  missing: "Missing",
  other: "Other",
};
