"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthGateModal } from "@/components/auth/auth-gate-modal";
import { useAuth } from "@/lib/auth";
import { VEHICLE_CONDITION_CATEGORY_LABELS } from "@/lib/vehicle-condition-config";
import type { VehiclePublicReportSummary } from "@/types";

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
  const categoryEntries = reportSummary?.conditionCategories
    ? [
        ["documentationRecords", reportSummary.conditionCategories.documentationRecords.score],
        ["exteriorBody", reportSummary.conditionCategories.exteriorBody.score],
        ["mechanicalFunction", reportSummary.conditionCategories.mechanicalFunction.score],
        ["interiorCondition", reportSummary.conditionCategories.interiorCondition.score]
      ] as const
    : [];
  const hasValidReport = Boolean(reportAvailable && categoryEntries.length && categoryEntries.every(([, score]) => score?.trim()));

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
      console.error("Condition Overview open failed", error);
      setErrorMessage("Condition Overview temporarily unavailable. Please try again later.");
    } finally {
      setOpening(false);
    }
  }

  if (!hasValidReport) {
    return null;
  }

  return (
    <>
      {compact ? (
        <div className="mt-6 border-t border-black/6 pt-6">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-ink/45">CarNest Verified Condition</p>
              <div className="mt-3 space-y-2">
                {categoryEntries.map(([key, score]) => (
                  <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
                    <p className="text-sm font-medium text-ink/76">{VEHICLE_CONDITION_CATEGORY_LABELS[key]}</p>
                    <p className="text-sm font-semibold text-ink">{score} / 5.0</p>
                  </div>
                ))}
              </div>
              {generatedAt ? (
                <p className="mt-2 text-xs text-ink/50">
                  Updated {new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(generatedAt))}
                </p>
              ) : null}
            </div>
            <div className="sm:pt-0.5 sm:text-right">
              <button
                type="button"
                onClick={() => void handleOpenReport()}
                disabled={loading || opening}
                className="text-sm font-semibold text-ink underline decoration-black/20 underline-offset-4 transition hover:text-bronze hover:decoration-bronze disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Checking account..." : opening ? "Opening overview..." : "View Condition Overview →"}
              </button>
            </div>
          </div>
          {errorMessage ? <p className="mt-3 text-sm text-amber-700">{errorMessage}</p> : null}
        </div>
      ) : (
        <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
          <p className="text-xs uppercase tracking-[0.25em] text-bronze">CarNest Condition Overview</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">View verified vehicle condition summary</h2>
          <div className="mt-4 space-y-2 text-sm text-ink/70">
            {categoryEntries.map(([key, score]) => (
              <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                <span>{VEHICLE_CONDITION_CATEGORY_LABELS[key]}</span>
                <span className="font-semibold text-ink">{score} / 5.0</span>
              </div>
            ))}
            {generatedAt ? (
              <span className="rounded-full border border-black/8 bg-shell px-3 py-1.5 font-medium text-ink/72">
                Updated {new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(generatedAt))}
              </span>
            ) : null}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleOpenReport()}
              disabled={loading || opening || !reportAvailable}
              className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Checking account..." : opening ? "Opening overview..." : "Open Condition Overview"}
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
