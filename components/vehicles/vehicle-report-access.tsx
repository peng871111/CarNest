"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthGateModal } from "@/components/auth/auth-gate-modal";
import { useAuth } from "@/lib/auth";

export function VehicleReportAccess({
  vehicleId,
  reportAvailable,
  generatedAt,
  conditionRating,
  compact = false
}: {
  vehicleId: string;
  reportAvailable?: boolean;
  generatedAt?: string;
  conditionRating?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const { appUser, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [opening, setOpening] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const hasValidReport = Boolean(reportAvailable && conditionRating?.trim());

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
      setErrorMessage(error instanceof Error ? error.message : "We couldn't open the CarNest Vehicle Report.");
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
              <p className="text-xs uppercase tracking-[0.22em] text-ink/45">CarNest Verified Rating</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{conditionRating}/5.0</p>
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
                {loading ? "Checking account..." : opening ? "Opening report..." : "View Vehicle Report →"}
              </button>
            </div>
          </div>
          {errorMessage ? <p className="mt-3 text-sm text-amber-700">{errorMessage}</p> : null}
        </div>
      ) : (
        <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
          <p className="text-xs uppercase tracking-[0.25em] text-bronze">CarNest Vehicle Report</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">View verified vehicle condition summary</h2>
          <p className="mt-3 text-sm leading-6 text-ink/65">
            Open the buyer-facing CarNest Vehicle Report for documented condition details, declarations, and supporting damage images.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink/55">
            {conditionRating ? (
              <span className="rounded-full border border-black/8 bg-shell px-3 py-1.5 font-medium text-ink/72">
                Rating {conditionRating}
              </span>
            ) : null}
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
              {loading ? "Checking account..." : opening ? "Opening report..." : "Open Vehicle Report"}
            </button>
            <p className="text-xs leading-5 text-ink/52">
              Sign in or create a CarNest account to access this report.
            </p>
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
