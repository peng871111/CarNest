"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { fetchVehicleReportBlob } from "@/lib/storage";
import { Vehicle } from "@/types";
import { formatCalendarDate, formatCurrency, getVehicleDisplayReference } from "@/lib/utils";

const RATING_GUIDE: Array<[string, string]> = [
  ["5.0", "Original paint and panels, no exterior damage, no noticeable interior wear, complete service history, complete keys, mechanically sound, still under warranty."],
  ["4.5", "Original paint and panels, minor stone chips / small wheel rash / very small marks only, light normal interior usage, complete service history, complete keys, mechanically sound."],
  ["4.0", "Some paint or cosmetic repair, wheel rash possible, light interior usage marks, no major wear, complete service history, complete keys, mechanically sound."],
  ["3.5", "Small dents or scratches, some panel repair, wheel rash, visible interior usage marks, service history may be incomplete, keys may be incomplete, mechanically sound."],
  ["3.0", "Visible scratches, dents, or unrepaired paint/panel issues, wheel rash, obvious interior usage marks, service history may be incomplete, keys may be incomplete, mechanically sound."],
  ["2.5", "Noticeable exterior paint/panel damage, unrepaired dents/scratches, wheel damage, interior wear, incomplete service history, incomplete keys, possible mechanical concerns. Vehicles assessed below a CarNest Condition Rating of 2.5 are not eligible to be advertised on the CarNest platform."]
];

const DISCLAIMER_LINES = [
  "CarNest Vehicle Report is provided as a complimentary buyer reference document and is intended to assist prospective buyers in understanding the vehicle's disclosed condition and presentation.",
  "This Vehicle Report is provided free of charge by CarNest for informational purposes only.",
  "The report is intended as a general summary of the vehicle condition based on information supplied and observations recorded at the time of preparation.",
  "CarNest strongly recommends that all prospective buyers arrange their own independent mechanical inspection and assessment before purchasing any vehicle.",
  "While reasonable care has been taken in preparing this report, CarNest does not guarantee the completeness, accuracy, or ongoing validity of any information contained within it.",
  "This report should not be relied upon as a substitute for professional mechanical advice or a pre-purchase inspection.",
  "To the maximum extent permitted by law, CarNest accepts no responsibility or liability for any loss, damage, cost, or decision arising directly or indirectly from reliance on this report."
] as const;

function DetailItem({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.22em] text-ink/45">{label}</p>
      <p className="mt-2 text-sm text-ink">{String(value)}</p>
    </div>
  );
}

export function VehicleReportPage({ vehicle }: { vehicle: Vehicle }) {
  const { appUser, loading } = useAuth();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleDownloadPdf() {
    if (!vehicle.vehicleReportStoragePath) return;

    try {
      setDownloadingPdf(true);
      setErrorMessage("");
      const blob = await fetchVehicleReportBlob(vehicle.vehicleReportStoragePath);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = vehicle.vehicleReportFileName || `${getVehicleDisplayReference(vehicle)}-vehicle-report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      console.error("Vehicle Report PDF download failed", error);
      setErrorMessage("Vehicle Report temporarily unavailable. Please try again later.");
    } finally {
      setDownloadingPdf(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-[28px] border border-black/5 bg-white p-8 shadow-panel">
          <p className="text-sm text-ink/60">Checking your CarNest account…</p>
        </div>
      </main>
    );
  }

  if (!appUser) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-[28px] border border-black/5 bg-white p-8 shadow-panel">
          <p className="text-xs uppercase tracking-[0.25em] text-bronze">CarNest Vehicle Report</p>
          <h1 className="mt-3 text-3xl font-semibold text-ink">Sign in to view the verified condition summary</h1>
          <p className="mt-4 text-sm leading-6 text-ink/65">
            Create a CarNest account or sign in to view the buyer-facing Vehicle Report for this listing.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/login?redirect=${encodeURIComponent(`/vehicle-report/${vehicle.id}`)}`}
              className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/90"
            >
              Sign in
            </Link>
            <Link
              href={`/register?redirect=${encodeURIComponent(`/vehicle-report/${vehicle.id}`)}`}
              className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
            >
              Create account
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="rounded-[30px] border border-black/5 bg-white p-6 shadow-panel sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-bronze">CarNest Vehicle Report</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink">
              {[vehicle.year, vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(" ").trim()}
            </h1>
            <p className="mt-2 text-sm text-ink/60">{getVehicleDisplayReference(vehicle)}</p>
          </div>
          <div className="rounded-[22px] border border-black/8 bg-shell px-5 py-4 text-right">
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">CarNest Verified Rating</p>
            <p className="mt-2 text-3xl font-semibold text-ink">{vehicle.vehicleConditionRating ? `${vehicle.vehicleConditionRating}/5.0` : "Pending"}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {vehicle.vehicleReportStoragePath ? (
            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={downloadingPdf}
              className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloadingPdf ? "Downloading PDF..." : "Download PDF"}
            </button>
          ) : (
            <p className="text-sm text-ink/52">PDF pending</p>
          )}
          {vehicle.vehicleReportGeneratedAt ? (
            <p className="text-xs text-ink/50">Updated {formatCalendarDate(vehicle.vehicleReportGeneratedAt)}</p>
          ) : null}
        </div>
        {errorMessage ? <p className="mt-3 text-sm text-amber-700">{errorMessage}</p> : null}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <DetailItem label="Asking price" value={formatCurrency(vehicle.price)} />
          <DetailItem label="Fuel type" value={vehicle.fuelType} />
          <DetailItem label="Transmission" value={vehicle.transmission} />
          <DetailItem label="Drivetrain" value={vehicle.drivetrain} />
          <DetailItem label="Odometer" value={`${vehicle.mileage.toLocaleString()} km`} />
          <DetailItem label="Keys" value={vehicle.keyCount} />
          <DetailItem label="Service history" value={vehicle.serviceHistory} />
          <DetailItem label="Warranty status" value={vehicle.vehicleReportSummary?.warrantyStatus} />
          <DetailItem label="Number of owners" value={vehicle.vehicleReportSummary?.numberOfOwners} />
          <DetailItem label="Accident declaration" value={vehicle.vehicleReportSummary?.accidentDeclaration} />
          <DetailItem label="Finance owing declaration" value={vehicle.vehicleReportSummary?.financeOwingDeclaration} />
          <DetailItem label="Odometer issue declaration" value={vehicle.vehicleReportSummary?.odometerIssueDeclaration} />
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="space-y-5">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-bronze">Exterior / body condition</p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink/72">{vehicle.vehicleReportSummary?.exteriorCondition || "Not provided"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-bronze">Panel repair / repaint notes</p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink/72">{vehicle.vehicleReportSummary?.panelRepairNotes || "Not provided"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-bronze">Wheel condition</p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink/72">{vehicle.vehicleReportSummary?.wheelCondition || "Not provided"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-bronze">Interior condition</p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink/72">{vehicle.vehicleReportSummary?.interiorCondition || "Not provided"}</p>
            </div>
          </div>
          <div className="space-y-5">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-bronze">Mechanical condition</p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink/72">{vehicle.vehicleReportSummary?.mechanicalCondition || "Not provided"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-bronze">Service record condition</p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink/72">{vehicle.vehicleReportSummary?.serviceRecordCondition || "Not provided"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-bronze">Key condition</p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink/72">{vehicle.vehicleReportSummary?.keyCondition || "Not provided"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-bronze">RWC cooperation</p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink/72">{vehicle.vehicleReportSummary?.rwcCooperation?.replace(/_/g, " ") || "Not provided"}</p>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <p className="text-xs uppercase tracking-[0.25em] text-bronze">Damage / condition notes</p>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink/72">
            {vehicle.vehicleReportSummary?.damageConditionNotes || "No additional damage notes recorded."}
          </p>
          {vehicle.vehicleReportSummary?.damageImages?.length ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {vehicle.vehicleReportSummary.damageImages.map((image, index) => (
                <div key={`${image.url}-${index}`} className="overflow-hidden rounded-[22px] border border-black/6 bg-shell">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt={image.label} loading="lazy" className="aspect-[4/3] w-full object-cover object-center" />
                  <div className="px-4 py-3">
                    <p className="text-sm font-semibold text-ink">{image.label}</p>
                    {image.note ? <p className="mt-1 text-sm leading-5 text-ink/62">{image.note}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mt-10">
          <p className="text-xs uppercase tracking-[0.25em] text-bronze">CarNest condition rating guide</p>
          <div className="mt-4 space-y-4">
            {RATING_GUIDE.map(([rating, description]) => (
              <div key={rating} className="rounded-[18px] border border-black/6 bg-shell px-4 py-4">
                <p className="text-sm font-semibold text-ink">{rating}</p>
                <p className="mt-2 text-sm leading-6 text-ink/68">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <p className="text-xs uppercase tracking-[0.25em] text-bronze">DISCLAIMER</p>
          <div className="mt-3 space-y-3 text-sm leading-6 text-ink/70">
            {DISCLAIMER_LINES.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
