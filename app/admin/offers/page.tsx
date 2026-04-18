import { AdminShell } from "@/components/layout/admin-shell";
import { OfferStatusActions } from "@/components/offers/offer-status-actions";
import { OfferStatusBadge } from "@/components/offers/offer-status-badge";
import { getOffersData, getVehicleById } from "@/lib/data";
import { formatAdminDateTime, formatCurrency, getVehicleDisplayReference } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOffersPage({
  searchParams
}: {
  searchParams?: Promise<{ write?: string; status?: string; offerId?: string }>;
}) {
  const { items: offers, error } = await getOffersData();
  const vehiclesByOffer = await Promise.all(
    offers.map(async (offer) => ({
      offerId: offer.id,
      vehicle: offer.vehicleId ? await getVehicleById(offer.vehicleId) : null
    }))
  );
  const vehicleMap = new Map(vehiclesByOffer.map((entry) => [entry.offerId, entry.vehicle]));
  const params = searchParams ? await searchParams : undefined;
  const writeStatus =
    params?.write === "success"
      ? params.status === "accepted_pending_buyer_confirmation"
        ? "Offer accepted and vehicle moved under offer"
        : params.status === "rejected"
          ? "Offer rejected"
          : params.status === "buyer_confirmed"
            ? "Buyer confirmed the accepted offer"
            : params.status === "buyer_declined"
              ? "Buyer declined the accepted offer"
          : "Offer updated"
      : params?.write === "mock"
        ? "Offer update recorded"
        : "No recent updates";

  return (
    <AdminShell title="Offers" description="Review every incoming offer and update its progression across the marketplace.">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">Offers loaded: {offers.length}</div>
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
        <div className="grid grid-cols-[1.4fr,1fr,1fr,1fr,280px] gap-4 border-b border-black/5 bg-shell px-6 py-4 text-xs uppercase tracking-[0.22em] text-ink/55">
          <span>Vehicle</span>
          <span>Buyer</span>
          <span>Offer</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        <div>
          {offers.length ? (
            offers.map((offer) => {
              const vehicle = vehicleMap.get(offer.id);
              const vehicleReference = vehicle
                ? getVehicleDisplayReference(vehicle)
                : getVehicleDisplayReference(offer.vehicleId);

              return (
                <div key={offer.id} className="grid grid-cols-[1.4fr,1fr,1fr,1fr,280px] gap-4 border-b border-black/5 px-6 py-5 text-sm last:border-b-0">
                  <div>
                    <p className="font-semibold text-ink">{offer.vehicleTitle}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink/45">Vehicle Ref: {vehicleReference}</p>
                    <p className="mt-1 text-ink/55">Asking price: {formatCurrency(offer.vehiclePrice)}</p>
                  </div>
                  <div>
                    <p className="font-medium text-ink">{offer.buyerName}</p>
                    <p className="mt-1 text-ink/55">{offer.buyerEmail}</p>
                    <p className="mt-1 text-ink/55">{offer.buyerPhone}</p>
                    <p className="mt-1 text-ink/55">Submitted {formatAdminDateTime(offer.createdAt)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-ink">{formatCurrency(offer.amount)}</p>
                    <p className="mt-1 line-clamp-3 text-ink/55">{offer.message}</p>
                  </div>
                  <div>
                    <OfferStatusBadge status={offer.status} />
                  </div>
                  <div>
                    <OfferStatusActions offer={offer} basePath="/admin/offers" />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-6 py-12 text-sm text-ink/60">
              No offers yet.
            </div>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
