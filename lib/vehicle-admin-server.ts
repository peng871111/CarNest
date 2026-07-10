import "server-only";

import { getAdminDb } from "@/lib/firebase-admin-server";
import { serializeVehicleDoc } from "@/lib/data";

export async function getAdminVehicleById(id: string) {
  const snapshot = await getAdminDb().collection("vehicles").doc(id).get();
  if (!snapshot.exists) return null;
  return serializeVehicleDoc(snapshot.id, snapshot.data() ?? {});
}
