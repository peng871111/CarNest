import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { AdminApiAuthError, requireVerifiedAdminApiAccess } from "@/lib/admin-api-auth";
import { buildAdminOfferUpdatePlan, sanitizeAdminOfferUpdateInput, serializeAdminOfferDoc } from "@/lib/admin-offers";
import { getAdminDb } from "@/lib/firebase-admin-server";
import { sendOfferEmail } from "@/lib/offer-email";
import type { OfferThreadEntry } from "@/types";

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

async function getUserNotificationEmail(userId: string, fallbackEmail = "") {
  const normalizedFallback = fallbackEmail.trim().toLowerCase();
  if (userId) {
    const snapshot = await getAdminDb().collection("users").doc(userId).get();
    const email = snapshot.exists && typeof snapshot.data()?.email === "string"
      ? String(snapshot.data()?.email).trim().toLowerCase()
      : "";
    if (email) return email;
  }

  return normalizedFallback;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireVerifiedAdminApiAccess(request, "manageOffers");

    const { id } = await params;
    if (!isValidOfferId(id)) {
      return jsonError("Invalid offer id.", 400);
    }

    const input = sanitizeAdminOfferUpdateInput(await request.json().catch(() => null));
    const ref = getAdminDb().collection("offers").doc(id);
    const existing = await ref.get();
    if (!existing.exists) {
      return jsonError("Offer not found.", 404);
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

    await ref.update(patch);

    const updated = await ref.get();
    const updatedOffer = serializeAdminOfferDoc(updated.id, updated.data() ?? {});

    if (plan.emailEvent) {
      const recipientEmail = await getUserNotificationEmail(updatedOffer.buyerUid, updatedOffer.buyerEmail);
      if (recipientEmail) {
        await sendOfferEmail({
          event: plan.emailEvent,
          to: recipientEmail,
          vehicleTitle: updatedOffer.vehicleTitle,
          amount: updatedOffer.amount,
          offerId: updatedOffer.id
        }).catch((emailError) => {
          console.error("[admin-offers] Offer notification email failed after offer update.", {
            offerId: updatedOffer.id,
            event: plan.emailEvent,
            recipientEmail,
            error: emailError instanceof Error ? emailError.message : String(emailError)
          });
        });
      }
    }

    return NextResponse.json({
      offer: updatedOffer,
      writeSucceeded: true
    });
  } catch (error) {
    if (error instanceof AdminApiAuthError) {
      return jsonError(error.message, error.status);
    }

    return jsonError(error instanceof Error ? error.message : "Unable to update offer.", 400);
  }
}
