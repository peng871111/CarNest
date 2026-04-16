"use client";

import { getInspectionRequestStatusLabel, getInspectionRequestStatusTone } from "@/lib/permissions";
import { InspectionRequestStatus } from "@/types";

export function InspectionStatusBadge({ status }: { status: InspectionRequestStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getInspectionRequestStatusTone(status)}`}>
      {getInspectionRequestStatusLabel(status)}
    </span>
  );
}
