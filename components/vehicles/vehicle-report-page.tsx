"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PublicConditionBodyMap } from "@/components/vehicles/public-condition-body-map";
import { useAuth } from "@/lib/auth";
import {
  buildBuyerFacingAdditionalChecks,
  buildBuyerFacingInspectorNotes,
  formatBuyerFacingConditionScore,
  getBuyerFacingConditionScores
} from "@/lib/vehicle-public-report";
import { Vehicle } from "@/types";
import { getVehicleDisplayReference } from "@/lib/utils";

const DISCLAIMER_LINES = [
  "CarNest Vehicle Condition Summary is provided as a complimentary buyer reference document only.",
  "This report reflects the information recorded at the time of inspection and is not a mechanical certification or warranty.",
  "CarNest recommends every buyer obtain an independent pre-purchase inspection before proceeding with a vehicle purchase."
] as const;

function DetailItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-[22px] border border-[#E7DCCB] bg-white/78 px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[#8A7657]">{label}</p>
      <p className="mt-2 text-sm text-[#221F1B]">{value ? String(value) : "Not provided"}</p>
    </div>
  );
}

function ScoreCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[28px] border border-[#D8BF93]/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] px-5 py-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#D8B36B]">{label}</p>
      <p className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">{value}</p>
    </div>
  );
}

function SectionCard({
  kicker,
  title,
  children
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[32px] border border-[#D9CCBB]/65 bg-[linear-gradient(180deg,#fffdfa_0%,#f6efe4_100%)] p-6 shadow-[0_24px_60px_rgba(31,24,18,0.08)] sm:p-7">
      <p className="text-[11px] uppercase tracking-[0.26em] text-[#B88A42]">{kicker}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#1F1B17]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function VehicleReportPage({ vehicle }: { vehicle: Vehicle }) {
  const { appUser, loading } = useAuth();
  const summary = vehicle.vehicleReportSummary;
  const scores = getBuyerFacingConditionScores(summary);
  const additionalChecks = buildBuyerFacingAdditionalChecks(vehicle);
  const inspectorNotes = buildBuyerFacingInspectorNotes(summary);
  const generatedAt = vehicle.vehicleReportGeneratedAt
    ? new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(vehicle.vehicleReportGeneratedAt))
    : "";
  const serviceHistoryText = [vehicle.serviceHistory, summary?.serviceRecordCondition].filter(Boolean).join(" | ") || "No service history notes recorded.";

  const vehicleInfo = [
    { label: "Year", value: vehicle.year },
    { label: "Registration", value: vehicle.rego || "Not provided" },
    { label: "VIN", value: vehicle.vin || "Not provided" },
    { label: "Make", value: vehicle.make || "Not provided" },
    { label: "Model", value: vehicle.model || "Not provided" },
    { label: "Variant", value: vehicle.variant || "Not provided" },
    { label: "Engine", value: "Not provided" },
    { label: "Chassis", value: vehicle.vin || "Not provided" },
    { label: "Fuel", value: vehicle.fuelType || "Not provided" },
    { label: "Transmission", value: vehicle.transmission || "Not provided" },
    { label: "Drive Type", value: vehicle.drivetrain || "Not provided" },
    { label: "Odometer", value: `${vehicle.mileage.toLocaleString()} km` },
    { label: "Body Type", value: vehicle.bodyType || "Not provided" },
    { label: "Colour", value: vehicle.colour || "Not provided" }
  ];

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
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
          <p className="text-xs uppercase tracking-[0.25em] text-bronze">CarNest Vehicle Condition Summary</p>
          <h1 className="mt-3 text-3xl font-semibold text-ink">Sign in to view the verified condition report</h1>
          <p className="mt-4 text-sm leading-6 text-ink/65">
            Create a CarNest account or sign in to view the buyer-facing Vehicle Condition Summary for this listing.
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
    <main className="-mx-6 min-h-screen bg-[linear-gradient(180deg,#0b0b0b_0%,#14110d_26%,#f7f1e7_26%,#f4ede2_100%)] px-6 pb-16 pt-10 text-[#1F1B17]">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="overflow-hidden rounded-[36px] border border-[#D6B77B]/28 bg-[radial-gradient(circle_at_top_right,rgba(216,179,107,0.22),transparent_24%),linear-gradient(180deg,rgba(15,15,15,0.98),rgba(24,21,18,0.96))] px-6 py-8 shadow-[0_32px_80px_rgba(0,0,0,0.34)] sm:px-8 sm:py-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-[#D8B36B]">CarNest Vehicle Condition Summary</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                {[vehicle.year, vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(" ").trim()}
              </h1>
              <p className="mt-3 text-sm text-white/64">{getVehicleDisplayReference(vehicle)}</p>
              {generatedAt ? <p className="mt-4 text-sm text-white/74">Report generated {generatedAt}</p> : null}
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/78">
                Premium buyer-facing inspection overview designed to highlight the vehicle’s exterior presentation, interior presentation, and mapped body condition notes.
              </p>
            </div>

            <div className="grid gap-4">
              <ScoreCard label="Exterior Condition" value={formatBuyerFacingConditionScore(scores.exterior)} />
              <ScoreCard label="Interior Condition" value={formatBuyerFacingConditionScore(scores.interior)} />
            </div>
          </div>
        </section>

        <SectionCard kicker="Vehicle Information" title="Vehicle Details">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {vehicleInfo.map((item) => (
              <DetailItem key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </SectionCard>

        <SectionCard kicker="Body Damage Map" title="Professional Panel Overview">
          <PublicConditionBodyMap bodyMap={summary?.bodyMap} note={summary?.damageConditionNotes || summary?.panelRepairNotes} />
          {summary?.damageImages?.length ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {summary.damageImages.map((image, index) => (
                <div key={`${image.url}-${index}`} className="overflow-hidden rounded-[24px] border border-[#E2D8CA] bg-white shadow-[0_10px_26px_rgba(31,24,18,0.06)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt={image.label} loading="lazy" className="aspect-[4/3] w-full object-cover object-center" />
                  <div className="px-4 py-4">
                    <p className="text-sm font-semibold text-[#221F1B]">{image.label}</p>
                    {image.note ? <p className="mt-1 text-sm leading-6 text-[#6E6256]">{image.note}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard kicker="Features / Equipment" title="Included Equipment">
          {vehicle.features.length ? (
            <div className="flex flex-wrap gap-3">
              {vehicle.features.map((feature) => (
                <span
                  key={feature}
                  className="rounded-full border border-[#DDCFBC] bg-white px-4 py-2 text-sm font-medium text-[#473E34]"
                >
                  {feature}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-7 text-[#6E6256]">No features or equipment notes recorded.</p>
          )}
        </SectionCard>

        <SectionCard kicker="Additional Checks" title="Supporting Checks">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {additionalChecks.map((item) => (
              <DetailItem key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </SectionCard>

        <SectionCard kicker="Service History" title="Service & Maintenance">
          <p className="text-sm leading-7 text-[#3E352C]">{serviceHistoryText}</p>
        </SectionCard>

        <SectionCard kicker="Inspector Notes" title="Inspection Commentary">
          <p className="text-sm leading-7 text-[#3E352C]">{inspectorNotes}</p>
        </SectionCard>

        <SectionCard kicker="Inspector Signature" title="Inspection Record">
          <div className="grid gap-4 md:grid-cols-2">
            <DetailItem label="Inspection Record" value="Digital sign-off recorded in the CarNest inspection workflow" />
            <DetailItem label="Report Date" value={generatedAt || "Pending"} />
          </div>
        </SectionCard>

        <SectionCard kicker="Important Notice" title="Buyer Guidance">
          <div className="space-y-3 text-sm leading-7 text-[#5F5346]">
            {DISCLAIMER_LINES.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
