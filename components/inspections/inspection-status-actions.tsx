"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { updateInspectionRequestStatus } from "@/lib/data";
import { InspectionRequest, InspectionRequestStatus } from "@/types";

const INSPECTION_STATUS_OPTIONS: InspectionRequestStatus[] = ["NEW", "CONTACTED", "BOOKED", "CLOSED"];

export function InspectionStatusActions({ inspectionRequest }: { inspectionRequest: InspectionRequest }) {
  const router = useRouter();
  const { appUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<InspectionRequestStatus>(inspectionRequest.status);

  useEffect(() => {
    setStatus(inspectionRequest.status);
  }, [inspectionRequest.status]);

  async function handleSave() {
    if (!appUser) return;
    setBusy(true);

    try {
      const result = await updateInspectionRequestStatus(inspectionRequest.id, status, appUser, inspectionRequest);
      router.replace(
        `/admin/inspections?write=${result.writeSucceeded ? "success" : "mock"}&status=${status}&inspectionId=${inspectionRequest.id}`
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={status}
        onChange={(event) => setStatus(event.target.value as InspectionRequestStatus)}
        disabled={busy}
        className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-ink"
      >
        {INSPECTION_STATUS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={busy || status === inspectionRequest.status}
        className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
