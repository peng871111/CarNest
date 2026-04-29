import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

function isValidPayload(body: unknown): body is {
  vehicleId: string;
  sessionId: string;
  userId?: string;
  role: string;
  source: string;
  referrer: string;
  deviceType: string;
  country?: string;
  state?: string;
  city?: string;
  listingType: string;
  sellerOwnerUid: string;
} {
  if (!body || typeof body !== "object") return false;

  const payload = body as Record<string, unknown>;
  return typeof payload.vehicleId === "string"
    && payload.vehicleId.trim().length > 0
    && typeof payload.sessionId === "string"
    && payload.sessionId.trim().length > 0
    && typeof payload.role === "string"
    && typeof payload.source === "string"
    && typeof payload.referrer === "string"
    && typeof payload.deviceType === "string"
    && typeof payload.listingType === "string"
    && typeof payload.sellerOwnerUid === "string";
}

function buildVisitorKeyHash(sessionId: string, userId: string | undefined, userAgent: string) {
  const baseKey = userId?.trim() ? `user:${userId.trim().toLowerCase()}` : `session:${sessionId.trim()}`;
  return createHash("sha256")
    .update(`${baseKey}|${userAgent.trim().toLowerCase()}`)
    .digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!isValidPayload(body)) {
      return NextResponse.json({ success: false, error: "Invalid vehicle view payload." }, { status: 400 });
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ success: false, error: "Vehicle view tracking is not configured." }, { status: 503 });
    }

    const userAgent = request.headers.get("user-agent") ?? "";
    const visitorKeyHash = buildVisitorKeyHash(body.sessionId, body.userId, userAgent);
    const vehiclesCollection = adminDb.collection("vehicles");
    const viewEventsCollection = adminDb.collection("vehicleViewEvents");
    const analyticsCollection = adminDb.collection("vehicleAnalytics");
    const vehicleViewVisitorsCollection = adminDb.collection("vehicleViewVisitors");
    const vehicleRef = vehiclesCollection.doc(body.vehicleId);
    const analyticsRef = analyticsCollection.doc(body.vehicleId);
    const viewEventRef = viewEventsCollection.doc();
    const uniqueVisitorRef = vehicleViewVisitorsCollection.doc(`${body.vehicleId}_${visitorKeyHash}`);

    const tracked = await adminDb.runTransaction(async (transaction) => {
      const [vehicleSnapshot, existingVisitorSnapshot] = await Promise.all([
        transaction.get(vehicleRef),
        transaction.get(uniqueVisitorRef)
      ]);

      if (!vehicleSnapshot.exists) {
        return null;
      }

      const vehicleData = vehicleSnapshot.data() ?? {};
      const nextViewCount = Number(vehicleData.viewCount ?? 0) + 1;
      const isUniqueVisitor = !existingVisitorSnapshot.exists;
      const nextUniqueViewCount = Number(vehicleData.uniqueViewCount ?? 0) + (isUniqueVisitor ? 1 : 0);

      transaction.set(viewEventRef, {
        vehicleId: body.vehicleId,
        sessionId: body.sessionId,
        ...(body.userId?.trim() ? { userId: body.userId.trim() } : {}),
        visitorKeyHash,
        role: body.role,
        source: body.source,
        referrer: body.referrer,
        deviceType: body.deviceType,
        country: body.country ?? "",
        state: body.state ?? "",
        city: body.city ?? "",
        listingType: body.listingType,
        sellerOwnerUid: body.sellerOwnerUid,
        viewedAt: FieldValue.serverTimestamp()
      });

      if (isUniqueVisitor) {
        transaction.set(uniqueVisitorRef, {
          vehicleId: body.vehicleId,
          visitorKeyHash,
          firstViewedAt: FieldValue.serverTimestamp()
        });
      }

      transaction.set(
        vehicleRef,
        {
          viewCount: nextViewCount,
          uniqueViewCount: nextUniqueViewCount,
          lastViewedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      transaction.set(
        analyticsRef,
        {
          vehicleId: body.vehicleId,
          sellerOwnerUid: body.sellerOwnerUid,
          totalViews: nextViewCount,
          uniqueVisitors: nextUniqueViewCount,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      return {
        viewCount: nextViewCount,
        uniqueViewCount: nextUniqueViewCount
      };
    });

    if (!tracked) {
      return NextResponse.json({ success: false, error: "Vehicle not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...tracked });
  } catch (error) {
    console.error("[vehicle-views] Failed to track vehicle view.", {
      reason: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
