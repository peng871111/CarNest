"use client";

import { getOfferStatusLabel, getOfferStatusTone } from "@/lib/permissions";
import { OfferStatus } from "@/types";

export function OfferStatusBadge({ status }: { status: OfferStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getOfferStatusTone(status)}`}>
      {getOfferStatusLabel(status)}
    </span>
  );
}
