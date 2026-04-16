"use client";

import { getQuoteStatusLabel, getQuoteStatusTone } from "@/lib/permissions";
import { QuoteStatus } from "@/types";

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getQuoteStatusTone(status)}`}>
      {getQuoteStatusLabel(status)}
    </span>
  );
}
