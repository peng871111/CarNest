import {
  AdminPermissionKey,
  AdminPermissions,
  AppUser,
  ContactMessageStatus,
  DealerStatus,
  InspectionRequestStatus,
  ListingType,
  OfferStatus,
  QuoteStatus,
  SellerVehicleStatus,
  UserRole,
  Vehicle,
  VehicleStatus
} from "@/types";
import { VEHICLE_PLACEHOLDER_IMAGE } from "@/lib/constants";

export const CRAIG_SUPER_ADMIN_EMAIL = "peng871111@gmail.com";
export const LEON_ADMIN_EMAIL = "dengue0111@gmail.com";

export const ADMIN_PERMISSION_KEYS: AdminPermissionKey[] = [
  "manageVehicles",
  "deleteListings",
  "manageOffers",
  "manageEnquiries",
  "manageInspections",
  "managePricing",
  "manageQuotes",
  "manageUsers",
  "manageAdmins"
];

export const SUPER_ADMIN_DEFAULT_PERMISSIONS: AdminPermissions = {
  manageVehicles: true,
  deleteListings: true,
  manageOffers: true,
  manageEnquiries: true,
  manageInspections: true,
  managePricing: true,
  manageQuotes: true,
  manageUsers: true,
  manageAdmins: true
};

export const DEFAULT_ADMIN_PERMISSIONS: AdminPermissions = {
  manageVehicles: true,
  deleteListings: false,
  manageOffers: true,
  manageEnquiries: true,
  manageInspections: true,
  managePricing: true,
  manageQuotes: true,
  manageUsers: false,
  manageAdmins: false
};

export function normalizeEmailAddress(email?: string | null) {
  return (email ?? "").trim().toLowerCase();
}

export function isCraigSuperAdminEmail(email?: string | null) {
  return normalizeEmailAddress(email) === CRAIG_SUPER_ADMIN_EMAIL;
}

export function isSeededAdminEmail(email?: string | null) {
  return normalizeEmailAddress(email) === LEON_ADMIN_EMAIL;
}

export function resolveStoredUserRole(input?: string | null): UserRole {
  if (input === "super_admin" || input === "admin" || input === "seller" || input === "dealer" || input === "buyer") {
    return input;
  }
  return "seller";
}

export function createAdminPermissions(overrides?: Partial<AdminPermissions>): AdminPermissions {
  return {
    ...DEFAULT_ADMIN_PERMISSIONS,
    ...overrides
  };
}

export function createSuperAdminPermissions(overrides?: Partial<AdminPermissions>): AdminPermissions {
  return {
    ...SUPER_ADMIN_DEFAULT_PERMISSIONS,
    ...overrides
  };
}

export function getDefaultAdminPermissions(role: UserRole, email?: string | null, storedPermissions?: Partial<AdminPermissions> | null) {
  if (role === "super_admin" || isCraigSuperAdminEmail(email)) {
    return createSuperAdminPermissions(storedPermissions ?? undefined);
  }

  if (role === "admin") {
    return createAdminPermissions(storedPermissions ?? undefined);
  }

  if (storedPermissions) {
    return createAdminPermissions(storedPermissions);
  }

  return undefined;
}

export function resolveManagedUserAccess(input: {
  email?: string | null;
  storedRole?: string | null;
  storedPermissions?: Partial<AdminPermissions> | null;
}) {
  const email = normalizeEmailAddress(input.email);
  const storedRole = resolveStoredUserRole(input.storedRole);
  const hasStoredPermissions = Boolean(input.storedPermissions);

  if (isCraigSuperAdminEmail(email)) {
    return {
      role: "super_admin" as const,
      adminPermissions: createSuperAdminPermissions(input.storedPermissions ?? undefined)
    };
  }

  if (storedRole === "admin" || storedRole === "super_admin" || hasStoredPermissions) {
    const normalizedRole = storedRole === "super_admin" ? "admin" : storedRole;
    return {
      role: normalizedRole,
      adminPermissions: getDefaultAdminPermissions(normalizedRole, email, input.storedPermissions)
    };
  }

  if (isSeededAdminEmail(email)) {
    return {
      role: "admin" as const,
      adminPermissions: createAdminPermissions(input.storedPermissions ?? undefined)
    };
  }

  return {
    role: storedRole,
    adminPermissions: undefined
  };
}

export function isAdminLikeRole(role?: UserRole) {
  return role === "admin" || role === "super_admin";
}

export function isSellerLikeRole(role?: UserRole) {
  return role === "seller" || role === "dealer";
}

export function isSellerWorkspaceRole(role?: UserRole) {
  return role === "seller" || role === "buyer" || role === "dealer";
}

export function assertApprovedDealer(
  actor: Pick<AppUser, "role" | "dealerStatus"> | { role?: UserRole; dealerStatus?: DealerStatus },
  message = "Your dealer application is still under review, so dealer features are temporarily unavailable."
) {
  if (actor.role !== "dealer" || actor.dealerStatus !== "approved") {
    throw new Error(message);
  }
}

export function isSuperAdminUser(user?: Pick<AppUser, "role" | "email"> | null) {
  return user?.role === "super_admin" || isCraigSuperAdminEmail(user?.email);
}

export function hasAdminPermission(
  user: Pick<AppUser, "role" | "email" | "adminPermissions"> | null | undefined,
  permission: AdminPermissionKey
) {
  if (!user) return false;
  if (isSuperAdminUser(user)) return true;
  if (user.role !== "admin") return false;
  return Boolean(user.adminPermissions?.[permission]);
}

export function requireAdminPermission(
  user: Pick<AppUser, "role" | "email" | "adminPermissions"> | null | undefined,
  permission: AdminPermissionKey,
  message = "You do not have access to this admin action."
) {
  if (!hasAdminPermission(user, permission)) {
    throw new Error(message);
  }
}

export const CONTACT_MESSAGE_STATUS_FLOW: Record<ContactMessageStatus, ContactMessageStatus[]> = {
  NEW: ["CONTACTED", "CLOSED"],
  CONTACTED: ["CLOSED"],
  CLOSED: []
};

export function canAccessRole(required: UserRole | UserRole[], actual?: UserRole) {
  if (!actual) return false;
  const requiredRoles = Array.isArray(required) ? required : [required];
  if (requiredRoles.includes(actual)) return true;
  if (actual === "dealer" && requiredRoles.includes("seller")) return true;
  if (actual === "super_admin" && requiredRoles.includes("admin")) return true;
  return false;
}

export function getViewingApprovalMessage(listingType: ListingType, warehouseAddress?: string) {
  if (listingType === "warehouse") {
    return `Viewing approved. CarNest warehouse location: ${warehouseAddress ?? "Address available in admin records."}`;
  }
  return "Viewing approved. CarNest will contact you to manually arrange the private inspection.";
}

export function getListingLabel(listingType: ListingType) {
  return listingType === "warehouse" ? "Warehouse Vehicle" : "Online Listing";
}

export function getPublicVehicleLocation(vehicle: Vehicle) {
  return vehicle.listingType === "warehouse"
    ? "CarNest Secure Warehouse (Inspection by appointment)"
    : vehicle.sellerLocationSuburb || "Private location";
}

export function getListingDescriptionLines(vehicle: Vehicle) {
  if (vehicle.listingType === "warehouse") {
    return [
      "Available for inspection at CarNest Warehouse",
      "Detailed location provided after viewing approval"
    ];
  }

  return [
    `Seller suburb: ${vehicle.sellerLocationSuburb || "Private location"}`,
    "No exact address displayed"
  ];
}

export function getVehicleImage(vehicle: Vehicle) {
  return (
    vehicle.imageAssets?.[0]?.thumbnailUrl
    || vehicle.coverImage
    || vehicle.imageAssets?.[0]?.fullUrl
    || vehicle.coverImageUrl
    || vehicle.imageUrls[0]
    || vehicle.images[0]
    || VEHICLE_PLACEHOLDER_IMAGE
  );
}

export function getVehicleImageCandidates(vehicle: Vehicle) {
  return Array.from(
    new Set(
      [
        vehicle.imageAssets?.[0]?.thumbnailUrl,
        vehicle.coverImage,
        vehicle.imageAssets?.[0]?.fullUrl,
        vehicle.coverImageUrl,
        vehicle.imageUrls?.[0],
        vehicle.images?.[0],
        VEHICLE_PLACEHOLDER_IMAGE
      ].filter((value): value is string => Boolean(value))
    )
  );
}

export function getVehicleGallery(vehicle: Vehicle) {
  const optimizedUrls = vehicle.imageAssets?.map((item) => item.fullUrl).filter(Boolean) ?? [];
  if (optimizedUrls.length) return optimizedUrls;
  const urls = vehicle.imageUrls?.length ? vehicle.imageUrls : vehicle.images;
  return urls.length ? urls : [getVehicleImage(vehicle)];
}

export function getVehicleStatusLabel(status: VehicleStatus) {
  if (status === "pending") return "Pending review";
  if (status === "approved") return "Approved";
  return "Rejected";
}

export function getVehicleStatusTone(status: VehicleStatus) {
  if (status === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "rejected") return "bg-red-50 text-red-700 border-red-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export function getSellerVehicleStatusLabel(status: SellerVehicleStatus) {
  if (status === "ACTIVE") return "Active";
  if (status === "UNDER_OFFER") return "Under Offer";
  if (status === "PAUSED") return "Paused";
  if (status === "WITHDRAWN") return "Withdrawn";
  return "Sold";
}

export function getSellerVehicleStatusTone(status: SellerVehicleStatus) {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "UNDER_OFFER") return "bg-[#FFF4E8] text-[#B54708] border-[#F5D7B2]";
  if (status === "PAUSED") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "WITHDRAWN") return "bg-zinc-100 text-zinc-700 border-zinc-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

export const SELLER_VEHICLE_STATUS_FLOW: Record<SellerVehicleStatus, SellerVehicleStatus[]> = {
  ACTIVE: ["PAUSED", "WITHDRAWN", "SOLD"],
  UNDER_OFFER: ["ACTIVE", "WITHDRAWN", "SOLD"],
  PAUSED: ["ACTIVE", "WITHDRAWN", "SOLD"],
  WITHDRAWN: ["ACTIVE", "SOLD"],
  SOLD: ["ACTIVE", "WITHDRAWN"]
};

export function getSellerVehicleActionLabel(status: SellerVehicleStatus) {
  if (status === "ACTIVE") return "Resume Listing";
  if (status === "UNDER_OFFER") return "Mark Under Offer";
  if (status === "PAUSED") return "Pause Listing";
  if (status === "WITHDRAWN") return "Withdraw Listing";
  return "Mark as Sold";
}

export function getSellerVehicleAvailableStatuses(status: SellerVehicleStatus) {
  return SELLER_VEHICLE_STATUS_FLOW[status];
}

export function getSellerListingStatusLabel(vehicle: Pick<Vehicle, "status" | "sellerStatus">) {
  if (vehicle.sellerStatus === "SOLD") return "Sold";
  if (vehicle.sellerStatus === "UNDER_OFFER") return "Under Offer";
  if (vehicle.sellerStatus === "WITHDRAWN") return "Withdrawn";
  if (vehicle.sellerStatus === "PAUSED") return "Paused";
  if (vehicle.status !== "approved") return "Pending Review";
  return "Live";
}

export function getSellerListingStatusTone(vehicle: Pick<Vehicle, "status" | "sellerStatus">) {
  if (vehicle.sellerStatus === "SOLD") return "bg-blue-50 text-blue-700 border-blue-200";
  if (vehicle.sellerStatus === "UNDER_OFFER") return "bg-[#FFF4E8] text-[#B54708] border-[#F5D7B2]";
  if (vehicle.sellerStatus === "WITHDRAWN") return "bg-zinc-100 text-zinc-700 border-zinc-200";
  if (vehicle.sellerStatus === "PAUSED") return "bg-amber-50 text-amber-700 border-amber-200";
  if (vehicle.status !== "approved") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

export function getOfferStatusLabel(status: OfferStatus) {
  if (status === "pending") return "Pending";
  if (status === "countered") return "Countered";
  if (status === "accepted") return "Accepted";
  if (status === "declined" || status === "rejected") return "Declined";
  if (status === "accepted_pending_buyer_confirmation") return "Awaiting Buyer Confirmation";
  if (status === "buyer_confirmed") return "Buyer Confirmed";
  if (status === "buyer_declined") return "Buyer Declined";
  return "Declined";
}

export function getOfferStatusTone(status: OfferStatus) {
  if (status === "accepted") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "countered") return "bg-[#FFF4E8] text-[#B54708] border-[#F5D7B2]";
  if (status === "declined" || status === "rejected") return "bg-red-50 text-red-700 border-red-200";
  if (status === "buyer_confirmed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "accepted_pending_buyer_confirmation") return "bg-[#FFF4E8] text-[#B54708] border-[#F5D7B2]";
  if (status === "buyer_declined") return "bg-zinc-100 text-zinc-700 border-zinc-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export function getQuoteStatusLabel(status: QuoteStatus) {
  if (status === "NEW") return "New";
  if (status === "CONTACTED") return "Contacted";
  if (status === "QUOTED") return "Quoted";
  return "Closed";
}

export function getQuoteStatusTone(status: QuoteStatus) {
  if (status === "CONTACTED") return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === "QUOTED") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "CLOSED") return "bg-zinc-100 text-zinc-700 border-zinc-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export function getInspectionRequestStatusLabel(status: InspectionRequestStatus) {
  if (status === "CONTACTED") return "Contacted";
  if (status === "BOOKED") return "Booked";
  if (status === "CLOSED") return "Closed";
  return "New";
}

export function getInspectionRequestStatusTone(status: InspectionRequestStatus) {
  if (status === "CONTACTED") return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === "BOOKED") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "CLOSED") return "bg-zinc-100 text-zinc-700 border-zinc-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export function normalizeContactMessageStatus(status: string): ContactMessageStatus {
  if (status === "CONTACTED" || status === "CLOSED") return status;
  return "NEW";
}

export function getAvailableContactMessageStatuses(status: string) {
  return CONTACT_MESSAGE_STATUS_FLOW[normalizeContactMessageStatus(status)];
}

export function getContactMessageStatusLabel(status: string) {
  return normalizeContactMessageStatus(status);
}

export function getContactMessageStatusTone(status: string) {
  const normalizedStatus = normalizeContactMessageStatus(status);

  if (normalizedStatus === "CONTACTED") return "bg-blue-50 text-blue-700 border-blue-200";
  if (normalizedStatus === "CLOSED") return "bg-zinc-100 text-zinc-700 border-zinc-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export function getContactMessageStatusMenu(status: string) {
  const normalizedStatus = normalizeContactMessageStatus(status);

  return {
    status: normalizedStatus,
    hint: normalizedStatus === "CONTACTED" ? "Already contacted" : null,
    actions: CONTACT_MESSAGE_STATUS_FLOW[normalizedStatus],
    emptyMessage: "No further status changes available."
  };
}
