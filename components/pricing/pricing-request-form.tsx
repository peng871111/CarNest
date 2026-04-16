"use client";

import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AuthGateModal } from "@/components/auth/auth-gate-modal";
import { TurnstileField } from "@/components/forms/turnstile-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { createPricingRequest, getOwnedVehiclesData } from "@/lib/data";
import {
  buildSubmissionFingerprint,
  checkAntiSpamGuards,
  checkDuplicateSubmission,
  checkRateLimit,
  rememberSubmission,
  rememberSubmissionEvent,
  validateTurnstileToken,
  verifyTurnstileToken
} from "@/lib/form-safety";
import { formatCurrency } from "@/lib/utils";
import { PricingRequestTimeline, Vehicle } from "@/types";

const TIMELINE_OPTIONS: PricingRequestTimeline[] = [
  "ASAP (within 2 weeks)",
  "2–4 weeks",
  "1–2 months",
  "Just exploring"
];

export function PricingRequestForm() {
  const searchParams = useSearchParams();
  const { appUser, loading } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [timeline, setTimeline] = useState<PricingRequestTimeline | "">("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [startedAt] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    async function loadVehicles() {
      if (!appUser || appUser.role !== "seller") {
        setVehicles([]);
        setVehiclesLoading(false);
        return;
      }

      setVehiclesLoading(true);
      const result = await getOwnedVehiclesData(appUser.id);
      if (cancelled) return;
      setVehicles(result.items);
      setVehiclesLoading(false);
    }

    void loadVehicles();
    return () => {
      cancelled = true;
    };
  }, [appUser]);

  useEffect(() => {
    const requestedVehicleId = searchParams.get("vehicleId") ?? "";

    if (requestedVehicleId && vehicles.some((vehicle) => vehicle.id === requestedVehicleId)) {
      setSelectedVehicleId(requestedVehicleId);
      return;
    }

    if (!requestedVehicleId && vehicles.length === 1) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [searchParams, vehicles]);

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null,
    [selectedVehicleId, vehicles]
  );

  useEffect(() => {
    if (!selectedVehicle) return;

    setCurrentPrice((existing) => existing || String(selectedVehicle.price));
  }, [selectedVehicle]);

  function setFieldError(name: string, value = "") {
    setFieldErrors((current) => ({ ...current, [name]: value }));
  }

  function validateForm() {
    const nextErrors: Record<string, string> = {};

    if (!timeline) nextErrors.timeline = "Please select your selling timeline.";
    if (!message.trim()) nextErrors.message = "Please enter a few notes for our team.";
    if (currentPrice.trim() && (!Number(currentPrice) || Number(currentPrice) <= 0)) {
      nextErrors.currentPrice = "Current asking price must be greater than zero.";
    }

    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (!appUser) {
        setShowAuthModal(true);
        return;
      }

      const nextErrors = validateForm();
      const protectionKey = `carnest-pricing-request:${appUser.id}`;
      const duplicateFingerprint = buildSubmissionFingerprint([selectedVehicleId, timeline, message]);
      const antiSpamError = checkAntiSpamGuards({
        honeypot: website,
        startedAt,
        storageKey: protectionKey
      });
      const rateLimitError = checkRateLimit({
        storageKey: protectionKey,
        limit: 2,
        windowMs: 60 * 60 * 1000
      });
      const dailyRateLimitError = checkRateLimit({
        storageKey: protectionKey,
        limit: 4,
        windowMs: 24 * 60 * 60 * 1000
      });
      const duplicateError = checkDuplicateSubmission({
        storageKey: protectionKey,
        fingerprint: duplicateFingerprint,
        windowMs: 60 * 60 * 1000
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

      await createPricingRequest({
        userId: appUser.id,
        vehicleId: selectedVehicleId || undefined,
        currentPrice: currentPrice.trim() ? Number(currentPrice) : undefined,
        timeline: timeline as PricingRequestTimeline,
        message: message.trim()
      });

      rememberSubmission("carnest-pricing-request");
      setFieldErrors({});
      setSuccess("Your request has been received. Our team will respond during business hours (Mon–Fri, 9am–5pm).");
      setTurnstileToken("");
      setCurrentPrice("");
      setTimeline("");
      setMessage("");
      if (vehicles.length !== 1) {
        setSelectedVehicleId("");
      }
      rememberSubmissionEvent(protectionKey, duplicateFingerprint);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error &&
          [
            "Please correct the highlighted fields before submitting.",
            "Too many requests. Please try again later.",
            "It looks like this request was already submitted.",
            "Please take a moment to review your details before submitting.",
            "Please wait a moment before submitting again.",
            "Please complete the security check before submitting."
          ].includes(submissionError.message)
          ? submissionError.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-[32px] border border-black/5 bg-white p-8 text-sm text-ink/60 shadow-panel">Loading pricing advice...</div>;
  }

  return (
    <>
    <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.28em] text-bronze">Pricing advice</p>
        <h1 className="mt-4 font-display text-4xl text-ink">Request personalised pricing advice</h1>
        <p className="mt-4 text-sm leading-6 text-ink/65">
          Share your timeline and a few notes about the car you want help with. We&apos;ll come back with practical human guidance based on live market demand.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="hidden" aria-hidden="true">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink">Linked vehicle</span>
          <select
            value={selectedVehicleId}
            onChange={(event) => {
              const nextVehicleId = event.target.value;
              const nextVehicle = vehicles.find((vehicle) => vehicle.id === nextVehicleId);
              setSelectedVehicleId(nextVehicleId);
              setCurrentPrice(nextVehicle ? String(nextVehicle.price) : "");
              setFieldError("vehicleId");
            }}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink"
          >
            <option value="">No linked vehicle</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.year} {vehicle.make} {vehicle.model}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink/50">
            {vehiclesLoading
              ? "Loading your vehicles..."
              : !appUser
                ? "Sign in to link one of your vehicles to this request."
              : selectedVehicle
                ? `Linked to ${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
                : "Optional, but helpful if you want advice tied to a specific listing."}
          </p>
        </label>

        <div className="grid gap-5 md:grid-cols-[1fr,1fr]">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-ink">Current asking price</span>
            <Input
              type="number"
              min="1"
              value={currentPrice}
              onChange={(event) => {
                setCurrentPrice(event.target.value);
                setFieldError("currentPrice");
              }}
              placeholder={selectedVehicle ? String(selectedVehicle.price) : "Optional"}
            />
            {fieldErrors.currentPrice ? <p className="text-sm text-red-700">{fieldErrors.currentPrice}</p> : null}
            {selectedVehicle ? <p className="text-xs text-ink/50">Current linked listing price: {formatCurrency(selectedVehicle.price)}</p> : null}
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-ink">Selling timeline</span>
            <select
              value={timeline}
              onChange={(event) => {
                setTimeline(event.target.value as PricingRequestTimeline | "");
                setFieldError("timeline");
              }}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink"
              aria-invalid={Boolean(fieldErrors.timeline)}
            >
              <option value="">Select a timeline</option>
              {TIMELINE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {fieldErrors.timeline ? <p className="text-sm text-red-700">{fieldErrors.timeline}</p> : null}
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink">Message / notes</span>
          <Textarea
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              setFieldError("message");
            }}
            placeholder="Tell us about the vehicle, where you think pricing may need guidance, and anything else that matters."
            aria-invalid={Boolean(fieldErrors.message)}
          />
          {fieldErrors.message ? <p className="text-sm text-red-700">{fieldErrors.message}</p> : null}
        </label>

        <div className="rounded-[24px] bg-shell px-5 py-4 text-sm leading-6 text-ink/65">
          Pricing advice is provided for general guidance only and does not guarantee sale price or timing.
        </div>
        <TurnstileField token={turnstileToken} onTokenChange={setTurnstileToken} />

        {success ? (
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
            {success}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Sending..." : "Request Pricing Advice"}
          </Button>
          <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Business hours: Mon–Fri, 9am–5pm</p>
        </div>
      </form>
    </section>
      <AuthGateModal
        open={showAuthModal}
        action="pricing"
        redirectPath={`/pricing-advice?action=pricing${selectedVehicleId ? `&vehicleId=${encodeURIComponent(selectedVehicleId)}` : ""}`}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
}
