type WarehouseIntakeEvidenceInput = {
  status?: unknown;
  signedPdfStoragePath?: unknown;
  signedPdfFileName?: unknown;
  pdfGeneratedAt?: unknown;
  vehicleReportPdfStoragePath?: unknown;
  vehicleReportPdfFileName?: unknown;
  vehicleReportGeneratedAt?: unknown;
  completedAt?: unknown;
  emailSentAt?: unknown;
};

function hasMeaningfulEvidenceValue(value: unknown) {
  if (typeof value === "string") return Boolean(value.trim());
  if (value === null || typeof value === "undefined") return false;
  return Boolean(value);
}

export function isWarehouseIntakeEvidenceLocked(intake: WarehouseIntakeEvidenceInput) {
  const status = typeof intake.status === "string" ? intake.status.toLowerCase() : "";
  const lockedStatuses = new Set(["signed", "completed", "complete", "finalised", "finalized", "archived"]);

  return (
    lockedStatuses.has(status)
    || hasMeaningfulEvidenceValue(intake.signedPdfStoragePath)
    || hasMeaningfulEvidenceValue(intake.signedPdfFileName)
    || hasMeaningfulEvidenceValue(intake.pdfGeneratedAt)
    || hasMeaningfulEvidenceValue(intake.vehicleReportPdfStoragePath)
    || hasMeaningfulEvidenceValue(intake.vehicleReportPdfFileName)
    || hasMeaningfulEvidenceValue(intake.vehicleReportGeneratedAt)
    || hasMeaningfulEvidenceValue(intake.completedAt)
    || hasMeaningfulEvidenceValue(intake.emailSentAt)
  );
}

export function canDeleteWarehouseIntakePhotos(intake: WarehouseIntakeEvidenceInput) {
  const status = typeof intake.status === "string" ? intake.status : "";
  return (status === "draft" || status === "review_ready") && !isWarehouseIntakeEvidenceLocked(intake);
}

export function canDeleteWarehouseIntakeDraftRecord(intake: WarehouseIntakeEvidenceInput) {
  return intake.status === "draft" && !isWarehouseIntakeEvidenceLocked(intake);
}
