"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthGateModal } from "@/components/auth/auth-gate-modal";
import { useAuth } from "@/lib/auth";
import {
  formatBuyerFacingConditionScore,
  getBuyerFacingConditionScores,
  hasBuyerFacingConditionSummary
} from "@/lib/vehicle-public-report";
import type { VehiclePublicReportSummary } from "@/types";

function ScoreLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-[#E5D9CA] bg-white/80 px-3 py-2.5">
      <span className="text-sm font-medium text-[#5E5245]">{label}</span>
      <span className="text-sm font-semibold text-[#1F1F1D]">{value}</span>
    </div>
  );
}

export function VehicleReportAccess({
  vehicleId,
  reportAvailable,
  generatedAt,
  reportSummary,
  compact = false
}: {
  vehicleId: string;
  reportAvailable?: boolean;
  generatedAt?: string;
  reportSummary?: VehiclePublicReportSummary;
  compact?: boolean;
}) {
  const router = useRouter();
  const { appUser, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [opening, setOpening] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const scores = getBuyerFacingConditionScores(reportSummary);
  const hasValidReport = hasBuyerFacingConditionSummary({ reportAvailable, vehicleReportSummary: reportSummary });

  async function handleOpenReport() {
    if (!hasValidReport) return;
    if (!appUser) {
      setShowAuthModal(true);
      return;
    }

    try {
      setOpening(true);
      setErrorMessage("");
      router.push(`/vehicle-report/${vehicleId}`);
    } catch (error) {
      console.error("Condition Summary open failed", error);
      setErrorMessage("Condition Summary temporarily unavailable. Please try again later.");
    } finally {
      setOpening(false);
    }
  }

  if (!hasValidReport) {
    return null;
  }

  const updatedLabel = generatedAt
    ? `Updated ${new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(generatedAt))}`
    : "";

  return (
    <>
      {compact ? (
        <div className="mt-6 rounded-[28px] border border-[#DCCDBA]/50 bg-[linear-gradient(180deg,#fffdf9_0%,#f7f1e7_100%)] p-5">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#B8893F]">CarNest Vehicle Condition Summary</p>
              <div className="mt-3 space-y-2.5">
                <ScoreLine label="Exterior Condition" value={formatBuyerFacingConditionScore(scores.exterior)} />
                <ScoreLine label="Interior Condition" value={formatBuyerFacingConditionScore(scores.interior)} />
              </div>
              {updatedLabel ? <p className="mt-3 text-xs text-[#77695A]">{updatedLabel}</p> : null}
            </div>
            <div className="sm:pt-0.5 sm:text-right">
              <button
                type="button"
                onClick={() => void handleOpenReport()}
                disabled={loading || opening}
                className="rounded-full bg-[#1B1B1A] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2A2825] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Checking account..." : opening ? "Opening summary..." : "View Condition Summary"}
              </button>
            </div>
          </div>
          {errorMessage ? <p className="mt-3 text-sm text-amber-700">{errorMessage}</p> : null}
        </div>
      ) : (
        <div className="rounded-[32px] border border-[#DCCDBA]/50 bg-[linear-gradient(180deg,#fffdf9_0%,#f7f1e7_100%)] p-6 shadow-panel">
          <p className="text-xs uppercase tracking-[0.24em] text-[#B8893F]">CarNest Vehicle Condition Summary</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1F1F1D]">View the buyer-facing condition report</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ScoreLine label="Exterior Condition" value={formatBuyerFacingConditionScore(scores.exterior)} />
            <ScoreLine label="Interior Condition" value={formatBuyerFacingConditionScore(scores.interior)} />
          </div>
          {updatedLabel ? <p className="mt-4 text-sm text-[#77695A]">{updatedLabel}</p> : null}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleOpenReport()}
              disabled={loading || opening || !reportAvailable}
              className="rounded-full bg-[#1B1B1A] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2A2825] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Checking account..." : opening ? "Opening summary..." : "Open Condition Summary"}
            </button>
          </div>
          {errorMessage ? <p className="mt-3 text-sm text-amber-700">{errorMessage}</p> : null}
        </div>
      )}
      <AuthGateModal
        open={showAuthModal}
        action="default"
        redirectPath={`/inventory/${vehicleId}`}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
}
