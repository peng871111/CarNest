import { sortVehicleServiceHistoryRecords } from "@/lib/vehicle-service-history";
import type { Vehicle, VehiclePublicReportSummary } from "@/types";

type BuyerFacingConditionInput =
  | {
      reportAvailable?: boolean;
      vehicleReportAvailable?: boolean;
      vehicleReportSummary?: VehiclePublicReportSummary | null;
    }
  | VehiclePublicReportSummary
  | null
  | undefined;

function isBuyerFacingConditionContainer(
  input: Exclude<BuyerFacingConditionInput, null | undefined>
): input is {
  reportAvailable?: boolean;
  vehicleReportAvailable?: boolean;
  vehicleReportSummary?: VehiclePublicReportSummary | null;
} {
  return "vehicleReportSummary" in input || "vehicleReportAvailable" in input || "reportAvailable" in input;
}

export function getBuyerFacingConditionScores(reportSummary?: VehiclePublicReportSummary | null) {
  return {
    exterior: reportSummary?.conditionCategories?.exteriorBody?.score || "",
    interior: reportSummary?.conditionCategories?.interiorCondition?.score || ""
  };
}

export function hasBuyerFacingConditionSummary(input: BuyerFacingConditionInput) {
  if (!input) return false;

  let reportSummary: VehiclePublicReportSummary | null | undefined;
  let reportAvailable = true;

  if (isBuyerFacingConditionContainer(input)) {
    reportSummary = input.vehicleReportSummary;
    reportAvailable = input.reportAvailable !== false && input.vehicleReportAvailable !== false;
  } else {
    reportSummary = input;
  }

  const scores = getBuyerFacingConditionScores(reportSummary);

  return Boolean(reportAvailable && scores.exterior.trim() && scores.interior.trim());
}

export function formatBuyerFacingConditionScore(score?: string | null) {
  const numeric = Number(score || "");
  if (!Number.isFinite(numeric)) return "Pending";
  return `${Math.round((numeric / 5) * 100)} / 100`;
}

export function buildBuyerFacingInspectorNotes(reportSummary?: VehiclePublicReportSummary | null) {
  if (!reportSummary) {
    return "No inspector notes recorded.";
  }

  const notes = [
    reportSummary.exteriorCondition ? `Exterior: ${reportSummary.exteriorCondition}` : "",
    reportSummary.interiorCondition ? `Interior: ${reportSummary.interiorCondition}` : "",
    reportSummary.panelRepairNotes ? `Panel repair: ${reportSummary.panelRepairNotes}` : "",
    reportSummary.wheelCondition ? `Wheel condition: ${reportSummary.wheelCondition}` : "",
    reportSummary.damageConditionNotes ? `Damage notes: ${reportSummary.damageConditionNotes}` : ""
  ].filter(Boolean);

  return notes.length ? notes.join(" | ") : "No inspector notes recorded.";
}

export function getBuyerFacingServiceHistoryRecords(vehicle: Vehicle) {
  return sortVehicleServiceHistoryRecords(
    vehicle.vehicleReportSummary?.serviceHistoryRecords
    ?? vehicle.serviceHistoryRecords
    ?? []
  );
}

export function getBuyerFacingLegacyServiceHistoryText(vehicle: Vehicle) {
  return (
    vehicle.vehicleReportSummary?.legacyServiceHistoryText
    || vehicle.serviceHistory
    || ""
  ).trim();
}

export function buildBuyerFacingAdditionalChecks(vehicle: Vehicle) {
  const summary = vehicle.vehicleReportSummary;
  const hasServiceHistory = getBuyerFacingServiceHistoryRecords(vehicle).length || getBuyerFacingLegacyServiceHistoryText(vehicle);

  return [
    { label: "PPSR", value: summary?.ppsrStatus || "Not recorded" },
    { label: "WOVR", value: summary?.accidentDeclaration || "Not recorded" },
    { label: "Recall Check", value: "Not recorded" },
    { label: "Service Book", value: hasServiceHistory ? "Recorded" : "Not recorded" },
    { label: "Spare Key", value: summary?.keyCondition || vehicle.keyCount || "Not recorded" },
    { label: "Compliance Plate", value: summary?.ownershipVerificationStatus || "Not recorded" }
  ];
}
