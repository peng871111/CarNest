"use client";

import { DealerApplication } from "@/types";

function getDealerApplicationStatusTone(status: DealerApplication["status"]) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-red-200 bg-red-50 text-red-700";
  if (status === "info_requested") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function getDealerApplicationStatusLabel(status: DealerApplication["status"]) {
  if (status === "info_requested") return "Info requested";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function DealerApplicationStatusBadge({ status }: { status: DealerApplication["status"] }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getDealerApplicationStatusTone(status)}`}>
      {getDealerApplicationStatusLabel(status)}
    </span>
  );
}
