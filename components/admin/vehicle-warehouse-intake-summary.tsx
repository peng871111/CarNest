"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getWarehouseIntakeByVehicleId } from "@/lib/data";
import { formatAdminDateTime } from "@/lib/utils";
import { WarehouseIntakeRecord } from "@/types";

export function VehicleWarehouseIntakeSummary({ vehicleId }: { vehicleId: string }) {
  const [intake, setIntake] = useState<WarehouseIntakeRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = await getWarehouseIntakeByVehicleId(vehicleId);
      if (cancelled) return;
      setIntake(result.items[0] ?? null);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  return (
    <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.25em] text-bronze">Warehouse intake</p>
      {loading ? (
        <p className="mt-4 text-sm text-ink/60">Loading intake status...</p>
      ) : intake ? (
        <div className="mt-4 space-y-3 text-sm text-ink/70">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Completed date</p>
            <p className="mt-1 text-ink">{intake.completedAt ? formatAdminDateTime(intake.completedAt) : "In progress"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Signed agreement</p>
            <p className="mt-1 text-ink">{intake.signature.signedAt ? "Signed" : "Pending"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Finance declaration</p>
            <p className="mt-1 text-ink">{intake.declarations.financeOwing}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Ownership verification</p>
            <p className="mt-1 text-ink">{intake.ownerDetails.ownershipVerification ? "Uploaded" : "Pending"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Condition report completed</p>
            <p className="mt-1 text-ink">{intake.photos.length ? "Yes" : "Pending photos"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Number of photos</p>
            <p className="mt-1 text-ink">{intake.photos.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">PDF available</p>
            <p className="mt-1 text-ink">{intake.signedPdfUrl ? "Yes" : "Pending"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Admin staff responsible</p>
            <p className="mt-1 text-ink">{intake.signature.adminStaffName || intake.adminStaffName || "Pending"}</p>
          </div>
          <Link
            href={`/admin/warehouse-intake/${intake.id}`}
            className="inline-flex rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
          >
            Open intake record
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-6 text-ink/60">No warehouse intake record is attached to this listing yet.</p>
          <Link
            href={`/admin/warehouse-intake/new?vehicleId=${vehicleId}`}
            className="inline-flex rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink/92"
          >
            Start warehouse intake
          </Link>
        </div>
      )}
    </div>
  );
}
