import "server-only";

import { cookies } from "next/headers";
import { getAdminDb } from "@/lib/firebase-admin-server";
import {
  buildAdminPricingCollectionResult,
  hasAdminPricingSessionAccess,
  parseAdminPricingPermissionsCookie,
} from "@/lib/admin-pricing";

export async function getAdminPricingRequestsData() {
  const cookieStore = await cookies();
  const accessAllowed = hasAdminPricingSessionAccess({
    session: cookieStore.get("carnest_session")?.value,
    role: cookieStore.get("carnest_role")?.value,
    permissions: parseAdminPricingPermissionsCookie(cookieStore.get("carnest_permissions")?.value)
  });

  if (!accessAllowed) {
    return {
      items: [],
      source: "firestore" as const,
      error: "Unauthorized admin pricing access."
    };
  }

  try {
    const snapshot = await getAdminDb().collection("pricingRequests").get();
    return buildAdminPricingCollectionResult(snapshot.docs);
  } catch (error) {
    return {
      items: [],
      source: "firestore" as const,
      error: error instanceof Error ? error.message : "Unknown Firestore read error"
    };
  }
}
