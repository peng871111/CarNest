import { DealerLicenceVerificationStatus } from "@/types";

export type DealerLicenceVerificationResult =
  | {
      ok: true;
      status: DealerLicenceVerificationStatus;
      source: string;
      note?: string;
      checkedAt: string;
    }
  | {
      ok: false;
      status: "failed";
      source: string;
      note?: string;
      checkedAt: string;
    };

function buildCheckedAt() {
  return new Date().toISOString();
}

function normalizeState(state: string) {
  return state.trim().toUpperCase();
}

function normalizeLicenceNumber(licenceNumber: string) {
  return licenceNumber.trim();
}

export async function verifyVicDealerLicence(licenceNumber: string, businessName?: string): Promise<DealerLicenceVerificationResult> {
  const normalizedLicenceNumber = normalizeLicenceNumber(licenceNumber);

  // TODO: Replace this stub with an official VIC LMCT verification provider when available.
  // We intentionally do not fake successful verification here. Callers should treat this as
  // an automatic-verification failure and route the application into strict manual review.
  return {
    ok: false,
    status: "failed",
    source: "vic_stub_provider",
    note: normalizedLicenceNumber || businessName
      ? "Automatic VIC dealer licence verification provider is not yet configured."
      : "Enter an LMCT / dealer licence number to verify.",
    checkedAt: buildCheckedAt()
  };
}

export async function verifyNswDealerLicence(licenceNumber: string, businessName?: string): Promise<DealerLicenceVerificationResult> {
  const normalizedLicenceNumber = normalizeLicenceNumber(licenceNumber);

  // TODO: Replace this stub with an official NSW dealer licence verification provider when available.
  // We intentionally do not fake successful verification here. Callers should treat this as
  // an automatic-verification failure and route the application into strict manual review.
  return {
    ok: false,
    status: "failed",
    source: "nsw_stub_provider",
    note: normalizedLicenceNumber || businessName
      ? "Automatic NSW dealer licence verification provider is not yet configured."
      : "Enter an LMCT / dealer licence number to verify.",
    checkedAt: buildCheckedAt()
  };
}

function buildUnsupportedStateManualReviewResult(state: string): DealerLicenceVerificationResult {
  return {
    ok: true,
    status: "manual_review_required",
    source: "manual_review_fallback",
    note: `Automatic licence verification is not yet available for ${state}. Your application will be manually reviewed.`,
    checkedAt: buildCheckedAt()
  };
}

export async function verifyDealerLicenceByState(state: string, licenceNumber: string, businessName?: string) {
  const normalizedState = normalizeState(state);

  if (normalizedState === "VIC") {
    return verifyVicDealerLicence(licenceNumber, businessName);
  }

  if (normalizedState === "NSW") {
    return verifyNswDealerLicence(licenceNumber, businessName);
  }

  return buildUnsupportedStateManualReviewResult(normalizedState || "the selected state");
}
