"use client";

import { useState } from "react";
import { AuthGateModal } from "@/components/auth/auth-gate-modal";
import { useAuth } from "@/lib/auth";
import { fetchVehicleReportBlob } from "@/lib/storage";

export function VehicleReportAccess({
  vehicleId,
  storagePath,
  fileName,
  generatedAt,
  conditionRating
}: {
  vehicleId: string;
  storagePath?: string;
  fileName?: string;
  generatedAt?: string;
  conditionRating?: string;
}) {
  const { appUser, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [opening, setOpening] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!storagePath) return null;

  async function handleOpenReport() {
    if (!appUser) {
      setShowAuthModal(true);
      return;
    }

    try {
      setOpening(true);
      setErrorMessage("");
      const blob = await fetchVehicleReportBlob(storagePath!);
      const objectUrl = URL.createObjectURL(blob);
      const newWindow = window.open(objectUrl, "_blank", "noopener,noreferrer");
      if (!newWindow) {
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = fileName || "carnest-vehicle-report.pdf";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't open the CarNest Vehicle Report.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <>
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
            disabled={loading || opening}
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
      <AuthGateModal
        open={showAuthModal}
        action="default"
        redirectPath={`/inventory/${vehicleId}`}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
}
