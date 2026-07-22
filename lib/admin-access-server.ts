import "server-only";

import { FieldValue, Timestamp, type DocumentData, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin-server";
import {
  ADMIN_PERMISSION_KEYS,
  createAdminPermissions,
  createSuperAdminPermissions,
  hasAdminPermission,
  isAdminLikeRole,
  isCraigSuperAdminEmail,
  normalizeEmailAddress,
  resolveManagedUserAccess,
} from "@/lib/permissions";
import type {
  AdminPermissions,
  AppUser,
  UserRole,
} from "@/types";

const USER_ROLES = ["buyer", "seller", "dealer", "admin", "super_admin"] as const satisfies readonly UserRole[];

export const REQUIRED_REPAIRED_ADMIN_PERMISSIONS: AdminPermissions = {
  manageVehicles: true,
  deleteListings: true,
  manageOffers: true,
  manageEnquiries: true,
  manageInspections: true,
  managePricing: true,
  manageQuotes: true,
  manageUsers: true,
  manageAdmins: false,
};

const KNOWN_ADMIN_REPAIR_TARGETS = [
  {
    name: "Guanchao Liu",
    email: "liuguanchao88@gmail.com",
    accountReference: "CN-U692",
  },
  {
    name: "Kevin Zhang",
    email: "zhangjn226@hotmail.com",
    accountReference: "CN-U323",
  },
] as const;

type AdminAccessActor = Pick<AppUser, "id" | "role" | "email" | "adminPermissions"> & {
  displayName?: string;
  name?: string;
};

function serializeServerDate(value: unknown) {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
  }
  return undefined;
}

function normalizeStoredPermissions(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  return Object.fromEntries(
    ADMIN_PERMISSION_KEYS.map((permission) => [permission, Boolean(raw[permission])])
  ) as AdminPermissions;
}

function normalizeSubmittedPermissions(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  return Object.fromEntries(
    ADMIN_PERMISSION_KEYS.map((permission) => [permission, Boolean(raw[permission])])
  ) as AdminPermissions;
}

function normalizeSubmittedRole(value: unknown): UserRole | null {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole)
    ? value as UserRole
    : null;
}

function buildZeroAdminPermissions(overrides?: Partial<AdminPermissions>): AdminPermissions {
  return createAdminPermissions({
    manageVehicles: false,
    deleteListings: false,
    manageOffers: false,
    manageEnquiries: false,
    manageInspections: false,
    managePricing: false,
    manageQuotes: false,
    manageUsers: false,
    manageAdmins: false,
    ...overrides,
  });
}

function buildPermissionsForRole(role: UserRole, permissions?: Partial<AdminPermissions>) {
  if (role === "super_admin") return createSuperAdminPermissions(permissions);
  if (role === "admin") return createAdminPermissions(permissions);
  return buildZeroAdminPermissions();
}

function assertCanManageAccess(actor: Pick<AppUser, "role" | "email" | "adminPermissions">) {
  if (actor.role === "super_admin" || isCraigSuperAdminEmail(actor.email)) return;
  if (hasAdminPermission(actor, "manageAdmins")) return;
  throw new Error("Only authorized admins can manage admin access.");
}

function serializeAdminAccessUser(id: string, data: DocumentData): AppUser {
  const email = typeof data.email === "string" ? data.email : "";
  const storedPermissions = normalizeStoredPermissions(data.adminPermissions);
  const managedAccess = resolveManagedUserAccess({
    email,
    storedRole: typeof data.role === "string" ? data.role : null,
    storedPermissions,
  });

  return {
    id,
    email,
    displayName: String(data.displayName ?? data.name ?? "CarNest User"),
    name: typeof data.name === "string" ? data.name : String(data.displayName ?? "CarNest User"),
    photoURL: typeof data.photoURL === "string" ? data.photoURL : undefined,
    phone: typeof data.phone === "string" ? data.phone : "",
    emailVerified: typeof data.emailVerified === "boolean" ? data.emailVerified : undefined,
    accountBanned: Boolean(data.accountBanned),
    accountReference: typeof data.accountReference === "string" ? data.accountReference : undefined,
    role: managedAccess.role,
    accountType: data.accountType === "dealer" || data.role === "dealer" ? "dealer" : "private",
    adminPermissions: managedAccess.adminPermissions,
    complianceStatus:
      data.complianceStatus === "possible_unlicensed_trader" || data.complianceStatus === "verified_dealer"
        ? data.complianceStatus
        : "clear",
    dealerStatus:
      data.dealerStatus === "submitted_unverified"
      || data.dealerStatus === "pending"
      || data.dealerStatus === "pending_review"
      || data.dealerStatus === "info_requested"
      || data.dealerStatus === "approved"
      || data.dealerStatus === "rejected"
        ? data.dealerStatus
        : "none",
    dealerVerified: Boolean(data.dealerVerified),
    createdAt: serializeServerDate(data.createdAt),
  } satisfies AppUser;
}

async function loadUserDocument(userId: string) {
  const snapshot = await getAdminDb().collection("users").doc(userId).get();
  if (!snapshot.exists) return null;
  return {
    ref: snapshot.ref,
    user: serializeAdminAccessUser(snapshot.id, snapshot.data() ?? {}),
    data: snapshot.data() ?? {},
  };
}

export async function updateAdminAccessForUser(input: {
  userId: string;
  role: unknown;
  adminPermissions?: unknown;
  actor: AdminAccessActor;
}) {
  assertCanManageAccess(input.actor);

  const role = normalizeSubmittedRole(input.role);
  if (!role) {
    throw new Error("Select a valid role before saving admin access.");
  }

  const loaded = await loadUserDocument(input.userId);
  if (!loaded) {
    throw new Error("User not found.");
  }

  const submittedPermissions = normalizeSubmittedPermissions(input.adminPermissions);
  const currentRole = loaded.user.role;
  const currentEmail = loaded.user.email;

  if (input.userId === input.actor.id && currentRole === "super_admin" && role !== "super_admin") {
    throw new Error("You cannot remove your own super admin access.");
  }

  if (role === "super_admin" && !isCraigSuperAdminEmail(input.actor.email) && input.actor.role !== "super_admin") {
    throw new Error("Only a super admin can grant super admin access.");
  }

  const managedTarget = resolveManagedUserAccess({
    email: currentEmail,
    storedRole: role,
    storedPermissions: submittedPermissions,
  });
  const finalRole = managedTarget.role;
  const finalPermissions = buildPermissionsForRole(finalRole, managedTarget.adminPermissions);

  await loaded.ref.set(
    {
      role: finalRole,
      adminPermissions: finalPermissions,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await getAdminDb().collection("adminOperationalEvents").add({
    recordType: "user_access",
    actionType: currentRole === finalRole ? "updated" : "role_changed",
    affectedRecordId: input.userId,
    staffUid: input.actor.id,
    staffName: input.actor.displayName || input.actor.name || input.actor.email || "CarNest Admin",
    staffEmail: input.actor.email || "",
    targetUid: input.userId,
    targetEmail: currentEmail,
    previousRole: currentRole,
    newRole: finalRole,
    summary:
      currentRole === finalRole
        ? `${input.actor.email || input.actor.id} updated admin permissions for ${currentEmail || input.userId}.`
        : `${input.actor.email || input.actor.id} changed ${currentEmail || input.userId} from ${currentRole} to ${finalRole}.`,
    createdAt: FieldValue.serverTimestamp(),
  }).catch((error) => {
    console.error("[admin-access] Audit log write failed.", {
      targetUid: input.userId,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  const refreshed = await loadUserDocument(input.userId);
  if (!refreshed) {
    throw new Error("Admin access was saved, but the user record could not be reloaded.");
  }

  return refreshed.user;
}

async function findExistingUserDocForRepair(target: typeof KNOWN_ADMIN_REPAIR_TARGETS[number]) {
  const db = getAdminDb();
  const normalizedEmail = normalizeEmailAddress(target.email);
  const authUser = await getAdminAuth().getUserByEmail(normalizedEmail).catch(() => null);
  const matches = new Map<string, QueryDocumentSnapshot>();

  const emailSnapshot = await db.collection("users").where("email", "==", normalizedEmail).get();
  emailSnapshot.docs.forEach((doc) => matches.set(doc.id, doc));

  const referenceSnapshot = await db.collection("users").where("accountReference", "==", target.accountReference).get();
  referenceSnapshot.docs.forEach((doc) => matches.set(doc.id, doc));

  if (authUser) {
    const authUidSnapshot = await db.collection("users").doc(authUser.uid).get();
    if (authUidSnapshot.exists) {
      return {
        authUid: authUser.uid,
        doc: authUidSnapshot,
        duplicateDocIds: Array.from(matches.keys()).filter((id) => id !== authUser.uid),
      };
    }
  }

  const firstMatch = Array.from(matches.values())[0] ?? null;
  return {
    authUid: authUser?.uid ?? "",
    doc: firstMatch,
    duplicateDocIds: firstMatch ? Array.from(matches.keys()).filter((id) => id !== firstMatch.id) : [],
  };
}

export async function repairKnownAdminAccess(input: {
  actor: AdminAccessActor;
}) {
  assertCanManageAccess(input.actor);
  const results = [];

  for (const target of KNOWN_ADMIN_REPAIR_TARGETS) {
    const match = await findExistingUserDocForRepair(target);
    if (!match.doc?.exists) {
      throw new Error(`Existing user record not found for ${target.email}. No duplicate account was created.`);
    }

    const data = match.doc.data() ?? {};
    const existingPermissions = normalizeStoredPermissions(data.adminPermissions) ?? buildZeroAdminPermissions();
    const finalPermissions: AdminPermissions = {
      ...REQUIRED_REPAIRED_ADMIN_PERMISSIONS,
      manageAdmins: existingPermissions.manageAdmins === true,
    };

    if (match.authUid && match.doc.id !== match.authUid) {
      throw new Error(
        `User record mismatch for ${target.email}: Firestore document ${match.doc.id} does not match Firebase Auth UID ${match.authUid}. No duplicate profile was created.`
      );
    }

    await match.doc.ref.set(
      {
        email: normalizeEmailAddress(String(data.email || target.email)),
        displayName: typeof data.displayName === "string" && data.displayName.trim() ? data.displayName : target.name,
        name: typeof data.name === "string" && data.name.trim() ? data.name : target.name,
        accountReference: typeof data.accountReference === "string" && data.accountReference.trim()
          ? data.accountReference
          : target.accountReference,
        role: "admin",
        adminPermissions: finalPermissions,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const refreshed = await loadUserDocument(match.doc.id);
    if (!refreshed || !isAdminLikeRole(refreshed.user.role)) {
      throw new Error(`Admin repair did not persist for ${target.email}.`);
    }

    await getAdminDb().collection("adminOperationalEvents").add({
      recordType: "user_access",
      actionType: "updated",
      affectedRecordId: match.doc.id,
      staffUid: input.actor.id,
      staffName: input.actor.displayName || input.actor.name || input.actor.email || "CarNest Admin",
      staffEmail: input.actor.email || "",
      targetUid: match.doc.id,
      targetEmail: target.email,
      previousRole: typeof data.role === "string" ? data.role : "",
      newRole: "admin",
      summary: `Repaired admin access for ${target.name} (${target.accountReference}).`,
      duplicateDocIds: match.duplicateDocIds,
      createdAt: FieldValue.serverTimestamp(),
    }).catch((error) => {
      console.error("[admin-access] Repair audit log write failed.", {
        targetUid: match.doc?.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    results.push({
      user: refreshed.user,
      authUid: match.authUid,
      duplicateDocIds: match.duplicateDocIds,
      manageAdminsPreserved: finalPermissions.manageAdmins,
    });
  }

  return results;
}
