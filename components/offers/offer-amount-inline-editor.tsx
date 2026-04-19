"use client";

import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

export function OfferAmountInlineEditor({
  amount,
  canEdit,
  busy = false,
  confirmLabel = "Confirm",
  showConfirmButton = true,
  onSave
}: {
  amount: number;
  canEdit?: boolean;
  busy?: boolean;
  confirmLabel?: string;
  showConfirmButton?: boolean;
  onSave?: (amount: number) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(amount));
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setDraft(String(amount));
    setEditing(false);
  }, [amount]);

  function cancelEdit() {
    setEditing(false);
    setDraft(String(amount));
    setLocalError("");
  }

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const normalizedAmount = Number(draft.trim());

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      setLocalError("Enter a valid amount.");
      return;
    }

    setLocalError("");
    await onSave?.(normalizedAmount);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  }

  if (!canEdit || !onSave) {
    return <p className="font-semibold text-ink">{formatCurrency(amount)}</p>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-left text-lg font-semibold text-ink transition hover:text-bronze"
      >
        {formatCurrency(amount)}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Input
        type="number"
        min="1"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        className="h-11 rounded-[18px] px-3 py-2"
      />
      {localError ? <p className="text-xs text-red-700">{localError}</p> : null}
      <div className="flex flex-wrap gap-2">
        {showConfirmButton ? (
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-ink px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Saving..." : confirmLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={cancelEdit}
          disabled={busy}
          className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
