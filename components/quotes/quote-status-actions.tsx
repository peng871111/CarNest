"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { updateQuoteStatus } from "@/lib/data";
import { Quote, QuoteStatus } from "@/types";

const QUOTE_STATUS_OPTIONS: QuoteStatus[] = ["NEW", "CONTACTED", "QUOTED", "CLOSED"];

export function QuoteStatusActions({ quote }: { quote: Quote }) {
  const router = useRouter();
  const { appUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<QuoteStatus>(quote.status);

  useEffect(() => {
    setStatus(quote.status);
  }, [quote.status]);

  async function handleSave() {
    if (!appUser) return;
    setBusy(true);

    try {
      const result = await updateQuoteStatus(quote.id, status, appUser, quote);
      router.replace(`/admin/quotes?write=${result.writeSucceeded ? "success" : "mock"}&status=${status}&quoteId=${quote.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={status}
        onChange={(event) => setStatus(event.target.value as QuoteStatus)}
        disabled={busy}
        className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-ink"
      >
        {QUOTE_STATUS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={busy || status === quote.status}
        className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
