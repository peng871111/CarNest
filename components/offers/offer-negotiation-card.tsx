"use client";

import { FormEvent, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

export function OfferNegotiationCard({
  title,
  description,
  currentAmount,
  buttonLabel,
  busy = false,
  initialDraft,
  onConfirm,
  onCancel
}: {
  title: string;
  description: string;
  currentAmount: number;
  buttonLabel: string;
  busy?: boolean;
  initialDraft?: number;
  onConfirm: (amount: number) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState(initialDraft ? String(initialDraft) : "");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setDraft(initialDraft ? String(initialDraft) : "");
    setLocalError("");
  }, [initialDraft]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedAmount = Number(draft.trim());

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      setLocalError("Enter a valid offer amount.");
      return;
    }

    setLocalError("");
    await onConfirm(normalizedAmount);
  }

  return (
    <div className="rounded-[22px] border border-black/5 bg-shell p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-bronze">{title}</p>
      <p className="mt-2 text-sm leading-6 text-ink/66">{description}</p>
      <div className="mt-4 rounded-[18px] border border-black/5 bg-white px-4 py-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-ink/45">Current negotiated amount</p>
        <p className="mt-2 text-xl font-semibold text-ink">{formatCurrency(currentAmount)}</p>
      </div>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink">Enter a revised offer amount</span>
          <Input
            type="number"
            min="1"
            inputMode="numeric"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={String(currentAmount)}
            className="max-w-[240px]"
          />
        </label>
        {localError ? <p className="text-sm text-red-700">{localError}</p> : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Saving..." : buttonLabel}
          </button>
          {onCancel ? (
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
