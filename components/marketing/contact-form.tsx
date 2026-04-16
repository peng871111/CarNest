"use client";

import { FormEvent, useState } from "react";
import { TurnstileField } from "@/components/forms/turnstile-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createContactMessage } from "@/lib/data";
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

const CONTACT_CATEGORY_OPTIONS = [
  "SELLING MY CAR",
  "BUYING A CAR",
  "SECURE WAREHOUSE STORAGE",
  "GENERAL ENQUIRY"
] as const;

interface ContactFormState {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  category: (typeof CONTACT_CATEGORY_OPTIONS)[number];
  website: string;
}

const initialState: ContactFormState = {
  name: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
  category: "GENERAL ENQUIRY",
  website: ""
};

export function ContactForm() {
  const [form, setForm] = useState<ContactFormState>(initialState);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [startedAt] = useState(() => Date.now());

  function setField<K extends keyof ContactFormState>(key: K, value: ContactFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
    setSubmitted(false);
  }

  function validateForm() {
    const nextErrors: Record<string, string> = {};

    if (!form.name.trim()) nextErrors.name = "Please enter your name.";
    if (!form.email.trim()) nextErrors.email = "Please enter your email address.";
    else if (!isValidEmailAddress(form.email)) nextErrors.email = "Please enter a valid email address.";
    if (!form.phone.trim()) nextErrors.phone = "Please enter your phone number.";
    if (!form.subject.trim()) nextErrors.subject = "Please enter a subject.";
    if (!form.category.trim()) nextErrors.category = "Please choose a category.";
    if (!form.message.trim()) nextErrors.message = "Please enter your message.";

    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateForm();
    const contactKey = `carnest-contact-form:${form.email.trim().toLowerCase() || "guest"}`;
    const duplicateFingerprint = buildSubmissionFingerprint([form.subject, form.message, form.category]);
    const antiSpamError = checkAntiSpamGuards({
      honeypot: form.website,
      startedAt,
      storageKey: contactKey
    });
    const rateLimitError = checkRateLimit({
      storageKey: contactKey,
      limit: 3,
      windowMs: 10 * 60 * 1000
    });
    const dailyRateLimitError = checkRateLimit({
      storageKey: contactKey,
      limit: 10,
      windowMs: 24 * 60 * 60 * 1000
    });
    const duplicateError = checkDuplicateSubmission({
      storageKey: contactKey,
      fingerprint: duplicateFingerprint,
      windowMs: 10 * 60 * 1000
    });
    const turnstilePresenceError = validateTurnstileToken(turnstileToken);

    if (Object.keys(nextErrors).length || antiSpamError || rateLimitError || dailyRateLimitError || duplicateError || turnstilePresenceError) {
      setFieldErrors(nextErrors);
      setError(
        antiSpamError ||
          rateLimitError ||
          dailyRateLimitError ||
          duplicateError ||
          turnstilePresenceError ||
          "Please correct the highlighted fields before sending your enquiry."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const turnstileVerificationError = await verifyTurnstileToken(turnstileToken);
      if (turnstileVerificationError) {
        throw new Error(turnstileVerificationError);
      }

      await createContactMessage({
        name: form.name,
        email: form.email,
        phone: form.phone,
        subject: form.subject,
        message: form.message,
        category: form.category
      });

      setSubmitted(true);
      setForm(initialState);
      setTurnstileToken("");
      setFieldErrors({});
      rememberSubmission("carnest-contact-form");
      rememberSubmissionEvent(contactKey, duplicateFingerprint);
    } catch (submitError) {
      setError(
        submitError instanceof Error &&
        [
          "Please correct the highlighted fields before sending your enquiry.",
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
    <form onSubmit={handleSubmit} className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
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
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Name</span>
          <Input
            name="name"
            value={form.name}
            onChange={(event) => setField("name", event.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.name)}
          />
          {fieldErrors.name ? <p className="text-sm text-red-700">{fieldErrors.name}</p> : null}
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Email</span>
          <Input
            name="email"
            type="email"
            value={form.email}
            onChange={(event) => setField("email", event.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {fieldErrors.email ? <p className="text-sm text-red-700">{fieldErrors.email}</p> : null}
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Phone</span>
          <Input
            name="phone"
            type="tel"
            value={form.phone}
            onChange={(event) => setField("phone", event.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.phone)}
          />
          {fieldErrors.phone ? <p className="text-sm text-red-700">{fieldErrors.phone}</p> : null}
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Subject</span>
          <Input
            name="subject"
            value={form.subject}
            onChange={(event) => setField("subject", event.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.subject)}
          />
          {fieldErrors.subject ? <p className="text-sm text-red-700">{fieldErrors.subject}</p> : null}
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-ink">Category</span>
          <select
            name="category"
            value={form.category}
            onChange={(event) =>
              setField("category", event.target.value as (typeof CONTACT_CATEGORY_OPTIONS)[number])
            }
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
            required
            aria-invalid={Boolean(fieldErrors.category)}
          >
            {CONTACT_CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {fieldErrors.category ? <p className="text-sm text-red-700">{fieldErrors.category}</p> : null}
        </label>
      </div>

      <label className="mt-4 block space-y-2">
        <span className="text-sm font-medium text-ink">Message</span>
        <Textarea
          name="message"
          value={form.message}
          onChange={(event) => setField("message", event.target.value)}
          required
          className="min-h-36"
          aria-invalid={Boolean(fieldErrors.message)}
        />
        {fieldErrors.message ? <p className="text-sm text-red-700">{fieldErrors.message}</p> : null}
      </label>

      <p className="mt-4 text-sm leading-6 text-ink/65">Our team will review your enquiry and respond directly.</p>
      <div className="mt-4">
        <TurnstileField token={turnstileToken} onTokenChange={setTurnstileToken} />
      </div>
      {error ? (
        <div className="mt-4 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {submitted ? (
        <div className="mt-4 rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Your enquiry has been sent
        </div>
      ) : null}

      <div className="mt-6">
        <Button type="submit" disabled={saving} className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white hover:bg-ink/90">
          {saving ? "Sending..." : "Send enquiry"}
        </Button>
      </div>
    </form>
  );
}
