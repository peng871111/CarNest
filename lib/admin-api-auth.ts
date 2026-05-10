import "server-only";

import { NextRequest } from "next/server";
import { AdminPermissionKey } from "@/types";

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
