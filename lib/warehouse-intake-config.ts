export const WAREHOUSE_INTAKE_STEPS = [
  "Customer profile",
  "Vehicle record",
  "Documentation",
  "Agreement",
  "Signature",
  "Complete"
] as const;

export const WAREHOUSE_DECLARATION_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Unknown" }
] as const;

export const WAREHOUSE_CONTACT_METHOD_OPTIONS = [
  { value: "either", label: "Either phone or email" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "wechat", label: "WeChat" },
  { value: "other", label: "Other" }
] as const;

export const WAREHOUSE_IDENTIFICATION_OPTIONS = [
  { value: "", label: "No ID recorded" },
  { value: "driver_licence", label: "Driver licence" },
  { value: "passport", label: "Passport" },
  { value: "other", label: "Other ID" }
] as const;

export const WAREHOUSE_DOCUMENTATION_OPTIONS = [
  { value: "documented", label: "Documentation captured" },
  { value: "not_checked", label: "Not checked" }
] as const;

export const WAREHOUSE_CONDITION_SECTIONS = {
  exterior: [
    { key: "frontExterior", label: "Front exterior documentation" },
    { key: "rearExterior", label: "Rear exterior documentation" },
    { key: "leftSide", label: "Left-side documentation" },
    { key: "rightSide", label: "Right-side documentation" },
    { key: "wheels", label: "Wheels / wheel rash documentation" },
    { key: "visibleDefects", label: "Visible defects / scratches / dents" }
  ],
  interior: [
    { key: "interiorGeneral", label: "Interior general documentation" },
    { key: "seatsTrimMarks", label: "Seats / trim marks" },
    { key: "dashboardConsole", label: "Dashboard / console notes" },
    { key: "odometerPhoto", label: "Odometer documentation" }
  ],
  mechanical: [
    { key: "vinPhoto", label: "VIN plate documentation" },
    { key: "storageTransportNotes", label: "Storage / transport notes" },
    { key: "inspectionReadinessNotes", label: "Inspection readiness notes" }
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
  "CarNest is not acting as a dealer, broker, insurer, or party to the sale.",
  "CarNest does not handle buyer or seller funds, and all vehicle transactions remain between buyer and seller.",
  "The owner remains responsible for legal ownership, the accuracy of all declarations, and maintaining valid comprehensive insurance while the vehicle is in warehouse-managed service.",
  "CarNest may assist with storage, presentation, listing support, inspection coordination, and operational administration only.",
  "Vehicle condition is documented through the attached intake notes and photos for evidentiary purposes only, not valuation."
] as const;
