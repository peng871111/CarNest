"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { TurnstileField } from "@/components/forms/turnstile-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getDealerOfferValidationErrors } from "@/lib/dealer-offer-validation";
import {
  buildSubmissionFingerprint,
  checkAntiSpamGuards,
  checkDuplicateSubmission,
  checkRateLimit,
  rememberSubmission,
  rememberSubmissionEvent,
  validateTurnstileToken
} from "@/lib/form-safety";
import { formatCurrency, getVehicleDisplayReference } from "@/lib/utils";
import { Vehicle } from "@/types";

interface DealerOfferForm {
  dealershipName: string;
  contactName: string;
  phone: string;
  offerAmount: string;
  email: string;
  preferredInspectionDate: string;
  comments: string;
  website: string;
}

const initialForm: DealerOfferForm = {
  dealershipName: "",
  contactName: "",
  phone: "",
  offerAmount: "",
  email: "",
  preferredInspectionDate: "",
  comments: "",
  website: ""
};

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-dealer-offer`;
}

type DealerOfferResponse = { success?: boolean; message?: string; duplicate?: boolean };

export function DealerOfferModal({ vehicle, open, onClose }: { vehicle: Vehicle; open: boolean; onClose: () => void }) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const [form, setForm] = useState<DealerOfferForm>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setStartedAt(Date.now());
    window.setTimeout(() => headingRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open, submitting]);

  function resetTurnstile() {
    setTurnstileToken("");
    setTurnstileKey((current) => current + 1);
  }

  function updateField<K extends keyof DealerOfferForm>(field: K, value: DealerOfferForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const payload = {
      vehicleId: vehicle.id,
      dealershipName: form.dealershipName,
      contactName: form.contactName,
      phone: form.phone,
      offerAmount: Number(form.offerAmount),
      email: form.email,
      preferredInspectionDate: form.preferredInspectionDate,
      comments: form.comments,
      idempotencyKey
    };
    const validationErrors = getDealerOfferValidationErrors(payload);
    const protectionKey = `carnest-dealer-offer:${vehicle.id}:${form.phone.trim().replace(/\D/g, "") || "unknown"}`;
    const fingerprint = buildSubmissionFingerprint([
      vehicle.id,
      form.dealershipName,
      form.contactName,
      form.phone,
      form.offerAmount,
      form.comments
    ]);
    const antiSpamError = checkAntiSpamGuards({ honeypot: form.website, startedAt, storageKey: protectionKey });
    const rateLimitError = checkRateLimit({ storageKey: protectionKey, limit: 2, windowMs: 30 * 60 * 1000 });
    const duplicateError = checkDuplicateSubmission({ storageKey: protectionKey, fingerprint, windowMs: 15 * 60 * 1000 });
    const turnstileError = validateTurnstileToken(turnstileToken);

    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      setMessage({ type: "error", text: "Please correct the highlighted fields before submitting." });
      return;
    }
    if (antiSpamError || rateLimitError || duplicateError || turnstileError) {
      setMessage({ type: "error", text: antiSpamError || rateLimitError || duplicateError || turnstileError });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/public/dealer-offers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, website: form.website, turnstileToken }),
        cache: "no-store"
      });
      const result = await response.json().catch(() => ({} as DealerOfferResponse)) as DealerOfferResponse;
      if (!response.ok || !result.success) {
        throw new Error(typeof result.message === "string" ? result.message : "Unable to submit this dealer offer. Please try again.");
      }

      setMessage({
        type: "success",
        text: "Your dealer offer has been received by CarNest. We will contact you if further information is required."
      });
      setForm(initialForm);
      setErrors({});
      rememberSubmission("carnest-dealer-offer-submission");
      rememberSubmissionEvent(protectionKey, fingerprint);
      resetTurnstile();
      setIdempotencyKey(createIdempotencyKey());
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to submit this dealer offer. Please try again." });
      resetTurnstile();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const vehicleTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  return (
    <div className="fixed inset-0 z-[100] flex items-end bg-black/45 p-4 sm:items-center sm:justify-center sm:p-6" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !submitting) onClose();
    }}>
      <section
        className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-5 shadow-panel sm:p-7"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dealer-offer-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-bronze">Dealer Offer</p>
            <h2 id="dealer-offer-title" ref={headingRef} tabIndex={-1} className="mt-2 text-2xl font-semibold text-ink outline-none">Submit Dealer Offer</h2>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Close dealer offer form" className="rounded-full border border-black/10 px-3 py-1.5 text-sm font-medium text-ink transition hover:border-bronze hover:text-bronze disabled:opacity-40">
            Close
          </button>
        </div>

        <div className="mt-5 rounded-[20px] bg-shell px-4 py-3 text-sm text-ink/70">
          <p className="font-semibold text-ink">{vehicleTitle}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.15em] text-ink/50">Vehicle Ref: {getVehicleDisplayReference(vehicle)}</p>
          <p className="mt-2">Asking price: {formatCurrency(vehicle.price)}</p>
        </div>

        <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
          <div className="hidden" aria-hidden="true">
            <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => updateField("website", event.target.value)} /></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-ink">Dealership Name</span>
              <Input value={form.dealershipName} onChange={(event) => updateField("dealershipName", event.target.value)} required aria-invalid={Boolean(errors.dealershipName)} autoComplete="organization" />
              {errors.dealershipName ? <p className="text-sm text-red-700">{errors.dealershipName}</p> : null}
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-ink">Buyer / Contact Name</span>
              <Input value={form.contactName} onChange={(event) => updateField("contactName", event.target.value)} required aria-invalid={Boolean(errors.contactName)} autoComplete="name" />
              {errors.contactName ? <p className="text-sm text-red-700">{errors.contactName}</p> : null}
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-ink">Phone Number</span>
              <Input value={form.phone} onChange={(event) => updateField("phone", event.target.value)} required inputMode="tel" aria-invalid={Boolean(errors.phone)} autoComplete="tel" />
              {errors.phone ? <p className="text-sm text-red-700">{errors.phone}</p> : null}
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-ink">Offer Amount (AUD)</span>
              <Input type="number" min="1" step="0.01" inputMode="decimal" value={form.offerAmount} onChange={(event) => updateField("offerAmount", event.target.value)} required aria-invalid={Boolean(errors.offerAmount)} />
              {errors.offerAmount ? <p className="text-sm text-red-700">{errors.offerAmount}</p> : null}
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-ink">Email Address <span className="font-normal text-ink/45">Optional</span></span>
              <Input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} aria-invalid={Boolean(errors.email)} autoComplete="email" />
              {errors.email ? <p className="text-sm text-red-700">{errors.email}</p> : null}
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-ink">Preferred Inspection Date <span className="font-normal text-ink/45">Optional</span></span>
              <Input type="date" value={form.preferredInspectionDate} onChange={(event) => updateField("preferredInspectionDate", event.target.value)} aria-invalid={Boolean(errors.preferredInspectionDate)} lang="en-AU" />
              {errors.preferredInspectionDate ? <p className="text-sm text-red-700">{errors.preferredInspectionDate}</p> : null}
            </label>
          </div>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-ink">Comments / Additional Conditions <span className="font-normal text-ink/45">Optional</span></span>
            <Textarea value={form.comments} onChange={(event) => updateField("comments", event.target.value)} placeholder="Optional terms, timing, or inspection notes." />
          </label>
          <p className="rounded-[20px] bg-shell px-4 py-3 text-xs leading-5 text-ink/62">
            CarNest is not acting as a motor vehicle broker or selling agent. We assist with arranging vehicle inspections and communicating offers between prospective buyers and vehicle owners. Any offer is subject to the vehicle owner’s consideration. No sale is confirmed by submitting this form.
          </p>
          <div key={turnstileKey}><TurnstileField token={turnstileToken} onTokenChange={setTurnstileToken} /></div>
          {message ? <p className={`text-sm leading-6 ${message.type === "error" ? "text-red-700" : "text-emerald-700"}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</p> : null}
          <div className="flex flex-wrap justify-end gap-3 pt-1">
            <Button type="button" onClick={onClose} disabled={submitting} className="border border-black/10 bg-white text-ink hover:border-bronze hover:bg-white hover:text-bronze">Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit Dealer Offer"}</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
