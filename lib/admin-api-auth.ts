import "server-only";

import { NextRequest } from "next/server";
import { AdminPermissionKey } from "@/types";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin-server";
import {
  hasAdminPermission,
  isAdminLikeRole,
  normalizeEmailAddress,
  resolveManagedUserAccess
} from "@/lib/permissions";

function parsePermissions(value?: string) {
  if (!value) return {} as Record<string, boolean>;

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).map(([key, entry]) => [key, Boolean(entry)]));
  } catch {
    return {} as Record<string, boolean>;
  }
}

export function hasAdminApiAccess(request: NextRequest, requiredPermission?: AdminPermissionKey) {
  const role = request.cookies.get("carnest_role")?.value;
  const session = request.cookies.get("carnest_session")?.value;
  const permissions = parsePermissions(request.cookies.get("carnest_permissions")?.value);

  if (!session) return false;
  if (role === "super_admin") return true;
  if (role !== "admin") return false;
  return requiredPermission ? Boolean(permissions[requiredPermission]) : true;
}

export function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return "";
  return authorization.slice(7).trim();
}

export class AdminApiAuthError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "AdminApiAuthError";
    this.status = status;
  }
}

export async function requireVerifiedAdminApiAccess(request: NextRequest, requiredPermission?: AdminPermissionKey) {
  const idToken = getBearerToken(request);
  if (!idToken) {
    throw new AdminApiAuthError("Missing Firebase ID token.", 401);
  }

  const decodedToken = await getAdminAuth().verifyIdToken(idToken).catch(() => null);
  if (!decodedToken?.uid) {
    throw new AdminApiAuthError("Admin authentication has expired. Please sign in again.", 401);
  }

  const email = normalizeEmailAddress(decodedToken.email ?? "");
  const userSnapshot = await getAdminDb().collection("users").doc(decodedToken.uid).get();
  const userData = userSnapshot.exists ? userSnapshot.data() ?? {} : {};
  const storedPermissions =
    userData.adminPermissions && typeof userData.adminPermissions === "object"
      ? userData.adminPermissions as Record<string, boolean>
      : null;
  const access = resolveManagedUserAccess({
    email,
    storedRole: typeof userData.role === "string" ? userData.role : null,
    storedPermissions
  });
  const adminUser = {
    role: access.role,
    email,
    adminPermissions: access.adminPermissions
  };

  const allowed = requiredPermission
    ? hasAdminPermission(adminUser, requiredPermission)
    : isAdminLikeRole(access.role);

  if (!allowed) {
    throw new AdminApiAuthError("Unauthorized", 403);
  }

  return {
    uid: decodedToken.uid,
    email,
    role: access.role,
    adminPermissions: access.adminPermissions
  };
}
