import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { AdminApiAuthError, requireVerifiedAdminApiAccess } from "@/lib/admin-api-auth";
import { buildAdminOfferUpdatePlan, sanitizeAdminOfferUpdateInput, serializeAdminOfferDoc } from "@/lib/admin-offers";
import { getAdminDb } from "@/lib/firebase-admin-server";
import { sendOfferEmail } from "@/lib/offer-email";
import type { Offer, OfferThreadEntry } from "@/types";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isValidOfferId(id: string) {
  return /^[A-Za-z0-9_-]{8,120}$/.test(id);
}

function toStoredOfferThreadEntry(entry: OfferThreadEntry) {
  const createdAt = entry.createdAt ? new Date(entry.createdAt) : null;

  return {
    type: entry.type,
    sender: entry.sender,
    ...(entry.text ? { text: entry.text } : {}),
    ...(typeof entry.amount === "number" ? { amount: entry.amount } : {}),
    createdAt: createdAt && Number.isFinite(createdAt.getTime()) ? Timestamp.fromDate(createdAt) : Timestamp.now()
  };
}

async function resolveBuyerEmailRecipient(offer: Offer) {
  if (offer.source === "guest") {
    return {
      email: offer.buyerEmail.trim().toLowerCase(),
      buyerAccess: "guest" as const
    };
  }

  const fallbackEmail = offer.buyerEmail.trim().toLowerCase();
  const normalizedFallback = fallbackEmail.trim().toLowerCase();
  if (offer.buyerUid) {
    const snapshot = await getAdminDb().collection("users").doc(offer.buyerUid).get();
    const email = snapshot.exists && typeof snapshot.data()?.email === "string"
      ? String(snapshot.data()?.email).trim().toLowerCase()
      : "";
    if (email) {
      return {
        email,
        buyerAccess: "registered" as const
      };
    }
  }

  return {
    email: normalizedFallback,
    buyerAccess: "registered" as const
  };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireVerifiedAdminApiAccess(request, "manageOffers");

    const { id } = await params;
    if (!isValidOfferId(id)) {
      return jsonError("Invalid offer id.", 400);
    }

    const input = sanitizeAdminOfferUpdateInput(await request.json().catch(() => null));
    const db = getAdminDb();
    const ref = db.collection("offers").doc(id);
    const transactionResult = await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      if (!existing.exists) {
        throw new Error("Offer not found.");
      }

      const offer = serializeAdminOfferDoc(existing.id, existing.data() ?? {});
      const plan = buildAdminOfferUpdatePlan(input, offer);
      const patch: Record<string, unknown> = {
        status: plan.status,
        buyerViewed: plan.buyerViewed,
        sellerViewed: plan.sellerViewed,
        contactUnlocked: plan.contactUnlocked,
        contactUnlockedBy: plan.contactUnlockedBy,
        contactVisibilityState: plan.contactVisibilityState,
        lastUpdatedBy: plan.lastUpdatedBy ?? null,
        updatedAt: FieldValue.serverTimestamp()
      };

      if ((plan.contactUnlockedAt ?? null) !== (offer.contactUnlockedAt ?? null)) {
        patch.contactUnlockedAt = plan.contactUnlockedAt ? FieldValue.serverTimestamp() : null;
      }

      if (typeof plan.amount === "number") {
        patch.amount = plan.amount;
        patch.offerAmount = plan.offerAmount ?? plan.amount;
      }

      if (plan.appendMessage) {
        patch.messages = [
          ...offer.messages.map(toStoredOfferThreadEntry),
          toStoredOfferThreadEntry(plan.appendMessage)
        ];
      }

      if (plan.shouldTouchRespondedAt) {
        patch.respondedAt = plan.respondedAt ? FieldValue.serverTimestamp() : null;
      }

      transaction.update(ref, patch);

      return {
        previousOffer: offer,
        emailEvent: plan.emailEvent ?? null
      };
    });

    const updated = await ref.get();
    const updatedOffer = serializeAdminOfferDoc(updated.id, updated.data() ?? {});
    let emailStatus:
      | { attempted: false; sent: false }
      | { attempted: true; sent: true; recipientEmail: string }
      | { attempted: true; sent: false; recipientEmail?: string; reason: string }
      = { attempted: false, sent: false };

    if (transactionResult.emailEvent) {
      const recipient = await resolveBuyerEmailRecipient(updatedOffer);
      if (recipient.email) {
        try {
          const result = await sendOfferEmail({
            event: transactionResult.emailEvent,
            to: recipient.email,
            vehicleTitle: updatedOffer.vehicleTitle,
            vehicleId: updatedOffer.vehicleId,
            amount: updatedOffer.amount,
            buyerOriginalAmount: transactionResult.previousOffer.amount,
            counterAmount: updatedOffer.amount,
            buyerAccess: recipient.buyerAccess,
            offerId: updatedOffer.id
          });

          emailStatus = result.sent
            ? { attempted: true, sent: true, recipientEmail: recipient.email }
            : {
                attempted: true,
                sent: false,
                recipientEmail: recipient.email,
                reason: "reason" in result ? result.reason : "email_not_sent"
              };
        } catch (emailError) {
          console.error("[admin-offers] Offer notification email failed after offer update.", {
            offerId: updatedOffer.id,
            event: transactionResult.emailEvent,
            recipientEmail: recipient.email,
            error: emailError instanceof Error ? emailError.message : String(emailError)
          });
          emailStatus = {
            attempted: true,
            sent: false,
            recipientEmail: recipient.email,
            reason: emailError instanceof Error ? emailError.message : "email_send_failed"
          };
        }
      } else {
        emailStatus = {
          attempted: true,
          sent: false,
          reason: "missing_buyer_email"
        };
      }
    }

    return NextResponse.json({
      offer: updatedOffer,
      writeSucceeded: true,
      emailStatus
    });
  } catch (error) {
    if (error instanceof AdminApiAuthError) {
      return jsonError(error.message, error.status);
    }

    return jsonError(error instanceof Error ? error.message : "Unable to update offer.", 400);
  }
}
