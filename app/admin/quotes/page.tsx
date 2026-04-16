import { AdminShell } from "@/components/layout/admin-shell";
import { QuoteStatusActions } from "@/components/quotes/quote-status-actions";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { getQuotesData, getVehicleById } from "@/lib/data";
import { getVehicleDisplayReference } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminQuotesPage({
  searchParams
}: {
  searchParams?: Promise<{ write?: string; status?: string; quoteId?: string }>;
}) {
  const { items: quotes, error } = await getQuotesData();
  const vehiclesByQuote = await Promise.all(
    quotes.map(async (quote) => ({
      quoteId: quote.id,
      vehicle: quote.vehicleId ? await getVehicleById(quote.vehicleId) : null
    }))
  );
  const vehicleMap = new Map(vehiclesByQuote.map((entry) => [entry.quoteId, entry.vehicle]));
  const params = searchParams ? await searchParams : undefined;
  const writeStatus =
    params?.write === "success"
      ? `Quote status updated to ${params.status ?? "saved"}`
      : params?.write === "mock"
        ? "Quote update recorded"
        : "No recent updates";

  return (
    <AdminShell title="Quotes" description="Track seller service quote requests and move each one through the CarNest response pipeline.">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">Quotes loaded: {quotes.length}</div>
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          Recent activity: {writeStatus}
        </div>
      </div>

      {error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
          Something went wrong. Please try again.
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
          {quotes.length ? (
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
