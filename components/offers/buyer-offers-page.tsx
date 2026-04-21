"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SellerShell } from "@/components/layout/seller-shell";
import { OfferAmountInlineEditor } from "@/components/offers/offer-amount-inline-editor";
import { OfferNegotiationCard } from "@/components/offers/offer-negotiation-card";
import { OfferThread } from "@/components/offers/offer-thread";
import { OfferStatusBadge } from "@/components/offers/offer-status-badge";
import { useAuth } from "@/lib/auth";
import { appendOfferMessage, getAppUserById, getBuyerOffersData, markBuyerOfferResponsesViewed, updateOfferAmount, updateOfferStatus } from "@/lib/data";
import { formatAdminDateTime, formatCurrency } from "@/lib/utils";
import { AppUser, Offer, OfferStatus } from "@/types";

export function BuyerOffersPageClient() {
  const router = useRouter();
  const { appUser, loading } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState("");
  const [busyOfferId, setBusyOfferId] = useState("");
  const [notice, setNotice] = useState("");
  const [sellerInfoByOfferId, setSellerInfoByOfferId] = useState<Record<string, AppUser | null>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadOffers() {
      if (!appUser || appUser.role === "admin" || appUser.role === "super_admin") return;

      const result = await getBuyerOffersData(appUser.id);
      if (cancelled) return;

      setOffers(result.items);
      setError(result.error ?? "");
      const sellerRecords = await Promise.all(
        result.items.map(async (offer) => ({
          offerId: offer.id,
          seller: await getAppUserById(offer.listingOwnerUid)
        }))
      );
      if (cancelled) return;
      setSellerInfoByOfferId(
        Object.fromEntries(sellerRecords.map((record) => [record.offerId, record.seller]))
      );
      void markBuyerOfferResponsesViewed(appUser.id);
    }

    void loadOffers();

    return () => {
      cancelled = true;
    };
  }, [appUser]);

  async function handleBuyerDecision(offer: Offer, nextStatus: OfferStatus) {
    if (!appUser) return;

    setBusyOfferId(offer.id);
    setError("");
    setNotice("");

    try {
      const result = await updateOfferStatus(offer.id, nextStatus, appUser, offer);
      setOffers((current) => current.map((item) => (item.id === offer.id ? result.offer : item)));
      setNotice(
        nextStatus === "accepted"
          ? "Counteroffer accepted. Seller contact details are now visible."
          : nextStatus === "declined"
            ? "Counteroffer declined."
            : nextStatus === "buyer_confirmed"
              ? "Offer confirmed. The vehicle remains under offer."
              : "Offer declined."
      );
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "We couldn't update your offer right now.");
    } finally {
      setBusyOfferId("");
    }
  }

  async function handleBuyerReply(offer: Offer, text: string) {
    if (!appUser) return;

    setBusyOfferId(offer.id);
    setError("");
    setNotice("");

    try {
      const result = await appendOfferMessage(offer.id, "buyer", text, appUser, offer);
      setOffers((current) => current.map((item) => (item.id === offer.id ? result.offer : item)));
      setNotice("Reply sent.");
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "We couldn't send your reply right now.");
    } finally {
      setBusyOfferId("");
    }
  }

  async function handleBuyerAmountUpdate(offer: Offer, amount: number) {
    if (!appUser) return;

    setBusyOfferId(offer.id);
    setError("");
    setNotice("");

    try {
      const result = await updateOfferAmount(offer.id, amount, "buyer", appUser, offer);
      setOffers((current) => current.map((item) => (item.id === offer.id ? result.offer : item)));
      setNotice(offer.status === "countered" ? "Updated offer sent to the seller." : "Offer amount updated.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "We couldn't update your offer right now.");
    } finally {
      setBusyOfferId("");
    }
  }

  return (
    <SellerShell
      title="My Offers to Sellers"
      description="Track offers you’ve made on other vehicles"
      allowedRoles={["buyer", "seller"]}
    >
      <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
        {loading ? "Loading offer activity..." : `${offers.length} offer${offers.length === 1 ? "" : "s"} submitted`}
      </div>
      {notice ? <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">{notice}</div> : null}
      {error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
          {error}
        </div>
      ) : null}
      <section className="overflow-hidden rounded-[32px] border border-black/5 bg-white shadow-panel">
        <div className="grid grid-cols-[1.4fr,1fr,1fr,1fr,1fr,1.1fr] gap-4 border-b border-black/5 bg-shell px-6 py-4 text-xs uppercase tracking-[0.22em] text-ink/55">
          <span>Vehicle</span>
          <span>Offer</span>
          <span>Status</span>
          <span>Submitted</span>
          <span>Updated</span>
          <span>Offer activity</span>
        </div>
        <div>
          {offers.length ? (
            offers.map((offer) => (
              <div key={offer.id} className="border-b border-black/5 px-6 py-5 last:border-b-0">
                <div className="grid grid-cols-[1.4fr,1fr,1fr,1fr,1fr,1.1fr] gap-4 text-sm">
                  <div>
                    <p className="font-semibold text-ink">{offer.vehicleTitle}</p>
                    <p className="mt-1 text-ink/55">Asking price: {formatCurrency(offer.vehiclePrice)}</p>
                  </div>
                  <div>
                    <OfferAmountInlineEditor
                      amount={offer.amount}
                      canEdit={offer.status === "pending"}
                      busy={busyOfferId === offer.id}
                      onSave={(amount) => handleBuyerAmountUpdate(offer, amount)}
                    />
                    <p className="mt-1 text-ink/55">Current negotiated amount</p>
                  </div>
                  <div>
                    <OfferStatusBadge status={offer.status} />
                  </div>
                  <div className="text-ink/70">{formatAdminDateTime(offer.createdAt)}</div>
                  <div className="text-ink/70">{formatAdminDateTime(offer.respondedAt ?? offer.updatedAt ?? offer.createdAt)}</div>
                  <div className="space-y-3">
                    <div className="rounded-[20px] border border-black/5 bg-shell p-4">
                      {offer.contactUnlocked || offer.contactVisibilityState !== "hidden" ? (
                        <>
                          <p className="text-xs uppercase tracking-[0.22em] text-bronze">Seller contact details</p>
                          <p className="mt-2 font-medium text-ink">
                            {sellerInfoByOfferId[offer.id]?.displayName || "Seller"}
                          </p>
                          <p className="mt-1 text-sm text-ink/70">
                            {sellerInfoByOfferId[offer.id]?.email || "Email not available"}
                          </p>
                          {sellerInfoByOfferId[offer.id]?.phone ? (
                            <p className="mt-1 text-sm text-ink/70">{sellerInfoByOfferId[offer.id]?.phone}</p>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-sm leading-6 text-ink/60">
                          Seller contact details will be available once you proceed with this deal.
                        </p>
                      )}
                    </div>
                    {offer.status === "countered" ? (
                      <div className="space-y-3">
                        <p className="text-sm leading-6 text-ink/70">
                          The seller sent a counteroffer. You can accept it, decline it, or send another amount to continue negotiating.
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            disabled={busyOfferId === offer.id}
                            onClick={() => void handleBuyerDecision(offer, "accepted")}
                            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {busyOfferId === offer.id ? "Saving..." : "Accept counteroffer"}
                          </button>
                          <button
                            type="button"
                            disabled={busyOfferId === offer.id}
                            onClick={() => void handleBuyerDecision(offer, "declined")}
                            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {busyOfferId === offer.id ? "Saving..." : "Decline counteroffer"}
                          </button>
                        </div>
                        <OfferNegotiationCard
                          title="Send another offer"
                          description="Prefer a different number? Submit another offer amount and keep the negotiation moving."
                          currentAmount={offer.amount}
                          buttonLabel="Send updated offer"
                          busy={busyOfferId === offer.id}
                          onConfirm={(amount) => handleBuyerAmountUpdate(offer, amount)}
                        />
                      </div>
                    ) : offer.status === "accepted" ? (
                      <p className="text-sm leading-6 text-ink/60">The offer has been accepted. Seller contact details are now available above.</p>
                    ) : offer.status === "declined" ? (
                      <p className="text-sm leading-6 text-ink/60">
                        {offer.lastUpdatedBy === "buyer"
                          ? "You declined the seller’s counteroffer."
                          : "The seller declined this offer."}
                      </p>
                    ) : offer.status === "accepted_pending_buyer_confirmation" ? (
                      <>
                        <p className="text-sm leading-6 text-ink/70">
                          The seller accepted this offer. Confirm if you would like to proceed while the vehicle remains under offer.
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            disabled={busyOfferId === offer.id}
                            onClick={() => void handleBuyerDecision(offer, "buyer_confirmed")}
                            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {busyOfferId === offer.id ? "Saving..." : "Confirm"}
                          </button>
                          <button
                            type="button"
                            disabled={busyOfferId === offer.id}
                            onClick={() => void handleBuyerDecision(offer, "buyer_declined")}
                            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {busyOfferId === offer.id ? "Saving..." : "Decline"}
                          </button>
                        </div>
                      </>
                    ) : offer.status === "rejected" ? (
                      <p className="text-sm leading-6 text-ink/60">The seller declined this offer.</p>
                    ) : offer.status === "buyer_confirmed" ? (
                      <p className="text-sm leading-6 text-ink/60">You confirmed that you want to proceed.</p>
                    ) : offer.status === "buyer_declined" ? (
                      <div className="space-y-3">
                        <p className="text-sm leading-6 text-ink/60">You declined to proceed, and the listing was returned to live status.</p>
                        <OfferNegotiationCard
                          title="Continue negotiation"
                          description="Your offer was declined. Enter a new offer to keep the conversation moving."
                          currentAmount={offer.amount}
                          buttonLabel="Submit new offer"
                          busy={busyOfferId === offer.id}
                          onConfirm={(amount) => handleBuyerAmountUpdate(offer, amount)}
                        />
                      </div>
                    ) : (
                      <p className="text-sm leading-6 text-ink/60">Waiting for the seller to review your offer.</p>
                    )}
                  </div>
                </div>
                <div className="mt-5">
                  <OfferThread
                    offer={offer}
                    canReply={offer.status === "pending" || offer.status === "countered"}
                    replyPlaceholder="Add a short buyer message to this offer."
                    busy={busyOfferId === offer.id}
                    onReply={offer.status === "pending" || offer.status === "countered" ? (text) => handleBuyerReply(offer, text) : undefined}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-12 text-sm text-ink/60">No offers yet.</div>
          )}
        </div>
      </section>
    </SellerShell>
  );
}
