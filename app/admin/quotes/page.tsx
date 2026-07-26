"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/layout/admin-shell";
import { QuoteStatusActions } from "@/components/quotes/quote-status-actions";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { getQuotesData, getVehicleById } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { getVehicleDisplayReference } from "@/lib/utils";
import type { Quote, Vehicle } from "@/types";

const QUOTES_PAGE_TITLE = "Quotes";
const QUOTES_PAGE_DESCRIPTION = "Track seller service quote requests and move each one through the CarNest response pipeline.";

function AdminQuotesContent() {
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const { appUser, loading: authLoading } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [vehicleLookup, setVehicleLookup] = useState<Record<string, Vehicle | null>>({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [loadError, setLoadError] = useState("");
  const canManageQuotes = hasAdminPermission(appUser, "manageQuotes");

  useEffect(() => {
    let cancelled = false;

    async function loadQuotes() {
      if (authLoading) return;
      if (!canManageQuotes) {
        setQuotes([]);
        setVehicleLookup({});
        setLoadError("");
        setLoadingQuotes(false);
        return;
      }

      setLoadingQuotes(true);
      setLoadError("");

      try {
        const result = await getQuotesData();
        if (cancelled) return;

        if (result.error) {
          console.error("[admin-quotes] Quote request read failed.", {
            error: result.error
          });
          setQuotes([]);
          setVehicleLookup({});
          setLoadError("Quote requests could not be loaded right now. Please try again.");
          return;
        }

        setQuotes(result.items);
        const vehiclesByQuote = await Promise.all(
          result.items.map(async (quote) => {
            if (!quote.vehicleId) return [quote.id, null] as const;
            const vehicle = await getVehicleById(quote.vehicleId).catch((error) => {
              console.warn("[admin-quotes] Linked vehicle lookup failed.", {
                quoteId: quote.id,
                vehicleId: quote.vehicleId,
                error: error instanceof Error ? error.message : String(error)
              });
              return null;
            });
            return [quote.id, vehicle] as const;
          })
        );

        if (!cancelled) {
          setVehicleLookup(Object.fromEntries(vehiclesByQuote));
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[admin-quotes] Quote page load failed.", {
            error: error instanceof Error ? error.message : String(error)
          });
          setQuotes([]);
          setVehicleLookup({});
          setLoadError("Quote requests could not be loaded right now. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoadingQuotes(false);
        }
      }
    }

    void loadQuotes();

    return () => {
      cancelled = true;
    };
  }, [authLoading, canManageQuotes, searchParamsKey]);

  const vehicleMap = useMemo(() => new Map(Object.entries(vehicleLookup)), [vehicleLookup]);
  const writeStatus =
    searchParams.get("write") === "success"
      ? `Quote status updated to ${searchParams.get("status") ?? "saved"}`
      : searchParams.get("write") === "mock"
        ? "Quote update recorded"
        : "No recent updates";

  return (
    <AdminShell
      title={QUOTES_PAGE_TITLE}
      description={QUOTES_PAGE_DESCRIPTION}
      requiredPermission="manageQuotes"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          Quotes loaded: {loadingQuotes ? "Loading..." : quotes.length}
        </div>
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          Recent activity: {writeStatus}
        </div>
      </div>

      {loadError ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
          {loadError}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[32px] border border-black/5 bg-white shadow-panel">
        <div className="grid grid-cols-[1fr,1fr,1.2fr,1fr,1fr,220px] gap-4 border-b border-black/5 bg-shell px-6 py-4 text-xs uppercase tracking-[0.22em] text-ink/55">
          <span>Seller</span>
          <span>Email</span>
          <span>Vehicle</span>
          <span>Notes</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        <div>
          {loadingQuotes ? (
            <div className="px-6 py-12 text-sm text-ink/60">Loading quote requests...</div>
          ) : loadError ? (
            <div className="px-6 py-12 text-sm text-ink/60">Quote requests could not be displayed.</div>
          ) : quotes.length ? (
            quotes.map((quote) => {
              const vehicle = vehicleMap.get(quote.id);
              const vehicleReference = quote.vehicleId
                ? vehicle
                  ? getVehicleDisplayReference(vehicle)
                  : getVehicleDisplayReference(quote.vehicleId)
                : null;

              return (
                <div key={quote.id} className="grid grid-cols-[1fr,1fr,1.2fr,1fr,1fr,220px] gap-4 border-b border-black/5 px-6 py-5 text-sm last:border-b-0">
                  <div>
                    <p className="font-semibold text-ink">{quote.sellerName}</p>
                    <p className="mt-1 text-ink/55">{quote.createdAt ? new Date(quote.createdAt).toLocaleString("en-AU") : "Just now"}</p>
                  </div>
                  <div className="text-ink/70">{quote.sellerEmail}</div>
                  <div>
                    <p className="font-semibold text-ink">
                      {quote.vehicleYear} {quote.vehicleMake} {quote.vehicleModel}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink/45">
                      {vehicleReference ? `Vehicle Ref: ${vehicleReference}` : "Vehicle Ref pending"}
                    </p>
                  </div>
                  <div className="text-ink/70">{quote.notes || "No extra notes provided."}</div>
                  <div>
                    <QuoteStatusBadge status={quote.status} />
                  </div>
                  <div>
                    <QuoteStatusActions quote={quote} />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-6 py-12 text-sm text-ink/60">
              No quote requests have been submitted yet.
            </div>
          )}
        </div>
      </section>
    </AdminShell>
  );
}

export default function AdminQuotesPage() {
  return (
    <Suspense
      fallback={
        <AdminShell
          title={QUOTES_PAGE_TITLE}
          description={QUOTES_PAGE_DESCRIPTION}
          requiredPermission="manageQuotes"
        >
          <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
            Loading quote requests...
          </div>
        </AdminShell>
      }
    >
      <AdminQuotesContent />
    </Suspense>
  );
}
