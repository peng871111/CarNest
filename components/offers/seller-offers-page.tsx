"use client";

import { useEffect, useState } from "react";
import { SellerShell } from "@/components/layout/seller-shell";
import { OfferAmountInlineEditor } from "@/components/offers/offer-amount-inline-editor";
import { OfferThread } from "@/components/offers/offer-thread";
import { OfferStatusActions } from "@/components/offers/offer-status-actions";
import { OfferStatusBadge } from "@/components/offers/offer-status-badge";
import { useAuth } from "@/lib/auth";
import { appendOfferMessage, getSellerOffersData, markSellerOffersViewed, updateOfferAmount } from "@/lib/data";
import { formatAdminDateTime, formatCurrency } from "@/lib/utils";
import { Offer } from "@/types";

export function SellerOffersPageClient({
  initialWrite,
  initialStatus
}: {
  initialWrite?: string;
  initialStatus?: string;
}) {
  const { appUser, loading } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyOfferId, setBusyOfferId] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadOffers() {
      if (!appUser || appUser.role !== "seller") return;
      const result = await getSellerOffersData(appUser.id);
      if (cancelled) return;
      setOffers(result.items);
      setError(result.error ?? "");
      void markSellerOffersViewed(appUser.id);
    }

    void loadOffers();
    return () => {
      cancelled = true;
    };
  }, [appUser]);

  const writeStatus =
    initialWrite === "success"
      ? initialStatus === "accepted_pending_buyer_confirmation"
        ? "Offer accepted. The buyer has been notified and the vehicle is now under offer."
        : initialStatus === "rejected"
          ? "Offer rejected"
          : initialStatus === "buyer_confirmed"
            ? "The buyer confirmed that they want to proceed."
            : initialStatus === "buyer_declined"
              ? "The buyer declined to proceed, and the vehicle returned to live."
          : "Offer updated"
      : "";

  async function handleSellerReply(offer: Offer, text: string) {
    if (!appUser) return;

    setBusyOfferId(offer.id);
    setError("");
    setNotice("");

    try {
      const result = await appendOfferMessage(offer.id, "seller", text, appUser, offer);
      setOffers((current) => current.map((item) => (item.id === offer.id ? result.offer : item)));
      setNotice("Reply sent.");
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "We couldn't send your reply right now.");
    } finally {
      setBusyOfferId("");
    }
  }

  async function handleSellerCounter(offer: Offer, amount: number) {
    if (!appUser) return;

    setBusyOfferId(offer.id);
    setError("");
    setNotice("");

    try {
      const result = await updateOfferAmount(offer.id, amount, "seller", appUser, offer);
      setOffers((current) => current.map((item) => (item.id === offer.id ? result.offer : item)));
      setNotice("Counter-offer saved.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "We couldn't update the offer amount right now.");
    } finally {
      setBusyOfferId("");
    }
  }

  return (
    <SellerShell title="Offers on My Cars" description="View and manage offers buyers made on your vehicles">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          {loading ? "Loading offers..." : `${offers.length} offer${offers.length === 1 ? "" : "s"} received`}
        </div>
        {writeStatus ? <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">{writeStatus}</div> : null}
      </div>
      {notice ? <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">{notice}</div> : null}
      {error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
          {error}
        </div>
      ) : null}
      <section className="overflow-hidden rounded-[32px] border border-black/5 bg-white shadow-panel">
        <div className="grid grid-cols-[1.2fr,1fr,1fr,1fr,1fr,240px] gap-4 border-b border-black/5 bg-shell px-6 py-4 text-xs uppercase tracking-[0.22em] text-ink/55">
          <span>Vehicle</span>
          <span>Buyer</span>
          <span>Offer</span>
          <span>Submitted</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        <div>
          {offers.length ? (
            offers.map((offer) => (
              <div key={offer.id} className="border-b border-black/5 px-6 py-5 last:border-b-0">
                <div className="grid grid-cols-[1.2fr,1fr,1fr,1fr,1fr,240px] gap-4 text-sm">
                  <div>
                    <p className="font-semibold text-ink">{offer.vehicleTitle}</p>
                    <p className="mt-1 text-ink/55">Asking price: {formatCurrency(offer.vehiclePrice)}</p>
                  </div>
                  <div>
                    <p className="font-medium text-ink">{offer.buyerName}</p>
                    <p className="mt-1 text-ink/55">{offer.buyerEmail}</p>
                    <p className="mt-1 text-ink/55">{offer.buyerPhone}</p>
                  </div>
                  <div>
                    <OfferAmountInlineEditor
                      amount={offer.amount}
                      canEdit={offer.status === "pending"}
                      busy={busyOfferId === offer.id}
                      onSave={(amount) => handleSellerCounter(offer, amount)}
                    />
                    <p className="mt-1 text-ink/55">Current amount</p>
                  </div>
                  <div>
                    <p className="text-ink/70">{formatAdminDateTime(offer.createdAt)}</p>
                    {offer.respondedAt ? <p className="mt-1 text-ink/45">Responded {formatAdminDateTime(offer.respondedAt)}</p> : null}
                  </div>
                  <div>
                    <OfferStatusBadge status={offer.status} />
                  </div>
                  <div>
                    <OfferStatusActions offer={offer} basePath="/seller/offers" />
                  </div>
                </div>
                <div className="mt-5">
                  <OfferThread
                    offer={offer}
                    canReply
                    replyPlaceholder="Add a short seller reply for this offer."
                    busy={busyOfferId === offer.id}
                    onReply={(text) => handleSellerReply(offer, text)}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-12 text-sm text-ink/60">
              No offers yet.
            </div>
          )}
        </div>
      </section>
    </SellerShell>
  );
}
