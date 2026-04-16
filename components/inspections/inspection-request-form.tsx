"use client";

import { FormEvent, useEffect, useState } from "react";
import { TurnstileField } from "@/components/forms/turnstile-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { createInspectionRequest } from "@/lib/data";
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
import { Vehicle } from "@/types";

interface InspectionRequestFormState {
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  preferredTime: string;
  message: string;
  website: string;
}

const initialState: InspectionRequestFormState = {
  buyerName: "",
  buyerEmail: "",
  buyerPhone: "",
  preferredTime: "",
  message: "",
  website: ""
};

export function InspectionRequestForm({ vehicle }: { vehicle: Vehicle }) {
  const { appUser } = useAuth();
  const [form, setForm] = useState<InspectionRequestFormState>(initialState);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [startedAt] = useState(() => Date.now());

  function setField<K extends keyof InspectionRequestFormState>(key: K, value: InspectionRequestFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
  }

  function validateForm() {
    const nextErrors: Record<string, string> = {};
    if (!form.buyerName.trim()) nextErrors.buyerName = "Please enter your name.";
    if (!form.buyerEmail.trim()) nextErrors.buyerEmail = "Please enter your email address.";
    else if (!isValidEmailAddress(form.buyerEmail)) nextErrors.buyerEmail = "Please enter a valid email address.";
    if (!form.buyerPhone.trim()) nextErrors.buyerPhone = "Please enter your phone number.";
    if (!form.preferredTime.trim()) nextErrors.preferredTime = "Please share a preferred inspection time.";
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    if (!appUser) {
      setSaving(false);
      setError("Please sign in to request an inspection.");
      return;
    }

    const nextErrors = validateForm();
    const protectionKey = `carnest-inspection-form:${appUser.id}:${vehicle.id}`;
    const duplicateFingerprint = buildSubmissionFingerprint([vehicle.id, form.preferredTime, form.message]);
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
      setSaving(false);
      setError("Please correct the highlighted fields before submitting.");
      return;
    }

    if (antiSpamError || rateLimitError || dailyRateLimitError || duplicateError || turnstilePresenceError) {
      setSaving(false);
      setError(antiSpamError || rateLimitError || dailyRateLimitError || duplicateError || turnstilePresenceError);
      return;
    }

    try {
      const turnstileVerificationError = await verifyTurnstileToken(turnstileToken);
      if (turnstileVerificationError) {
        throw new Error(turnstileVerificationError);
      }

      await createInspectionRequest({
        vehicleId: vehicle.id,
        vehicleTitle: `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.variant ? ` ${vehicle.variant}` : ""}`,
        buyerName: form.buyerName.trim(),
        buyerEmail: form.buyerEmail.trim(),
        buyerPhone: form.buyerPhone.trim(),
        preferredTime: form.preferredTime.trim(),
        message: form.message.trim(),
        listingType: vehicle.listingType,
        sellerOwnerUid: vehicle.ownerUid,
        submittedByUid: appUser.id
      });

      setSuccess("Inspection request received. We will contact you to confirm a suitable time.");
      setForm({
        ...initialState,
        buyerName: appUser?.displayName || "",
        buyerEmail: appUser?.email || "",
        buyerPhone: appUser?.phone || ""
      });
      setTurnstileToken("");
      setFieldErrors({});
      rememberSubmission("carnest-inspection-form");
      rememberSubmissionEvent(protectionKey, duplicateFingerprint);
    } catch (submitError) {
      setError(
        submitError instanceof Error &&
        [
          "Please correct the highlighted fields before submitting.",
          "Please sign in to request an inspection.",
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
    <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.25em] text-bronze">Warehouse inspections</p>
      <h2 className="mt-2 text-2xl font-semibold text-ink">Book Warehouse Inspection</h2>
      <p className="mt-3 text-sm leading-6 text-ink/70">
        Request an appointment and CarNest will coordinate the next available warehouse inspection window.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div className="hidden" aria-hidden="true">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => setField("website", event.target.value)} />
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Name</span>
            <Input
              value={form.buyerName}
              onChange={(event) => setField("buyerName", event.target.value)}
              required
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
            />
            {fieldErrors.buyerEmail ? <p className="text-sm text-red-700">{fieldErrors.buyerEmail}</p> : null}
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Phone</span>
            <Input
              value={form.buyerPhone}
              onChange={(event) => setField("buyerPhone", event.target.value)}
              required
            />
            {fieldErrors.buyerPhone ? <p className="text-sm text-red-700">{fieldErrors.buyerPhone}</p> : null}
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Preferred time</span>
            <Input
              value={form.preferredTime}
              onChange={(event) => setField("preferredTime", event.target.value)}
              placeholder="e.g. Saturday morning or weekday after 5pm"
              required
            />
            {fieldErrors.preferredTime ? <p className="text-sm text-red-700">{fieldErrors.preferredTime}</p> : null}
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink">Message</span>
          <Textarea
            value={form.message}
            onChange={(event) => setField("message", event.target.value)}
            placeholder="Optional notes for inspection access, preferred days, or any questions."
          />
        </label>

        {error ? (
          <p className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">{error}</p>
        ) : null}
        {success ? (
          <p className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
            {success}
          </p>
        ) : null}

        <TurnstileField token={turnstileToken} onTokenChange={setTurnstileToken} />

        <Button type="submit" disabled={saving}>
          {saving ? "Submitting request..." : "Book warehouse inspection"}
        </Button>
      </form>
    </div>
  );
}
