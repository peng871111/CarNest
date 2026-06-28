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

function SummaryLine({
  label,
  value,
  compact
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
      <div className="flex items-end gap-3 overflow-hidden">
        <span className={compact ? "shrink-0 text-sm font-medium text-[#4F453A]" : "shrink-0 text-base font-medium text-[#4F453A]"}>{label}</span>
        <span className="mb-1 w-full border-b border-dotted border-[#D7C9B6]" />
      </div>
      <span className={compact ? "text-sm font-semibold text-[#1F1F1D]" : "text-base font-semibold text-[#1F1F1D]"}>{value}</span>
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
        <div className="mt-6 rounded-[28px] border border-[#DDD1C2]/65 bg-[linear-gradient(180deg,#fffdfa_0%,#f6f0e7_100%)] p-5 shadow-[0_18px_40px_rgba(31,24,18,0.06)]">
          <div className="max-w-xl">
            <div className="border-t border-[#E4D9CA]" />
            <p className="pt-4 text-[11px] uppercase tracking-[0.28em] text-[#B8893F]">CarNest Verified Condition</p>
            <div className="mt-5 space-y-4">
              <SummaryLine label="Exterior & Body" value={formatBuyerFacingConditionScore(scores.exterior)} compact />
              <SummaryLine label="Interior Condition" value={formatBuyerFacingConditionScore(scores.interior)} compact />
            </div>
            {updatedLabel ? <p className="mt-5 text-xs text-[#77695A]">{updatedLabel}</p> : null}
            <div className="mt-5 border-t border-[#E4D9CA] pt-5">
              <button
                type="button"
                onClick={() => void handleOpenReport()}
                disabled={loading || opening}
                className="flex w-full items-center justify-between rounded-[18px] border border-[#D8D8D8] bg-white px-4 py-3 text-sm font-medium text-[#1B1B1A] transition hover:border-[#C8C8C8] hover:bg-[#FCFCFC] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{loading ? "Checking account..." : opening ? "Opening summary..." : "View Condition Summary"}</span>
                <span aria-hidden="true" className="text-base text-[#55514C]">→</span>
              </button>
            </div>
          </div>
          {errorMessage ? <p className="mt-3 text-sm text-amber-700">{errorMessage}</p> : null}
        </div>
      ) : (
        <div className="rounded-[32px] border border-[#DDD1C2]/65 bg-[linear-gradient(180deg,#fffdfa_0%,#f6f0e7_100%)] p-7 shadow-panel">
          <div className="max-w-2xl">
            <div className="border-t border-[#E4D9CA]" />
            <p className="pt-5 text-xs uppercase tracking-[0.3em] text-[#B8893F]">CarNest Verified Condition</p>
            <div className="mt-6 space-y-4">
              <SummaryLine label="Exterior & Body" value={formatBuyerFacingConditionScore(scores.exterior)} />
              <SummaryLine label="Interior Condition" value={formatBuyerFacingConditionScore(scores.interior)} />
            </div>
          </div>
          {updatedLabel ? <p className="mt-6 text-sm text-[#77695A]">{updatedLabel}</p> : null}
          <div className="mt-6 border-t border-[#E4D9CA] pt-6">
            <button
              type="button"
              onClick={() => void handleOpenReport()}
              disabled={loading || opening || !reportAvailable}
              className="flex w-full items-center justify-between rounded-[20px] border border-[#D8D8D8] bg-white px-5 py-4 text-sm font-medium text-[#1B1B1A] transition hover:border-[#C8C8C8] hover:bg-[#FCFCFC] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>{loading ? "Checking account..." : opening ? "Opening summary..." : "View Condition Summary"}</span>
              <span aria-hidden="true" className="text-base text-[#55514C]">→</span>
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
