"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { DealerLicenceVerificationResult, verifyDealerLicenceByState } from "@/lib/dealer-licence-verification";
import { isValidAustralianMobileNumber, isValidEmailAddress } from "@/lib/form-safety";
import { submitDealerApplication } from "@/lib/data";
import { uploadDealerProof } from "@/lib/storage";

const AUSTRALIAN_STATE_OPTIONS = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"];
const DEALER_ACCOUNT_NOTE = "Dealer accounts require manual verification before activation.";
const DEALER_ACCOUNT_TIMELINE_NOTE = "Verification usually takes 7–14 days after required documents are submitted.";
const DEALER_PROOF_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

type DealerApplicationFormValues = {
  legalBusinessName: string;
  tradingName: string;
  abn: string;
  acn: string;
  lmctNumber: string;
  contactPersonName: string;
  contactPhone: string;
  contactEmail: string;
  businessAddressLine1: string;
  businessSuburb: string;
  businessPostcode: string;
  businessState: string;
  licenceState: string;
  licenceExpiry: string;
};

type DealerApplicationFieldErrorKey = keyof DealerApplicationFormValues | "abnAcn" | "lmctProofUpload";

const EMPTY_VALUES: DealerApplicationFormValues = {
  legalBusinessName: "",
  tradingName: "",
  abn: "",
  acn: "",
  lmctNumber: "",
  contactPersonName: "",
  contactPhone: "",
  contactEmail: "",
  businessAddressLine1: "",
  businessSuburb: "",
  businessPostcode: "",
  businessState: "",
  licenceState: "",
  licenceExpiry: ""
};

function sanitizeDigits(value: string, maxLength?: number) {
  const digits = value.replace(/\D/g, "");
  return typeof maxLength === "number" ? digits.slice(0, maxLength) : digits;
}

function normalizeDealerApplicationValues(values: DealerApplicationFormValues): DealerApplicationFormValues {
  return {
    legalBusinessName: values.legalBusinessName.trim(),
    tradingName: values.tradingName.trim(),
    abn: sanitizeDigits(values.abn, 11),
    acn: sanitizeDigits(values.acn, 9),
    lmctNumber: values.lmctNumber.trim(),
    contactPersonName: values.contactPersonName.trim(),
    contactPhone: sanitizeDigits(values.contactPhone, 10),
    contactEmail: values.contactEmail.trim().toLowerCase(),
    businessAddressLine1: values.businessAddressLine1.trim(),
    businessSuburb: values.businessSuburb.trim(),
    businessPostcode: sanitizeDigits(values.businessPostcode, 4),
    businessState: values.businessState.trim().toUpperCase(),
    licenceState: values.licenceState.trim().toUpperCase(),
    licenceExpiry: values.licenceExpiry.trim()
  };
}

function isFutureDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const expiry = new Date(`${value}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expiry.getTime() > today.getTime();
}

function validateDealerApplicationForm(values: DealerApplicationFormValues, file: File | null) {
  const normalized = normalizeDealerApplicationValues(values);
  const errors: Partial<Record<DealerApplicationFieldErrorKey, string>> = {};

  if (!normalized.legalBusinessName) errors.legalBusinessName = "Enter the legal business name.";
  if (!normalized.lmctNumber) errors.lmctNumber = "Enter the LMCT number.";
  if (!normalized.contactPersonName) errors.contactPersonName = "Enter the contact person name.";
  if (!normalized.businessAddressLine1) errors.businessAddressLine1 = "Enter the business address.";
  if (!normalized.businessSuburb) errors.businessSuburb = "Enter the business suburb.";
  if (!/^\d{4}$/.test(normalized.businessPostcode)) errors.businessPostcode = "Please enter a valid 4-digit Australian postcode";
  if (!normalized.businessState) errors.businessState = "Select the business state.";
  if (!normalized.licenceState) errors.licenceState = "Select the licence state.";
  if (!normalized.licenceExpiry) {
    errors.licenceExpiry = "Enter the licence expiry date.";
  } else if (!isFutureDate(normalized.licenceExpiry)) {
    errors.licenceExpiry = "Licence expiry must be a future date.";
  }

  if (!normalized.abn && !normalized.acn) {
    errors.abnAcn = "Enter an ABN or ACN before submitting.";
  } else {
    if (normalized.abn && !/^\d{11}$/.test(normalized.abn)) errors.abn = "ABN must be 11 digits.";
    if (normalized.acn && !/^\d{9}$/.test(normalized.acn)) errors.acn = "ACN must be 9 digits.";
  }

  if (!isValidAustralianMobileNumber(normalized.contactPhone)) {
    errors.contactPhone = "Please enter a valid Australian mobile number (e.g. 0412345678)";
  }

  if (!isValidEmailAddress(normalized.contactEmail)) {
    errors.contactEmail = "Please enter a valid email address.";
  }

  if (!file) {
    errors.lmctProofUpload = "Upload the LMCT proof document before submitting.";
  }

  return { normalized, errors };
}

function getFieldClassName(hasError: boolean) {
  return hasError ? "border-red-500 focus:border-red-500" : "";
}

export function DealerApplicationForm() {
  const router = useRouter();
  const { appUser, firebaseUser, loading: authLoading } = useAuth();
  const [values, setValues] = useState<DealerApplicationFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Partial<Record<DealerApplicationFieldErrorKey, string>>>({});
  const [licenceVerificationResult, setLicenceVerificationResult] = useState<DealerLicenceVerificationResult | null>(null);
  const [verifyingLicence, setVerifyingLicence] = useState(false);
  const [selectedProofFile, setSelectedProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!appUser) return;

    setValues((current) => ({
      ...current,
      contactPersonName: current.contactPersonName || appUser.displayName || appUser.name || "",
      contactEmail: current.contactEmail || appUser.email || ""
    }));
  }, [appUser]);

  const minimumLicenceDate = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  }, []);

  function setFieldValue<K extends keyof DealerApplicationFormValues>(field: K, value: DealerApplicationFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({
      ...current,
      [field]: "",
      ...(field === "abn" || field === "acn" ? { abnAcn: "" } : {}),
      ...(field === "lmctNumber" || field === "licenceState" ? { lmctNumber: "" } : {})
    }));
    if (field === "legalBusinessName" || field === "licenceState" || field === "lmctNumber") {
      setLicenceVerificationResult(null);
    }
    setSubmitError("");
  }

  function handlePhoneChange(event: ChangeEvent<HTMLInputElement>) {
    setFieldValue("contactPhone", sanitizeDigits(event.target.value, 10));
  }

  function handlePostcodeChange(event: ChangeEvent<HTMLInputElement>) {
    setFieldValue("businessPostcode", sanitizeDigits(event.target.value, 4));
  }

  function handleAbnChange(event: ChangeEvent<HTMLInputElement>) {
    setFieldValue("abn", sanitizeDigits(event.target.value, 11));
  }

  function handleAcnChange(event: ChangeEvent<HTMLInputElement>) {
    setFieldValue("acn", sanitizeDigits(event.target.value, 9));
  }

  function handleProofChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedProofFile(file);
    setErrors((current) => ({ ...current, lmctProofUpload: "" }));
    setSubmitError("");
  }

  function renderError(field: DealerApplicationFieldErrorKey) {
    const message = errors[field];
    return message ? <p className="mt-2 text-sm text-red-600">{message}</p> : null;
  }

  function getUnsupportedStateHint(currentValues = values) {
    const normalizedState = currentValues.licenceState.trim().toUpperCase();
    if (!normalizedState || normalizedState === "VIC" || normalizedState === "NSW") return "";
    return "Automatic licence verification is not yet available for this state. Your application will be manually reviewed.";
  }

  async function runLicenceVerification(currentValues = values, options?: { force?: boolean }) {
    const normalized = normalizeDealerApplicationValues(currentValues);
    if (!normalized.licenceState || !normalized.lmctNumber) {
      return null;
    }

    if (!options?.force && licenceVerificationResult) {
      return licenceVerificationResult;
    }

    setVerifyingLicence(true);
    setSubmitError("");

    try {
      const result = await verifyDealerLicenceByState(normalized.licenceState, normalized.lmctNumber, normalized.legalBusinessName);
      setLicenceVerificationResult(result);
      setErrors((current) => ({
        ...current,
        lmctNumber: result.ok ? "" : "LMCT / dealer licence number could not be verified for the selected state."
      }));
      return result;
    } finally {
      setVerifyingLicence(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");

    if (!appUser) {
      setSubmitError("Sign in to apply for a dealer account.");
      return;
    }

    if (!firebaseUser) {
      setSubmitError("Sign in to apply for a dealer account.");
      return;
    }

    const { normalized, errors } = validateDealerApplicationForm(values, selectedProofFile);
    if (Object.values(errors).some(Boolean)) {
      setErrors(errors);
      return;
    }

    setSubmitting(true);

    try {
      await firebaseUser.reload();
      if (!firebaseUser.emailVerified) {
        throw new Error("Verify your email address before submitting a dealer application.");
      }

      const verificationResult = await runLicenceVerification(normalized, { force: true });
      if (!verificationResult) {
        setErrors((current) => ({ ...current, lmctNumber: "Enter the LMCT number." }));
        return;
      }

      const proofFile = selectedProofFile;
      if (!proofFile) {
        throw new Error("Upload the LMCT proof document before submitting.");
      }

      const proofUrl = await uploadDealerProof(proofFile, appUser.id);

      await submitDealerApplication(
        {
          ...normalized,
          licenceVerificationStatus: verificationResult.ok ? verificationResult.status : "auto_failed",
          licenceVerificationNote: verificationResult.note,
          licenceVerificationSource: verificationResult.source,
          lmctProofUploadUrl: proofUrl,
          lmctProofUploadName: proofFile.name,
          lmctProofUploadContentType: proofFile.type
        },
        appUser
      );

      router.replace("/dealer/application-status?submitted=success");
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to submit the dealer application.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return <p className="text-sm text-ink/60">Loading your dealer application details...</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="rounded-[24px] border border-black/5 bg-shell px-5 py-4 text-sm leading-6 text-ink/65">
        <p>{DEALER_ACCOUNT_NOTE}</p>
        <p className="mt-1">{DEALER_ACCOUNT_TIMELINE_NOTE}</p>
        {!firebaseUser?.emailVerified ? <p className="mt-2 text-red-600">Verify your email address before submitting this application.</p> : null}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-ink">Legal business name</label>
          <Input
            value={values.legalBusinessName}
            onChange={(event) => setFieldValue("legalBusinessName", event.target.value)}
            className={`mt-2 ${getFieldClassName(Boolean(errors.legalBusinessName))}`}
            placeholder="Legal business name"
          />
          {renderError("legalBusinessName")}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">Trading name</label>
          <Input
            value={values.tradingName}
            onChange={(event) => setFieldValue("tradingName", event.target.value)}
            className="mt-2"
            placeholder="Trading name (optional)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">ABN</label>
          <Input
            inputMode="numeric"
            value={values.abn}
            onChange={handleAbnChange}
            className={`mt-2 ${getFieldClassName(Boolean(errors.abn) || Boolean(errors.abnAcn))}`}
            placeholder="11-digit ABN"
          />
          {renderError("abn")}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">ACN</label>
          <Input
            inputMode="numeric"
            value={values.acn}
            onChange={handleAcnChange}
            className={`mt-2 ${getFieldClassName(Boolean(errors.acn) || Boolean(errors.abnAcn))}`}
            placeholder="9-digit ACN"
          />
          {renderError("acn")}
          {!errors.acn ? renderError("abnAcn") : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">LMCT number</label>
          <Input
            value={values.lmctNumber}
            onChange={(event) => setFieldValue("lmctNumber", event.target.value)}
            onBlur={() => {
              void runLicenceVerification();
            }}
            className={`mt-2 ${getFieldClassName(Boolean(errors.lmctNumber))}`}
            placeholder="LMCT number"
          />
          {renderError("lmctNumber")}
          {!errors.lmctNumber && verifyingLicence ? <p className="mt-2 text-sm text-bronze">Verifying dealer licence...</p> : null}
          {!errors.lmctNumber && !verifyingLicence && licenceVerificationResult?.ok && licenceVerificationResult.status === "verified" ? (
            <p className="mt-2 text-sm text-emerald-700">Dealer licence verified for the selected state.</p>
          ) : null}
          {!errors.lmctNumber && !verifyingLicence && (licenceVerificationResult?.note || getUnsupportedStateHint()) ? (
            <p className={`mt-2 text-sm ${licenceVerificationResult?.ok ? "text-ink/65" : "text-red-600"}`}>
              {licenceVerificationResult?.note ?? getUnsupportedStateHint()}
            </p>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">Contact person</label>
          <Input
            value={values.contactPersonName}
            onChange={(event) => setFieldValue("contactPersonName", event.target.value)}
            className={`mt-2 ${getFieldClassName(Boolean(errors.contactPersonName))}`}
            placeholder="Contact person"
          />
          {renderError("contactPersonName")}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">Contact phone</label>
          <Input
            inputMode="numeric"
            value={values.contactPhone}
            onChange={handlePhoneChange}
            className={`mt-2 ${getFieldClassName(Boolean(errors.contactPhone))}`}
            placeholder="e.g. 0412345678"
          />
          {renderError("contactPhone")}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">Contact email</label>
          <Input
            type="email"
            value={values.contactEmail}
            onChange={(event) => setFieldValue("contactEmail", event.target.value)}
            className={`mt-2 ${getFieldClassName(Boolean(errors.contactEmail))}`}
            placeholder="Contact email"
          />
          {renderError("contactEmail")}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-ink">Business address</label>
          <Input
            value={values.businessAddressLine1}
            onChange={(event) => setFieldValue("businessAddressLine1", event.target.value)}
            className={`mt-2 ${getFieldClassName(Boolean(errors.businessAddressLine1))}`}
            placeholder="Street address"
          />
          {renderError("businessAddressLine1")}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">Business suburb</label>
          <Input
            value={values.businessSuburb}
            onChange={(event) => setFieldValue("businessSuburb", event.target.value)}
            className={`mt-2 ${getFieldClassName(Boolean(errors.businessSuburb))}`}
            placeholder="Business suburb"
          />
          {renderError("businessSuburb")}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">Business postcode</label>
          <Input
            inputMode="numeric"
            value={values.businessPostcode}
            onChange={handlePostcodeChange}
            className={`mt-2 ${getFieldClassName(Boolean(errors.businessPostcode))}`}
            placeholder="4-digit postcode"
          />
          {renderError("businessPostcode")}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">Business state</label>
          <select
            value={values.businessState}
            onChange={(event) => setFieldValue("businessState", event.target.value)}
            className={`mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm uppercase text-ink outline-none transition focus:border-bronze ${getFieldClassName(Boolean(errors.businessState))}`}
          >
            <option value="">Select state</option>
            {AUSTRALIAN_STATE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {renderError("businessState")}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">Licence state</label>
          <select
            value={values.licenceState}
            onChange={(event) => setFieldValue("licenceState", event.target.value)}
            onBlur={() => {
              void runLicenceVerification();
            }}
            className={`mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm uppercase text-ink outline-none transition focus:border-bronze ${getFieldClassName(Boolean(errors.licenceState))}`}
          >
            <option value="">Select state</option>
            {AUSTRALIAN_STATE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {renderError("licenceState")}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">Licence expiry</label>
          <Input
            type="date"
            min={minimumLicenceDate}
            value={values.licenceExpiry}
            onChange={(event) => setFieldValue("licenceExpiry", event.target.value)}
            className={`mt-2 ${getFieldClassName(Boolean(errors.licenceExpiry))}`}
          />
          {renderError("licenceExpiry")}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">LMCT proof upload</label>
          <input
            type="file"
            accept={DEALER_PROOF_ACCEPT}
            onChange={handleProofChange}
            className={`mt-2 block w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink file:mr-4 file:rounded-full file:border-0 file:bg-shell file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink ${getFieldClassName(Boolean(errors.lmctProofUpload))}`}
          />
          <p className="mt-2 text-sm text-ink/55">Accepted formats: PDF, JPG, JPEG, PNG.</p>
          {selectedProofFile ? <p className="mt-2 text-sm text-ink/65">{selectedProofFile.name}</p> : null}
          {renderError("lmctProofUpload")}
        </div>
      </div>

      {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={submitting || verifyingLicence}>
          {verifyingLicence ? "Verifying..." : submitting ? "Submitting..." : "Submit dealer application"}
        </Button>
        <Button type="button" className="border border-black/10 bg-white text-ink hover:bg-shell" onClick={() => router.push("/dealer/application-status")}>
          View application status
        </Button>
      </div>
    </form>
  );
}
