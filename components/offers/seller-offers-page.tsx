"use client";

import { useEffect, useState } from "react";
import { SellerShell } from "@/components/layout/seller-shell";
import { OfferThread } from "@/components/offers/offer-thread";
import { OfferStatusBadge } from "@/components/offers/offer-status-badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { appendOfferMessage, getSellerOffersData, markSellerOffersViewed, unlockOfferContactDetails, updateOfferAmount, updateOfferStatus } from "@/lib/data";
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
  const [counterOfferOpenId, setCounterOfferOpenId] = useState("");
  const [counterOfferDrafts, setCounterOfferDrafts] = useState<Record<string, string>>({});

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

  async function handleSellerAccept(offer: Offer) {
    if (!appUser) return;

    setBusyOfferId(offer.id);
    setError("");
    setNotice("");

    try {
      const result = await updateOfferStatus(offer.id, "accepted_pending_buyer_confirmation", appUser, offer);
      setOffers((current) => current.map((item) => (item.id === offer.id ? result.offer : item)));
      setNotice("Offer accepted. The buyer has been notified and the vehicle is now under offer.");
      setCounterOfferOpenId("");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "We couldn't update the offer right now.");
    } finally {
      setBusyOfferId("");
    }
  }

  async function handleSellerCounterOffer(offer: Offer) {
    if (!appUser) return;

    const amount = Number((counterOfferDrafts[offer.id] ?? "").trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid price.");
      return;
    }

    setBusyOfferId(offer.id);
    setError("");
    setNotice("");

    try {
      const result = await updateOfferAmount(offer.id, amount, "seller", appUser, offer);
      setOffers((current) => current.map((item) => (item.id === offer.id ? result.offer : item)));
      setNotice("Counter-offer sent.");
      setCounterOfferDrafts((current) => ({ ...current, [offer.id]: "" }));
      setCounterOfferOpenId("");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "We couldn't update the offer amount right now.");
    } finally {
      setBusyOfferId("");
    }
  }

  async function handleShareContactDetails(offer: Offer) {
    if (!appUser) return;

    setBusyOfferId(offer.id);
    setError("");
    setNotice("");

    try {
      const result = await unlockOfferContactDetails(offer.id, appUser, offer);
      setOffers((current) => current.map((item) => (item.id === offer.id ? result.offer : item)));
      setNotice("Your contact details are now available for this buyer.");
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : "We couldn't share your contact details right now.");
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
                    <p className="text-lg font-semibold text-ink">{formatCurrency(offer.amount)}</p>
                    <p className="mt-1 text-ink/55">Current negotiated amount</p>
                  </div>
                  <div>
                    <p className="text-ink/70">{formatAdminDateTime(offer.createdAt)}</p>
                    {offer.respondedAt ? <p className="mt-1 text-ink/45">Responded {formatAdminDateTime(offer.respondedAt)}</p> : null}
                  </div>
                  <div>
                    <OfferStatusBadge status={offer.status} />
                  </div>
                  <div>
                    {offer.status === "pending" ? (
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => void handleSellerAccept(offer)}
                          disabled={busyOfferId === offer.id}
                          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {busyOfferId === offer.id ? "Saving..." : "Accept"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCounterOfferOpenId(offer.id);
                            setCounterOfferDrafts((current) => ({
                              ...current,
                              [offer.id]: current[offer.id] ?? String(offer.amount)
                            }));
                            setError("");
                            setNotice("");
                          }}
                          disabled={busyOfferId === offer.id}
                          className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-ink/55">Response sent</p>
                    )}
                    {!offer.contactUnlocked ? (
                      <button
                        type="button"
                        disabled={busyOfferId === offer.id}
                        onClick={() => void handleShareContactDetails(offer)}
                        className="mt-3 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busyOfferId === offer.id ? "Sharing..." : "Share my contact details"}
                      </button>
                    ) : (
                      <p className="mt-3 text-sm text-ink/55">Contact details shared for this buyer.</p>
                    )}
                  </div>
                </div>
                {offer.status === "pending" && counterOfferOpenId === offer.id ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleSellerCounterOffer(offer);
                    }}
                    className="mt-4 flex flex-wrap items-end gap-3 rounded-[20px] border border-black/5 bg-shell px-4 py-4"
                  >
                    <label className="min-w-[220px] flex-1 space-y-2">
                      <span className="text-sm font-medium text-ink">Enter your price</span>
                      <Input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        autoFocus
                        value={counterOfferDrafts[offer.id] ?? ""}
                        onChange={(event) =>
                          setCounterOfferDrafts((current) => ({
                            ...current,
                            [offer.id]: event.target.value
                          }))
                        }
                        className="max-w-[220px]"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={busyOfferId === offer.id}
                      className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {busyOfferId === offer.id ? "Sending..." : "Send"}
                    </button>
                    <button
                      type="button"
                      disabled={busyOfferId === offer.id}
                      onClick={() => setCounterOfferOpenId("")}
                      className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </form>
                ) : null}
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
