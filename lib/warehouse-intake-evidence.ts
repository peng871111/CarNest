type WarehouseIntakeEvidenceInput = {
  status?: unknown;
  vehicleId?: unknown;
  listingId?: unknown;
  publicListingId?: unknown;
  linkedListingId?: unknown;
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

export function isWarehouseIntakeLinkedToListing(intake: WarehouseIntakeEvidenceInput) {
  return (
    hasMeaningfulEvidenceValue(intake.vehicleId)
    || hasMeaningfulEvidenceValue(intake.listingId)
    || hasMeaningfulEvidenceValue(intake.publicListingId)
    || hasMeaningfulEvidenceValue(intake.linkedListingId)
  );
}

export function canDeleteWarehouseIntakePhotos(intake: WarehouseIntakeEvidenceInput) {
  return !isWarehouseIntakeLinkedToListing(intake);
}

export function canDeleteWarehouseIntakeDraftRecord(intake: WarehouseIntakeEvidenceInput) {
  return intake.status === "draft" && !isWarehouseIntakeEvidenceLocked(intake);
}
