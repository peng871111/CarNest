export const WAREHOUSE_INTAKE_STEPS = [
  "Select listing",
  "Owner details",
  "Vehicle details",
  "Declarations",
  "Condition report",
  "Photos",
  "Agreement",
  "Signature",
  "Complete"
] as const;

export const WAREHOUSE_DECLARATION_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Unknown" }
] as const;

export const WAREHOUSE_CONDITION_OPTIONS = [
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
  { value: "damaged", label: "Damaged" },
  { value: "not_checked", label: "Not checked" }
] as const;

export const WAREHOUSE_CONDITION_SECTIONS = {
  exterior: [
    { key: "frontBumper", label: "Front bumper" },
    { key: "rearBumper", label: "Rear bumper" },
    { key: "bonnet", label: "Bonnet" },
    { key: "roof", label: "Roof" },
    { key: "leftSide", label: "Left side" },
    { key: "rightSide", label: "Right side" },
    { key: "wheels", label: "Wheels" },
    { key: "scratches", label: "Scratches" },
    { key: "dents", label: "Dents" },
    { key: "paintCondition", label: "Paint condition" }
  ],
  interior: [
    { key: "seats", label: "Seats" },
    { key: "dashboard", label: "Dashboard" },
    { key: "steeringWheel", label: "Steering wheel" },
    { key: "infotainment", label: "Infotainment" },
    { key: "warningLights", label: "Warning lights" },
    { key: "odourSmoking", label: "Odour / smoking" },
    { key: "cleanliness", label: "Cleanliness" }
  ],
  mechanical: [
    { key: "startsNormally", label: "Starts normally" },
    { key: "batteryCondition", label: "Battery condition" },
    { key: "tyreCondition", label: "Tyre condition" },
    { key: "unusualNoises", label: "Unusual noises" },
    { key: "leaksObserved", label: "Leaks observed" }
  ]
} as const;

export const WAREHOUSE_PHOTO_SECTIONS = [
  { key: "frontExterior", label: "Front exterior", multiple: false },
  { key: "rearExterior", label: "Rear exterior", multiple: false },
  { key: "leftSide", label: "Left side", multiple: false },
  { key: "rightSide", label: "Right side", multiple: false },
  { key: "wheels", label: "Wheels", multiple: true },
  { key: "interior", label: "Interior", multiple: true },
  { key: "odometer", label: "Odometer", multiple: false },
  { key: "vinPlate", label: "VIN plate", multiple: false },
  { key: "damagePhotos", label: "Damage photos", multiple: true },
  { key: "extraPhotos", label: "Extra photos", multiple: true }
] as const;

export const CARNEST_CONCIERGE_AGREEMENT_COPY = [
  "CarNest acts solely as a storage and operational service provider.",
  "CarNest is not acting as a dealer, broker, or consignment agent.",
  "Vehicle transactions remain between buyer and seller.",
  "CarNest may assist with vehicle storage, presentation, inspection coordination, listing support, and operational assistance.",
  "The owner remains responsible for the accuracy of all declarations and for all sale decisions."
] as const;
