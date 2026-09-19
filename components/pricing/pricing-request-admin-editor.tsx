"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { PricingLeadRating, PricingNextAction, PricingRequest, PricingRequestStatus } from "@/types";

const STATUS_OPTIONS: PricingRequestStatus[] = ["NEW", "REPLIED", "CLOSED"];
const LEAD_RATING_OPTIONS: PricingLeadRating[] = ["HOT", "WARM", "COLD"];
const NEXT_ACTION_OPTIONS: PricingNextAction[] = ["Recommend warehouse", "Follow up later", "Not suitable"];

export function PricingRequestAdminEditor({ pricingRequest }: { pricingRequest: PricingRequest }) {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [status, setStatus] = useState<PricingRequestStatus>(pricingRequest.status);
  const [leadRating, setLeadRating] = useState<PricingLeadRating | "">(pricingRequest.leadRating ?? "");
  const [nextAction, setNextAction] = useState<PricingNextAction | "">(pricingRequest.nextAction ?? "");
  const [response, setResponse] = useState(pricingRequest.response ?? "");

  useEffect(() => {
    setStatus(pricingRequest.status);
    setLeadRating(pricingRequest.leadRating ?? "");
    setNextAction(pricingRequest.nextAction ?? "");
    setResponse(pricingRequest.response ?? "");
    setMessage(null);
  }, [pricingRequest]);

  async function handleSave() {
    if (busy) return;
    if (!firebaseUser) {
      setMessage({ type: "error", text: "Please sign in again before saving pricing actions." });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const idToken = await firebaseUser.getIdToken(true);
      const updateResponse = await fetch(`/api/admin/pricing/${encodeURIComponent(pricingRequest.id)}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          status,
          response,
          leadRating: leadRating || undefined,
          nextAction: nextAction || undefined
        })
      });

      const payload = await updateResponse.json().catch(() => ({} as { error?: string }));
      if (!updateResponse.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Unable to save pricing request.");
      }

      setMessage({ type: "success", text: "Pricing request saved." });
      router.replace(
        `/admin/pricing?write=success&status=${status}&pricingId=${pricingRequest.id}`
      );
      router.refresh();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to save pricing request."
      });
    } finally {
      setBusy(false);
    }
  }

  const unchanged =
    status === pricingRequest.status &&
    leadRating === (pricingRequest.leadRating ?? "") &&
    nextAction === (pricingRequest.nextAction ?? "") &&
    response === (pricingRequest.response ?? "");

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as PricingRequestStatus)}
          disabled={busy}
          className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-ink"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          value={leadRating}
          onChange={(event) => setLeadRating(event.target.value as PricingLeadRating | "")}
          disabled={busy}
          className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-ink"
        >
          <option value="">Lead rating</option>
          {LEAD_RATING_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          value={nextAction}
          onChange={(event) => setNextAction(event.target.value as PricingNextAction | "")}
          disabled={busy}
          className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-ink"
        >
          <option value="">Next action</option>
          {NEXT_ACTION_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={response}
        onChange={(event) => setResponse(event.target.value)}
        disabled={busy}
        rows={4}
        placeholder="Add a reply for the user or internal response summary."
        className="w-full rounded-[24px] border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-bronze"
      />
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={busy || unchanged}
        className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Saving..." : "Save"}
      </button>
      {message ? (
        <p className={`text-sm ${message.type === "error" ? "text-red-700" : "text-emerald-700"}`} role={message.type === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
