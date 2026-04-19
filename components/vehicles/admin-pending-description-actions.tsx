"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { approveVehiclePendingDescription, getVehiclePendingDescription, rejectVehiclePendingDescription } from "@/lib/data";
import { Vehicle } from "@/types";

export function AdminPendingDescriptionActions({ vehicle }: { vehicle: Pick<Vehicle, "id" | "ownerUid"> }) {
  const router = useRouter();
  const { appUser } = useAuth();
  const [busyAction, setBusyAction] = useState<"approve" | "reject" | "">("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pendingDescription, setPendingDescription] = useState("");
  const [loadingPending, setLoadingPending] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPendingDescription() {
      if (!appUser) return;

      setLoadingPending(true);
      try {
        const value = await getVehiclePendingDescription(vehicle.id, appUser, vehicle);
        if (!cancelled) {
          setPendingDescription(value);
          setError("");
        }
      } catch (pendingError) {
        if (!cancelled) {
          setError(pendingError instanceof Error ? pendingError.message : "We couldn't load the pending description right now.");
        }
      } finally {
        if (!cancelled) {
          setLoadingPending(false);
        }
      }
    }

    void loadPendingDescription();
    return () => {
      cancelled = true;
    };
  }, [appUser, vehicle]);

  if (!loadingPending && !pendingDescription) return null;

  async function handleApprove() {
    if (!appUser) return;
    setBusyAction("approve");
    setNotice("");
    setError("");

    try {
      await approveVehiclePendingDescription(vehicle.id, appUser, vehicle);
      setNotice("Pending description approved and published.");
      setPendingDescription("");
      router.refresh();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "We couldn't approve the description right now.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleReject() {
    if (!appUser) return;
    setBusyAction("reject");
    setNotice("");
    setError("");

    try {
      await rejectVehiclePendingDescription(vehicle.id, appUser, vehicle);
      setNotice("Pending description rejected and cleared.");
      setPendingDescription("");
      router.refresh();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "We couldn't reject the description right now.");
    } finally {
      setBusyAction("");
    }
  }

  return (
    <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.25em] text-bronze">Description review</p>
      <h2 className="mt-2 text-2xl font-semibold text-ink">Pending seller description</h2>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-ink/75">
        {loadingPending ? "Loading pending description..." : pendingDescription}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busyAction !== ""}
          onClick={() => void handleApprove()}
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busyAction === "approve" ? "Approving..." : "Approve description"}
        </button>
        <button
          type="button"
          disabled={busyAction !== ""}
          onClick={() => void handleReject()}
          className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busyAction === "reject" ? "Rejecting..." : "Reject description"}
        </button>
      </div>
      {notice ? <p className="mt-4 text-sm text-emerald-800">{notice}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-800">{error}</p> : null}
    </div>
  );
}
