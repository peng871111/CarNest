"use client";

import { FormEvent, useState } from "react";
import { Offer, OfferMessageSender, OfferThreadEntry } from "@/types";
import { formatAdminDateTime, formatCurrency } from "@/lib/utils";

function getMessageLabel(sender: OfferMessageSender) {
  return sender === "buyer" ? "Buyer message" : "Seller reply";
}

function getMessageTone(sender: OfferMessageSender) {
  return sender === "buyer"
    ? "border-black/5 bg-shell text-ink/78"
    : "border-[#E7D4BC] bg-[#FBF6EF] text-ink/78";
}

function getOfferUpdateLabel(sender: OfferMessageSender) {
  return sender === "buyer" ? "Buyer updated offer" : "Seller counter-offer";
}

function getEntryPreview(entry?: OfferThreadEntry) {
  if (!entry) return "No thread activity yet";
  if (entry.type === "offer_update") {
    return `${entry.sender === "buyer" ? "Buyer" : "Seller"} updated the amount to ${formatCurrency(entry.amount ?? 0)}`;
  }
  return `${entry.sender === "buyer" ? "Buyer" : "Seller"}: ${entry.text ?? ""}`;
}

export function OfferThread({
  offer,
  canReply,
  replyPlaceholder,
  replyButtonLabel = "Reply",
  busy = false,
  onReply
}: {
  offer: Offer;
  canReply?: boolean;
  replyPlaceholder?: string;
  replyButtonLabel?: string;
  busy?: boolean;
  onReply?: (text: string) => Promise<void> | void;
}) {
  const [replyText, setReplyText] = useState("");
  const [localError, setLocalError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const latestEntry = offer.messages[offer.messages.length - 1];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed) {
      setLocalError("Please enter a message before replying.");
      return;
    }

    setLocalError("");
    await onReply?.(trimmed);
    setReplyText("");
  }

  return (
    <div className="rounded-[24px] border border-black/5 bg-white/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-bronze">Offer thread</p>
          <p className="mt-2 text-sm text-ink/68">
            {offer.messages.length} {offer.messages.length === 1 ? "entry" : "entries"}
            {latestEntry ? ` · ${formatAdminDateTime(latestEntry.createdAt)}` : ""}
          </p>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink/58">{getEntryPreview(latestEntry)}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-ink transition hover:border-bronze hover:text-bronze"
        >
          {expanded ? "Hide thread" : "View thread"}
        </button>
      </div>
      {expanded ? (
        <>
          {offer.messages.length ? (
            <div className="mt-4 space-y-3">
              {offer.messages.map((message, index) => (
                message.type === "offer_update" ? (
                  <div key={`${message.type}-${message.sender}-${message.createdAt ?? index}-${index}`} className="rounded-[20px] border border-[#E7D4BC] bg-[#FBF6EF] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/48">{getOfferUpdateLabel(message.sender)}</p>
                      <p className="text-xs text-ink/45">{formatAdminDateTime(message.createdAt)}</p>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-ink">{formatCurrency(message.amount ?? 0)}</p>
                  </div>
                ) : (
                  <div key={`${message.type}-${message.sender}-${message.createdAt ?? index}-${index}`} className={`rounded-[20px] border px-4 py-3 ${getMessageTone(message.sender)}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/48">{getMessageLabel(message.sender)}</p>
                      <p className="text-xs text-ink/45">{formatAdminDateTime(message.createdAt)}</p>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.text}</p>
                  </div>
                )
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-ink/55">No messages in this offer thread yet.</p>
          )}
          {canReply && onReply ? (
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">Reply</span>
                <textarea
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder={replyPlaceholder ?? "Add a short update for this offer."}
                  rows={3}
                  className="w-full rounded-[20px] border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-bronze"
                />
              </label>
              {localError ? <p className="text-sm text-red-700">{localError}</p> : null}
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Sending..." : replyButtonLabel}
              </button>
            </form>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
