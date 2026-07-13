"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TurnstileField } from "@/components/forms/turnstile-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import {
  calculateMinimumOfferAmount,
  formatInspectionDateForDisplay,
  isPastInspectionDate,
  isReasonablyValidPhoneNumber,
  isValidEmailAddress,
  normalizeEmailAddress,
  normalizePhoneNumber
} from "@/lib/public-vehicle-action-validation";
import {
  buildSubmissionFingerprint,
  checkAntiSpamGuards,
  checkDuplicateSubmission,
  checkRateLimit,
  rememberSubmission,
  rememberSubmissionEvent,
  validateTurnstileToken
} from "@/lib/form-safety";
import { formatCurrency } from "@/lib/utils";
import { Vehicle } from "@/types";

type ActionTab = "offer" | "inspection";
type OtpStatus = "idle" | "sent" | "verified";

interface ActionFormState {
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  offerAmount: string;
  offerMessage: string;
  preferredDate: string;
  preferredTime: string;
  inspectionMessage: string;
  website: string;
}

interface VerificationState {
  status: OtpStatus;
  sessionId: string;
  verificationToken: string;
  code: string;
  expiresAt: string;
  cooldownUntil: number;
}

type PublicActionResponse = {
  success?: boolean;
  code?: string;
  message?: string;
  sessionId?: string;
  verificationToken?: string;
  expiresAt?: string;
  cooldownSeconds?: number;
  offerId?: string;
  inspectionRequestId?: string;
  duplicate?: boolean;
};

const initialState: ActionFormState = {
  buyerName: "",
  buyerEmail: "",
  buyerPhone: "",
  offerAmount: "",
  offerMessage: "",
  preferredDate: "",
  preferredTime: "",
  inspectionMessage: "",
  website: ""
};

const initialVerificationState: VerificationState = {
  status: "idle",
  sessionId: "",
  verificationToken: "",
  code: "",
  expiresAt: "",
  cooldownUntil: 0
};

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getPublicActionMessage(response: PublicActionResponse, fallback: string) {
  return response.message || fallback;
}

export function TakeActionPanel({ vehicle }: { vehicle: Vehicle }) {
  const { appUser, firebaseUser } = useAuth();
  const searchParams = useSearchParams();
  const canBookInspection = vehicle.listingType === "warehouse";
  const isUnderOffer = vehicle.sellerStatus === "UNDER_OFFER";
  const minimumOffer = calculateMinimumOfferAmount(vehicle.price);
  const [activeTab, setActiveTab] = useState<ActionTab>(canBookInspection && searchParams.get("action") === "inspection" ? "inspection" : "offer");
  const [mobileFormExpanded, setMobileFormExpanded] = useState(() => Boolean(searchParams.get("action")));
  const [form, setForm] = useState<ActionFormState>(initialState);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [verification, setVerification] = useState<VerificationState>(initialVerificationState);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileInstanceKey, setTurnstileInstanceKey] = useState(0);
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);
  const [startedAt] = useState(() => Date.now());
  const [nowMs, setNowMs] = useState(() => Date.now());

  const normalizedEmail = useMemo(() => normalizeEmailAddress(form.buyerEmail), [form.buyerEmail]);
  const accountEmailVerified = Boolean(
    appUser?.emailVerified
    && appUser.email
    && normalizeEmailAddress(appUser.email) === normalizedEmail
  );
  const emailVerifiedForSubmission = accountEmailVerified || verification.status === "verified";
  const verificationLabel = accountEmailVerified
    ? "Email verified from your CarNest account."
    : verification.status === "verified"
      ? "Email verified."
      : verification.status === "sent"
        ? "Code sent. Enter the six-digit code from your email."
        : "Verify your email before submitting.";

  function resetTurnstile() {
    setTurnstileToken("");
    setTurnstileInstanceKey((current) => current + 1);
  }

  function resetVerification() {
    setVerification(initialVerificationState);
  }

  function setField<K extends keyof ActionFormState>(key: K, value: ActionFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
    if (key === "buyerEmail") {
      resetVerification();
    }
  }

  function validateContactFields() {
    const nextErrors: Record<string, string> = {};
    if (!form.buyerName.trim()) nextErrors.buyerName = "Please enter your name.";
    if (!form.buyerEmail.trim()) nextErrors.buyerEmail = "Please enter your email address.";
    else if (!isValidEmailAddress(form.buyerEmail)) nextErrors.buyerEmail = "Please enter a valid email address.";
    if (!form.buyerPhone.trim()) nextErrors.buyerPhone = "Please enter your phone number.";
    else if (!isReasonablyValidPhoneNumber(form.buyerPhone)) nextErrors.buyerPhone = "Please enter a valid phone number.";
    return nextErrors;
  }

  function validateForm() {
    const nextErrors = validateContactFields();

    if (activeTab === "offer") {
      if (!form.offerAmount.trim()) nextErrors.offerAmount = "Please enter your offer amount.";
      else if (!Number(form.offerAmount) || Number(form.offerAmount) <= 0) nextErrors.offerAmount = "Offer amount must be greater than zero.";
      else if (Number(form.offerAmount) < minimumOffer) {
        nextErrors.offerAmount = "This offer is too low. Please enter a higher amount.";
      }
    }

    if (activeTab === "inspection" && canBookInspection) {
      if (!form.preferredDate.trim()) nextErrors.preferredDate = "Please choose a preferred inspection date.";
      else if (isPastInspectionDate(form.preferredDate)) nextErrors.preferredDate = "Please choose a future inspection date.";
      if (!form.preferredTime.trim()) nextErrors.preferredTime = "Please share a preferred inspection time.";
    }

    return nextErrors;
  }

  useEffect(() => {
    setForm((current) => ({
      ...current,
      buyerName: current.buyerName || appUser?.displayName || appUser?.name || "",
      buyerEmail: current.buyerEmail || appUser?.email || "",
      buyerPhone: current.buyerPhone || appUser?.phone || ""
    }));
  }, [appUser?.displayName, appUser?.email, appUser?.name, appUser?.phone]);

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "inspection" && canBookInspection) {
      setActiveTab("inspection");
      setMobileFormExpanded(true);
      return;
    }

    setActiveTab("offer");
    if (action === "offer") {
      setMobileFormExpanded(true);
    }
  }, [canBookInspection, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#take-action-panel") {
      setMobileFormExpanded(true);
    }
  }, []);

  useEffect(() => {
    resetVerification();
  }, [activeTab, vehicle.id]);

  useEffect(() => {
    if (!verification.cooldownUntil || verification.cooldownUntil <= nowMs) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [nowMs, verification.cooldownUntil]);

  async function readPublicActionResponse(response: Response) {
    const payload = await response.json().catch(() => ({})) as PublicActionResponse;
    if (!response.ok || !payload.success) {
      throw new Error(getPublicActionMessage(payload, "Something went wrong. Please try again."));
    }
    return payload;
  }

  async function getAuthToken() {
    return firebaseUser ? await firebaseUser.getIdToken() : "";
  }

  async function sendVerificationCode() {
    setSendingCode(true);
    setError("");
    setSuccess("");

    try {
      const nextErrors = validateContactFields();
      const turnstilePresenceError = validateTurnstileToken(turnstileToken);

      if (Object.keys(nextErrors).length) {
        setFieldErrors(nextErrors);
        throw new Error("Please correct the highlighted fields before requesting a code.");
      }

      if (turnstilePresenceError) {
        throw new Error(turnstilePresenceError);
      }

      const response = await fetch("/api/public/vehicle-actions/verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: "send",
          actionType: activeTab,
          vehicleId: vehicle.id,
          email: form.buyerEmail,
          turnstileToken
        }),
        cache: "no-store"
      });

      const payload = await readPublicActionResponse(response);
      setVerification({
        status: "sent",
        sessionId: payload.sessionId ?? "",
        verificationToken: "",
        code: "",
        expiresAt: payload.expiresAt ?? "",
        cooldownUntil: Date.now() + (payload.cooldownSeconds ?? 60) * 1000
      });
      setSuccess("Verification code sent. Please check your email.");
      resetTurnstile();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Verification email could not be sent. Please try again.");
    } finally {
      setSendingCode(false);
    }
  }

  async function verifyEmailCode() {
    setVerifyingCode(true);
    setError("");
    setSuccess("");

    try {
      if (!verification.sessionId || !verification.code.trim()) {
        throw new Error("Please enter the verification code.");
      }

      const response = await fetch("/api/public/vehicle-actions/verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: "verify",
          actionType: activeTab,
          vehicleId: vehicle.id,
          email: form.buyerEmail,
          sessionId: verification.sessionId,
          code: verification.code
        }),
        cache: "no-store"
      });

      const payload = await readPublicActionResponse(response);
      setVerification((current) => ({
        ...current,
        status: "verified",
        verificationToken: payload.verificationToken ?? "",
        code: ""
      }));
      setSuccess("Email verified.");
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Verification code is incorrect.");
    } finally {
      setVerifyingCode(false);
    }
  }

  async function submitAction() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const nextErrors = validateForm();
      const normalizedPhone = normalizePhoneNumber(form.buyerPhone);
      const protectionKey = `carnest-${activeTab}-submission:${normalizedEmail || "unknown"}:${normalizedPhone || "unknown"}:${vehicle.id}`;
      const duplicateFingerprint =
        activeTab === "offer"
          ? buildSubmissionFingerprint([vehicle.id, form.offerAmount, form.offerMessage, normalizedEmail, normalizedPhone])
          : buildSubmissionFingerprint([vehicle.id, form.preferredDate, form.preferredTime, form.inspectionMessage, normalizedEmail, normalizedPhone]);
      const antiSpamError = checkAntiSpamGuards({
        honeypot: form.website,
        startedAt,
        storageKey: protectionKey
      });
      const localRateLimitError = checkRateLimit({
        storageKey: protectionKey,
        limit: 2,
        windowMs: 30 * 60 * 1000
      });
      const localDailyRateLimitError = checkRateLimit({
        storageKey: protectionKey,
        limit: 3,
        windowMs: 24 * 60 * 60 * 1000
      });
      const duplicateError = checkDuplicateSubmission({
        storageKey: protectionKey,
        fingerprint: duplicateFingerprint,
        windowMs: 15 * 60 * 1000
      });
      const turnstilePresenceError = validateTurnstileToken(turnstileToken);

      if (Object.keys(nextErrors).length) {
        setFieldErrors(nextErrors);
        throw new Error("Please correct the highlighted fields before submitting.");
      }

      if (!emailVerifiedForSubmission) {
        throw new Error(activeTab === "offer" ? "Please verify your email before submitting your offer." : "Please verify your email before requesting an inspection.");
      }

      if (antiSpamError || localRateLimitError || localDailyRateLimitError || duplicateError || turnstilePresenceError) {
        throw new Error(antiSpamError || localRateLimitError || localDailyRateLimitError || duplicateError || turnstilePresenceError);
      }

      const authToken = await getAuthToken();
      const response = await fetch("/api/public/vehicle-actions/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          actionType: activeTab,
          vehicleId: vehicle.id,
          buyerName: form.buyerName,
          buyerEmail: form.buyerEmail,
          buyerPhone: form.buyerPhone,
          ...(activeTab === "offer"
            ? {
                offerAmount: Number(form.offerAmount),
                message: form.offerMessage
              }
            : {
                preferredDate: form.preferredDate,
                preferredTime: form.preferredTime,
                message: form.inspectionMessage
              }),
          verificationSessionId: verification.sessionId,
          verificationToken: verification.verificationToken,
          turnstileToken,
          idempotencyKey
        }),
        cache: "no-store"
      });

      await readPublicActionResponse(response);

      setSuccess(
        activeTab === "offer"
          ? "Your offer has been received by CarNest and will be formally forwarded to the vehicle owner. If the owner wishes to proceed, CarNest will contact you to arrange an inspection."
          : "Your inspection request has been received. CarNest will contact you after confirming the vehicle and owner’s availability."
      );
      setForm((current) => ({
        ...current,
        offerAmount: "",
        offerMessage: "",
        preferredDate: "",
        preferredTime: "",
        inspectionMessage: ""
      }));
      setFieldErrors({});
      rememberSubmission(activeTab === "offer" ? "carnest-offer-submission" : "carnest-inspection-submission");
      rememberSubmissionEvent(protectionKey, duplicateFingerprint);
      resetVerification();
      resetTurnstile();
      setIdempotencyKey(createIdempotencyKey());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong. Please try again.");
      resetTurnstile();
    } finally {
      setSaving(false);
    }
  }

  const codeCooldownActive = verification.cooldownUntil > nowMs;
  const codeCooldownSeconds = Math.max(0, Math.ceil((verification.cooldownUntil - nowMs) / 1000));
  const submitDisabled = saving || isUnderOffer || !emailVerifiedForSubmission;

  return (
    <div id="take-action-panel" className="scroll-mt-24 rounded-[28px] border border-black/5 bg-white p-5 shadow-panel sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-bronze">Take Action</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">Move this listing forward</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink/70">
            We use your details to coordinate directly with the seller or warehouse.
          </p>
          <p className="mt-3 text-sm leading-6 text-ink/55">
            Guest submissions are accepted after email verification.
          </p>
        </div>
        <div className="rounded-[22px] bg-shell px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Asking price</p>
          <p className="mt-2 text-xl font-semibold text-ink">{formatCurrency(vehicle.price)}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2.5 sm:mt-6 sm:flex-row sm:gap-3">
        <button
          type="button"
          onClick={() => {
            setActiveTab("offer");
            setMobileFormExpanded(true);
            setError("");
            setSuccess("");
          }}
          className={`w-full rounded-full px-5 py-3 text-sm font-semibold transition sm:w-auto ${
            activeTab === "offer"
              ? "bg-ink text-white shadow-sm"
              : "border border-black/10 bg-white text-ink hover:border-bronze hover:text-bronze"
          }`}
        >
          Make Offer
        </button>
        {canBookInspection ? (
          <button
            type="button"
            onClick={() => {
              setActiveTab("inspection");
              setMobileFormExpanded(true);
              setError("");
              setSuccess("");
            }}
            className={`w-full rounded-full px-5 py-3 text-sm font-semibold transition sm:w-auto ${
              activeTab === "inspection"
                ? "bg-ink text-white shadow-sm"
                : "border border-black/10 bg-white text-ink hover:border-bronze hover:text-bronze"
            }`}
          >
            Book Inspection
          </button>
        ) : null}
      </div>

      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(event) => setField("website", event.target.value)}
          />
        </label>
      </div>

      {!mobileFormExpanded ? (
        <div className="mt-4 rounded-[22px] border border-black/5 bg-shell px-4 py-3 md:hidden">
          <p className="text-sm leading-6 text-ink/62">
            Tap Make Offer or Book Inspection to continue.
          </p>
        </div>
      ) : null}

      <div className={`${mobileFormExpanded ? "mt-5" : "hidden md:block md:mt-6"} grid gap-3 md:grid-cols-2 md:gap-4`}>
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Name</span>
          <Input
            value={form.buyerName}
            onChange={(event) => setField("buyerName", event.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.buyerName)}
            autoComplete="name"
          />
          {fieldErrors.buyerName ? <p className="text-sm text-red-700">{fieldErrors.buyerName}</p> : null}
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Email</span>
          <Input
            type="email"
            value={form.buyerEmail}
            onChange={(event) => setField("buyerEmail", event.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.buyerEmail)}
            autoComplete="email"
          />
          {fieldErrors.buyerEmail ? <p className="text-sm text-red-700">{fieldErrors.buyerEmail}</p> : null}
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Phone</span>
          <Input
            value={form.buyerPhone}
            onChange={(event) => setField("buyerPhone", event.target.value)}
            required
            inputMode="tel"
            aria-invalid={Boolean(fieldErrors.buyerPhone)}
            autoComplete="tel"
          />
          {fieldErrors.buyerPhone ? <p className="text-sm text-red-700">{fieldErrors.buyerPhone}</p> : null}
        </label>
      </div>

      <div className={`${mobileFormExpanded ? "mt-4 sm:mt-5" : "hidden md:block md:mt-5"} overflow-hidden`}>
        <div key={activeTab} className="space-y-4 transition-opacity duration-200 ease-out sm:space-y-5">
          {activeTab === "offer" || !canBookInspection ? (
            <>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">Offer amount</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.offerAmount}
                  onChange={(event) => setField("offerAmount", event.target.value)}
                  required
                  aria-invalid={Boolean(fieldErrors.offerAmount)}
                />
                {fieldErrors.offerAmount ? <p className="text-sm text-red-700">{fieldErrors.offerAmount}</p> : null}
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">Message</span>
                <Textarea
                  value={form.offerMessage}
                  onChange={(event) => setField("offerMessage", event.target.value)}
                  placeholder="Optional message, preferred inspection time, or conditions."
                />
              </label>
            </>
          ) : (
            <>
              <p className="text-sm leading-6 text-ink/70">
                Request an appointment and CarNest will coordinate availability before anything is confirmed.
              </p>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">Preferred date</span>
                <Input
                  type="date"
                  value={form.preferredDate}
                  onChange={(event) => setField("preferredDate", event.target.value)}
                  required
                  aria-invalid={Boolean(fieldErrors.preferredDate)}
                  lang="en-AU"
                />
                {form.preferredDate ? <p className="text-xs text-ink/50">{formatInspectionDateForDisplay(form.preferredDate)}</p> : null}
                {fieldErrors.preferredDate ? <p className="text-sm text-red-700">{fieldErrors.preferredDate}</p> : null}
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">Preferred time or window</span>
                <Input
                  value={form.preferredTime}
                  onChange={(event) => setField("preferredTime", event.target.value)}
                  placeholder="e.g. Saturday morning or weekday after 5pm"
                  required
                  aria-invalid={Boolean(fieldErrors.preferredTime)}
                />
                {fieldErrors.preferredTime ? <p className="text-sm text-red-700">{fieldErrors.preferredTime}</p> : null}
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">Message</span>
                <Textarea
                  value={form.inspectionMessage}
                  onChange={(event) => setField("inspectionMessage", event.target.value)}
                  placeholder="Optional notes for access, preferred days, or any questions."
                />
              </label>
            </>
          )}
        </div>
      </div>

      <div className={`${mobileFormExpanded ? "mt-4 sm:mt-5" : "hidden md:block md:mt-5"} rounded-[24px] border border-black/5 bg-shell px-4 py-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-bronze">Email verification</p>
            <p className="mt-1 text-sm text-ink/65">{verificationLabel}</p>
          </div>
          {emailVerifiedForSubmission ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
              Verified
            </span>
          ) : null}
        </div>

        {!emailVerifiedForSubmission ? (
          <div className="mt-4 space-y-3">
            <Button
              type="button"
              disabled={sendingCode || codeCooldownActive}
              onClick={() => void sendVerificationCode()}
              className="w-full sm:w-auto"
            >
              {sendingCode
                ? "Sending code..."
                : codeCooldownActive
                  ? `Send again in ${codeCooldownSeconds}s`
                  : verification.status === "sent"
                    ? "Send verification code again"
                    : "Send verification code"}
            </Button>
            {verification.status === "sent" ? (
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-ink">Verification code</span>
                  <Input
                    value={verification.code}
                    onChange={(event) =>
                      setVerification((current) => ({
                        ...current,
                        code: event.target.value.replace(/\D/g, "").slice(0, 6)
                      }))
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                  />
                </label>
                <div className="flex items-end">
                  <Button type="button" disabled={verifyingCode || verification.code.length !== 6} onClick={() => void verifyEmailCode()}>
                    {verifyingCode ? "Verifying..." : "Verify email"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <p className={`${mobileFormExpanded ? "mt-4 sm:mt-5" : "hidden md:block md:mt-5"} rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800`}>{error}</p>
      ) : null}
      {success ? (
        <p className={`${mobileFormExpanded ? "mt-4 sm:mt-5" : "hidden md:block md:mt-5"} rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800`}>
          {success}
        </p>
      ) : null}

      <div className={`${mobileFormExpanded ? "mt-4 sm:mt-5" : "hidden md:block md:mt-5"}`}>
        <TurnstileField key={turnstileInstanceKey} token={turnstileToken} onTokenChange={setTurnstileToken} />
      </div>

      <div className={`${mobileFormExpanded ? "mt-4 sm:mt-5" : "hidden md:block md:mt-5"}`}>
        <Button type="button" disabled={submitDisabled} onClick={() => void submitAction()} className="w-full sm:w-auto">
          {saving ? (activeTab === "offer" ? "Submitting offer..." : "Requesting inspection...") : activeTab === "offer" ? "Submit offer" : "Book inspection"}
        </Button>
      </div>

      {isUnderOffer ? (
        <p className={`${mobileFormExpanded ? "mt-4" : "hidden md:block md:mt-4"} rounded-[24px] border border-[#F5D7B2] bg-[#FFF8F0] px-4 py-3 text-sm leading-6 text-[#B54708]`}>
          This vehicle is currently under offer while the accepted buyer confirms whether they want to proceed.
        </p>
      ) : null}
    </div>
  );
}
