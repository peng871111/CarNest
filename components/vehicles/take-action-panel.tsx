"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGateModal } from "@/components/auth/auth-gate-modal";
import { TurnstileField } from "@/components/forms/turnstile-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { createInspectionRequest, createOffer } from "@/lib/data";
import {
  buildSubmissionFingerprint,
  checkAntiSpamGuards,
  checkDuplicateSubmission,
  checkRateLimit,
  isValidEmailAddress,
  rememberSubmission,
  rememberSubmissionEvent,
  validateTurnstileToken,
  verifyTurnstileToken
} from "@/lib/form-safety";
import { formatCurrency } from "@/lib/utils";
import { Vehicle } from "@/types";

type ActionTab = "offer" | "inspection";

interface ActionFormState {
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  offerAmount: string;
  offerMessage: string;
  preferredTime: string;
  inspectionMessage: string;
  website: string;
}

const initialState: ActionFormState = {
  buyerName: "",
  buyerEmail: "",
  buyerPhone: "",
  offerAmount: "",
  offerMessage: "",
  preferredTime: "",
  inspectionMessage: "",
  website: ""
};

export function TakeActionPanel({ vehicle }: { vehicle: Vehicle }) {
  const { appUser } = useAuth();
  const searchParams = useSearchParams();
  const canBookInspection = vehicle.listingType === "warehouse";
  const isUnderOffer = vehicle.sellerStatus === "UNDER_OFFER";
  const [activeTab, setActiveTab] = useState<ActionTab>(canBookInspection && searchParams.get("action") === "inspection" ? "inspection" : "offer");
  const [mobileFormExpanded, setMobileFormExpanded] = useState(() => Boolean(searchParams.get("action")));
  const [form, setForm] = useState<ActionFormState>(initialState);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [startedAt] = useState(() => Date.now());

  function setField<K extends keyof ActionFormState>(key: K, value: ActionFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
  }

  function validateForm() {
    const nextErrors: Record<string, string> = {};

    if (!form.buyerName.trim()) nextErrors.buyerName = "Please enter your name.";
    if (!form.buyerEmail.trim()) nextErrors.buyerEmail = "Please enter your email address.";
    else if (!isValidEmailAddress(form.buyerEmail)) nextErrors.buyerEmail = "Please enter a valid email address.";
    if (!form.buyerPhone.trim()) nextErrors.buyerPhone = "Please enter your phone number.";

    if (activeTab === "offer") {
      if (!form.offerAmount.trim()) nextErrors.offerAmount = "Please enter your offer amount.";
      else if (!Number(form.offerAmount) || Number(form.offerAmount) <= 0) nextErrors.offerAmount = "Offer amount must be greater than zero.";
      else if (Number(form.offerAmount) < Math.max(1000, Math.round(vehicle.price * 0.5))) {
        nextErrors.offerAmount = "Please enter a realistic offer amount.";
      }
    }

    if (activeTab === "inspection" && canBookInspection && !form.preferredTime.trim()) {
      nextErrors.preferredTime = "Please share a preferred inspection time.";
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

  const redirectPath = `/inventory/${vehicle.id}?action=${activeTab}`;

  async function handleOfferSubmit() {
    if (!appUser) {
      throw new Error("Please sign in to submit an offer.");
    }

    const offerAmount = Number(form.offerAmount);
    if (!offerAmount || offerAmount <= 0) {
      setError("Offer amount must be greater than zero.");
      return;
    }

    const result = await createOffer({
      vehicleId: vehicle.id,
      vehicleTitle: `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.variant ? ` ${vehicle.variant}` : ""}`,
      vehiclePrice: vehicle.price,
      buyerName: form.buyerName.trim(),
      buyerEmail: form.buyerEmail.trim(),
      buyerPhone: form.buyerPhone.trim(),
      offerAmount,
      message: form.offerMessage.trim(),
      sellerOwnerUid: vehicle.ownerUid,
      userId: appUser.id,
      submittedByUid: appUser.id
    });

    setSuccess(
      result.writeSucceeded
        ? "Offer submitted successfully. You can track the result in My Offers."
        : "Offer submitted successfully. You can track the result in My Offers."
    );
    setForm((current) => ({
      ...current,
      offerAmount: "",
      offerMessage: ""
    }));
  }

  async function handleInspectionSubmit() {
    if (!appUser) {
      throw new Error("Please sign in to request an inspection.");
    }

    await createInspectionRequest({
      vehicleId: vehicle.id,
      vehicleTitle: `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.variant ? ` ${vehicle.variant}` : ""}`,
      buyerName: form.buyerName.trim(),
      buyerEmail: form.buyerEmail.trim(),
      buyerPhone: form.buyerPhone.trim(),
      preferredTime: form.preferredTime.trim(),
      message: form.inspectionMessage.trim(),
      listingType: vehicle.listingType,
      sellerOwnerUid: vehicle.ownerUid,
      submittedByUid: appUser.id
    });

    setSuccess("Inspection request received. We will contact you to confirm a suitable time.");
    setForm((current) => ({
      ...current,
      preferredTime: "",
      inspectionMessage: ""
    }));
  }

  async function handleSubmit() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (!appUser) {
        setShowAuthModal(true);
        return;
      }

      const nextErrors = validateForm();
      const protectionKey = `carnest-${activeTab}-submission:${appUser.id}:${vehicle.id}`;
      const duplicateFingerprint =
        activeTab === "offer"
          ? buildSubmissionFingerprint([vehicle.id, form.offerAmount, form.offerMessage])
          : buildSubmissionFingerprint([vehicle.id, form.preferredTime, form.inspectionMessage]);
      const antiSpamError = checkAntiSpamGuards({
        honeypot: form.website,
        startedAt,
        storageKey: protectionKey
      });
      const rateLimitError = checkRateLimit({
        storageKey: protectionKey,
        limit: 2,
        windowMs: 30 * 60 * 1000
      });
      const dailyRateLimitError = checkRateLimit({
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

      if (antiSpamError || rateLimitError || dailyRateLimitError || duplicateError || turnstilePresenceError) {
        throw new Error(antiSpamError || rateLimitError || dailyRateLimitError || duplicateError || turnstilePresenceError);
      }

      const turnstileVerificationError = await verifyTurnstileToken(turnstileToken);
      if (turnstileVerificationError) {
        throw new Error(turnstileVerificationError);
      }

      if (activeTab === "offer") {
        await handleOfferSubmit();
        rememberSubmission("carnest-offer-submission");
      } else {
        if (!canBookInspection) {
          throw new Error("Inspection booking is only available for warehouse vehicles.");
        }
        await handleInspectionSubmit();
        rememberSubmission("carnest-inspection-submission");
      }
      rememberSubmissionEvent(protectionKey, duplicateFingerprint);
      setTurnstileToken("");
    } catch (submitError) {
      setError(
        submitError instanceof Error &&
        [
          "Please correct the highlighted fields before submitting.",
          "Please sign in to submit an offer.",
          "Please sign in to request an inspection.",
          "Inspection booking is only available for warehouse vehicles.",
          "Please enter a realistic offer amount.",
          "This vehicle is not currently available for offers.",
          "This vehicle is currently under offer.",
          "Too many requests. Please try again later.",
          "It looks like this request was already submitted.",
          "Please take a moment to review your details before submitting.",
          "Please wait a moment before submitting again.",
          "Unable to submit right now.",
          "Please complete the security check before submitting."
        ].includes(submitError.message)
          ? submitError.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div id="take-action-panel" className="scroll-mt-24 rounded-[28px] border border-black/5 bg-white p-5 sm:p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-bronze">Take Action</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">Move this listing forward</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink/70">
            We use your details to coordinate directly with the seller or warehouse.
          </p>
          <p className="mt-3 text-sm leading-6 text-ink/55">
            An account is required to submit offers, book inspections, and save vehicles.
          </p>
        </div>
        <div className="rounded-[22px] bg-shell px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Asking price</p>
          <p className="mt-2 text-xl font-semibold text-ink">{formatCurrency(vehicle.price)}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2.5 sm:mt-6 sm:gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            setActiveTab("offer");
            setMobileFormExpanded(true);
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
          />
          {fieldErrors.buyerEmail ? <p className="text-sm text-red-700">{fieldErrors.buyerEmail}</p> : null}
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Phone</span>
          <Input
            value={form.buyerPhone}
            onChange={(event) => setField("buyerPhone", event.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.buyerPhone)}
          />
          {fieldErrors.buyerPhone ? <p className="text-sm text-red-700">{fieldErrors.buyerPhone}</p> : null}
        </label>
      </div>

      <div className={`${mobileFormExpanded ? "mt-4 sm:mt-5" : "hidden md:block md:mt-5"} overflow-hidden`}>
        <div
          key={activeTab}
          className="space-y-4 sm:space-y-5 transition-opacity duration-200 ease-out"
        >
          {activeTab === "offer" || !canBookInspection ? (
            <>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">Offer amount</span>
                <Input
                  type="number"
                  min="1"
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
                  placeholder="Include your offer, preferred inspection time, and any conditions."
                />
              </label>
            </>
          ) : (
            <>
              <p className="text-sm leading-6 text-ink/70">
                {vehicle.listingType === "warehouse"
                  ? "Request an appointment and CarNest will coordinate the next available warehouse inspection window."
                  : "Request an inspection and CarNest will help coordinate the next step with the seller."}
              </p>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">Preferred time</span>
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

      {error ? (
        <p className={`${mobileFormExpanded ? "mt-4 sm:mt-5" : "hidden md:block md:mt-5"} rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800`}>{error}</p>
      ) : null}
      {success ? (
        <p className={`${mobileFormExpanded ? "mt-4 sm:mt-5" : "hidden md:block md:mt-5"} rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800`}>
          {success}
        </p>
      ) : null}

      <div className={`${mobileFormExpanded ? "mt-4 sm:mt-5" : "hidden md:block md:mt-5"}`}>
        <TurnstileField token={turnstileToken} onTokenChange={setTurnstileToken} />
      </div>

      <div className={`${mobileFormExpanded ? "mt-4 sm:mt-5" : "hidden md:block md:mt-5"}`}>
        <Button type="button" disabled={saving || isUnderOffer} onClick={() => void handleSubmit()} className="w-full sm:w-auto">
          {saving ? (activeTab === "offer" ? "Submitting offer..." : "Booking inspection...") : activeTab === "offer" ? "Submit offer" : "Book inspection"}
        </Button>
      </div>

      {isUnderOffer ? (
        <p className={`${mobileFormExpanded ? "mt-4" : "hidden md:block md:mt-4"} rounded-[24px] border border-[#F5D7B2] bg-[#FFF8F0] px-4 py-3 text-sm leading-6 text-[#B54708]`}>
          This vehicle is currently under offer while the accepted buyer confirms whether they want to proceed.
        </p>
      ) : null}

      <AuthGateModal
        open={showAuthModal}
        action={activeTab === "inspection" ? "inspection" : "offer"}
        redirectPath={redirectPath}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}
