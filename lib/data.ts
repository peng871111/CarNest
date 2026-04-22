import { Timestamp, addDoc, collection, deleteDoc, deleteField, doc, documentId, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { findAustralianPostcodeLocation, getAustralianPostcodeLocations, isAustralianPostcode } from "@/lib/australian-postcodes";
import { verifyDealerLicenceByState } from "@/lib/dealer-licence-verification";
import { isValidAustralianMobileNumber, isValidEmailAddress } from "@/lib/form-safety";
import { sampleVehicles } from "@/lib/constants";
import {
  assertApprovedDealer,
  createAdminPermissions,
  createSuperAdminPermissions,
  hasAdminPermission,
  isAdminLikeRole,
  isSellerLikeRole,
  isSellerWorkspaceRole,
  isSuperAdminUser,
  resolveManagedUserAccess
} from "@/lib/permissions";
import { buildAbsoluteUrl } from "@/lib/seo";
import { deleteVehicleImageFile } from "@/lib/storage";
import {
  AdminPermissions,
  AppUser,
  ComplianceAlert,
  ComplianceStatus,
  ComplianceVehicleActivity,
  ContactMessage,
  ContactMessageCategory,
  ContactMessageStatus,
  DealerApplication,
  DealerApplicationRiskLevel,
  DealerLicenceVerificationStatus,
  DealerStatus,
  InspectionRequest,
  InspectionRequestStatus,
  Offer,
  OfferContactVisibilityState,
  OfferContactUnlockSource,
  OfferThreadEntry,
  OfferMessageSender,
  OfferStatus,
  PricingLeadRating,
  PricingNextAction,
  PricingRequest,
  PricingRequestStatus,
  PricingRequestTimeline,
  Quote,
  QuoteSource,
  QuoteStatus,
  QuoteType,
  SavedVehicle,
  SellerVehicleStatus,
  SellerTrustInfo,
  UserRole,
  UserComplianceAssessment,
  Vehicle,
  VehicleActivityEvent,
  VehicleActor,
  VehicleAnalytics,
  VehicleAnalyticsBreakdown,
  VehicleFormInput,
  VehicleStatus,
  VehicleViewEvent,
  VehicleViewRole,
  VehicleDeviceType,
  UserSupportDealerRiskAccount,
  UserSupportAccountMetrics,
  UserSupportHighActivityAccount,
  UserSupportRecord,
  UserSupportSuggestion
} from "@/types";

type CollectionName =
  | "users"
  | "vehicles"
  | "offers"
  | "quotes"
  | "contact_messages"
  | "pricingRequests"
  | "inspectionRequests"
  | "savedVehicles"
  | "complianceAlerts"
  | "dealerApplications"
  | "vehicleActivityEvents"
  | "vehicleViewEvents"
  | "vehicleAnalytics";
export type VehicleDataSource = "firestore" | "mock";

interface CollectionResult<T> {
  items: T[];
  source: VehicleDataSource;
  error?: string;
}

interface VehicleWriteResult {
  vehicle: Vehicle;
  source: VehicleDataSource;
  writeSucceeded: boolean;
  descriptionReviewPending?: boolean;
}

export interface OfferWriteInput {
  userId: string;
  vehicleId: string;
  vehicleTitle: string;
  vehiclePrice: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  offerAmount: number;
  message: string;
  sellerOwnerUid: string;
  submittedByUid?: string;
}

interface OfferWriteResult {
  offer: Offer;
  source: VehicleDataSource;
  writeSucceeded: boolean;
}

export interface DealerApplicationWriteInput {
  legalBusinessName: string;
  tradingName: string;
  abn: string;
  acn: string;
  lmctNumber: string;
  contactPersonName: string;
  contactPhone: string;
  contactEmail: string;
  businessAddressLine1: string;
  businessSuburb: string;
  businessPostcode: string;
  businessState: string;
  licenceState: string;
  licenceExpiry: string;
  licenceVerificationStatus: DealerLicenceVerificationStatus;
  licenceVerificationNote?: string;
  licenceVerificationSource?: string;
  lmctProofUploadUrl: string;
  lmctProofUploadName?: string;
  lmctProofUploadContentType?: string;
}

export interface DealerApplicationWriteResult {
  application: DealerApplication;
  source: VehicleDataSource;
  writeSucceeded: boolean;
}

export interface InspectionRequestWriteInput {
  vehicleId: string;
  vehicleTitle: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  preferredTime: string;
  message: string;
  listingType: Vehicle["listingType"];
  sellerOwnerUid: string;
  submittedByUid: string;
}

interface InspectionRequestWriteResult {
  inspectionRequest: InspectionRequest;
  source: VehicleDataSource;
  writeSucceeded: boolean;
}

export interface SaveVehicleWriteInput {
  userId: string;
  vehicleId: string;
}

interface SaveVehicleWriteResult {
  savedVehicle: SavedVehicle;
  source: VehicleDataSource;
  writeSucceeded: boolean;
}

interface OfferActivityNotificationLog {
  id: string;
  vehicleId: string;
  offerId: string;
  relatedOfferId: string;
  recipientUserId: string;
  recipientEmail: string;
  actorUid: string;
  subject: string;
  message: string;
  vehicleLink: string;
  deliveryChannel: "email";
  createdAt?: string;
}

type DealerApplicationDuplicateMatchFlags = DealerApplication["duplicateMatchFlags"];
type DealerApplicationTrustIndicators = DealerApplication["trustIndicators"];

export interface VehicleViewEventWriteInput {
  vehicleId: string;
  sessionId: string;
  userId?: string;
  role: VehicleViewRole;
  source: string;
  referrer: string;
  deviceType: VehicleDeviceType;
  country?: string;
  state?: string;
  city?: string;
  listingType: Vehicle["listingType"];
  sellerOwnerUid: string;
}

export interface QuoteWriteInput {
  ownerId: string;
  sellerUid: string;
  sellerName: string;
  sellerEmail: string;
  vehicleId?: string;
  vehicleYear: number;
  vehicleMake: string;
  vehicleModel: string;
  quoteType: QuoteType;
  source: QuoteSource;
  notes: string;
}

interface QuoteWriteResult {
  quote: Quote;
  source: VehicleDataSource;
  writeSucceeded: boolean;
}

const DEALER_APPLICATION_RESUBMIT_COOLDOWN_MS = 15 * 60 * 1000;

export interface ContactMessageWriteInput {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  category: ContactMessageCategory;
}

interface ContactMessageWriteResult {
  contactMessage: ContactMessage;
  source: VehicleDataSource;
  writeSucceeded: boolean;
}

export interface PricingRequestWriteInput {
  userId: string;
  vehicleId?: string;
  currentPrice?: number;
  timeline: PricingRequestTimeline;
  message: string;
}

interface PricingRequestWriteResult {
  pricingRequest: PricingRequest;
  source: VehicleDataSource;
  writeSucceeded: boolean;
}

export interface PricingRequestUpdateInput {
  status: PricingRequestStatus;
  response?: string;
  leadRating?: PricingLeadRating;
  nextAction?: PricingNextAction;
}

export interface UserAccessUpdateInput {
  role: UserRole;
  adminPermissions?: Partial<AdminPermissions>;
}

async function getCollection<T>(
  name: CollectionName,
  fallback: T[],
  serializer: (id: string, data: Record<string, unknown>) => T = serializeDoc
): Promise<CollectionResult<T>> {
  if (!isFirebaseConfigured) {
    return { items: fallback, source: "mock" };
  }

  try {
    const snapshot = await getDocs(collection(db, name));
    const items = snapshot.docs
      .map((item) => serializer(item.id, item.data()))
      .sort((a, b) => {
        const aCreatedAt = (a as { createdAt?: string }).createdAt ?? "";
        const bCreatedAt = (b as { createdAt?: string }).createdAt ?? "";
        return bCreatedAt.localeCompare(aCreatedAt);
      });

    return {
      items,
      source: "firestore"
    };
  } catch (error) {
    return {
      items: [],
      source: "firestore",
      error: error instanceof Error ? error.message : "Unknown Firestore read error"
    };
  }
}

function serializeDate(value: unknown) {
  if (value && typeof value === "object" && "toDate" in (value as Record<string, unknown>)) {
    return ((value as { toDate: () => Date }).toDate()).toISOString();
  }
  return typeof value === "string" ? value : undefined;
}

function normalizeVehicleStatus(status: unknown): VehicleStatus {
  if (status === "approved" || status === "pending" || status === "rejected") {
    return status;
  }

  if (String(status).toUpperCase() === "SOLD") {
    return "approved";
  }

  return "pending";
}

function normalizeSellerVehicleStatus(status: unknown, fallbackStatus?: unknown): SellerVehicleStatus {
  if (status === "ACTIVE" || status === "UNDER_OFFER" || status === "PAUSED" || status === "WITHDRAWN" || status === "SOLD") {
    return status;
  }

  if (String(fallbackStatus).toUpperCase() === "SOLD") {
    return "SOLD";
  }

  return "ACTIVE";
}

function serializeDoc<T>(id: string, data: Record<string, unknown>) {
  return {
    id,
    ...data,
    soldAt: serializeDate(data.soldAt),
    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt)
  } as T;
}

function normalizeAdminPermissions(value: unknown, role?: UserRole, email?: string) {
  if (!value || typeof value !== "object") {
    return resolveManagedUserAccess({
      email,
      storedRole: role,
      storedPermissions: undefined
    }).adminPermissions;
  }

  const raw = value as Record<string, unknown>;
  const normalized = Object.fromEntries(Object.entries(raw).map(([key, entry]) => [key, Boolean(entry)])) as Partial<AdminPermissions>;
  return resolveManagedUserAccess({
    email,
    storedRole: role,
    storedPermissions: normalized
  }).adminPermissions;
}

function serializeUserDoc(id: string, data: Record<string, unknown>): AppUser {
  const email = typeof data.email === "string" ? data.email : "";
  const managedAccess = resolveManagedUserAccess({
    email,
    storedRole: typeof data.role === "string" ? data.role : "seller",
    storedPermissions: data.adminPermissions && typeof data.adminPermissions === "object" ? (data.adminPermissions as Record<string, boolean>) : undefined
  });

  return {
    id,
    email,
    displayName: String(data.displayName ?? data.name ?? "CarNest User"),
    name: typeof data.name === "string" ? data.name : String(data.displayName ?? "CarNest User"),
    phone: typeof data.phone === "string" ? data.phone : "",
    emailVerified: typeof data.emailVerified === "boolean" ? data.emailVerified : undefined,
    accountBanned: Boolean(data.accountBanned),
    accountReference: typeof data.accountReference === "string" ? data.accountReference : undefined,
    role: managedAccess.role,
    adminPermissions: normalizeAdminPermissions(data.adminPermissions, managedAccess.role, email),
    complianceStatus:
      data.complianceStatus === "possible_unlicensed_trader" || data.complianceStatus === "verified_dealer"
        ? data.complianceStatus
        : "clear",
    complianceFlaggedAt: serializeDate(data.complianceFlaggedAt),
    dealerStatus:
      data.dealerStatus === "submitted_unverified"
      || data.dealerStatus === "pending"
      || data.dealerStatus === "info_requested"
      || data.dealerStatus === "approved"
      || data.dealerStatus === "rejected"
        ? data.dealerStatus
        : "none",
    dealerVerified: Boolean(data.dealerVerified),
    dealerApplicationId: typeof data.dealerApplicationId === "string" ? data.dealerApplicationId : undefined,
    listingRestricted: Boolean(data.listingRestricted),
    createdAt: serializeDate(data.createdAt)
  };
}

function serializeVehicleDoc(id: string, data: Record<string, unknown>): Vehicle {
  const legacyImages = Array.isArray(data.images) ? (data.images as string[]) : [];
  const imageUrls = Array.isArray(data.imageUrls) ? (data.imageUrls as string[]) : legacyImages;
  const coverImage =
    typeof data.coverImage === "string" && data.coverImage
      ? (data.coverImage as string)
      : typeof data.coverImageUrl === "string" && data.coverImageUrl
        ? (data.coverImageUrl as string)
        : imageUrls[0];
  const coverImageUrl =
    typeof data.coverImageUrl === "string" && data.coverImageUrl
      ? (data.coverImageUrl as string)
      : coverImage;
  const normalizedVehicleStatus = normalizeVehicleStatus(data.status);
  const normalizedSellerStatus = normalizeSellerVehicleStatus(data.sellerStatus, data.status);

  return {
    id,
    ...data,
    status: normalizedVehicleStatus,
    sellerStatus: normalizedSellerStatus,
    approvedAt: serializeDate(data.approvedAt),
    deleted: Boolean(data.deleted),
    deletedAt: serializeDate(data.deletedAt),
    deletedBy: typeof data.deletedBy === "string" ? data.deletedBy : "",
    deleteReason: typeof data.deleteReason === "string" ? data.deleteReason : "",
    regoExpiry: typeof data.regoExpiry === "string" ? data.regoExpiry : "",
    sellerLocationPostcode: typeof data.sellerLocationPostcode === "string" ? data.sellerLocationPostcode : "",
    manualReviewReason: data.manualReviewReason === "possible_unlicensed_trader" ? "possible_unlicensed_trader" : undefined,
    coverImage,
    coverImageUrl,
    imageUrls,
    images: imageUrls,
    soldAt: serializeDate(data.soldAt),
    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt)
  } as Vehicle;
}

function serializeVehicleActivityEventDoc(id: string, data: Record<string, unknown>): VehicleActivityEvent {
  return {
    id,
    vehicleId: typeof data.vehicleId === "string" ? data.vehicleId : "",
    type: data.type === "offer_created" ? "offer_created" : "offer_created",
    message: typeof data.message === "string" ? data.message : "",
    actorUid: typeof data.actorUid === "string" ? data.actorUid : undefined,
    createdAt: serializeDate(data.createdAt)
  };
}

function serializeSavedVehicleDoc(id: string, data: Record<string, unknown>): SavedVehicle {
  return {
    id,
    userId: typeof data.userId === "string" ? data.userId : "",
    vehicleId: typeof data.vehicleId === "string" ? data.vehicleId : "",
    createdAt: serializeDate(data.createdAt),
    lastViewedActivityAt: serializeDate(data.lastViewedActivityAt)
  };
}

function serializeOfferActivityNotificationDoc(id: string, data: Record<string, unknown>): OfferActivityNotificationLog {
  return {
    id,
    vehicleId: typeof data.vehicleId === "string" ? data.vehicleId : "",
    offerId: typeof data.offerId === "string" ? data.offerId : "",
    relatedOfferId: typeof data.relatedOfferId === "string" ? data.relatedOfferId : "",
    recipientUserId: typeof data.recipientUserId === "string" ? data.recipientUserId : "",
    recipientEmail: typeof data.recipientEmail === "string" ? data.recipientEmail : "",
    actorUid: typeof data.actorUid === "string" ? data.actorUid : "",
    subject: typeof data.subject === "string" ? data.subject : "",
    message: typeof data.message === "string" ? data.message : "",
    vehicleLink: typeof data.vehicleLink === "string" ? data.vehicleLink : "",
    deliveryChannel: data.deliveryChannel === "email" ? "email" : "email",
    createdAt: serializeDate(data.createdAt)
  };
}

function serializeComplianceAlertDoc(id: string, data: Record<string, unknown>): ComplianceAlert {
  const activities = Array.isArray(data.activities)
    ? (data.activities as Record<string, unknown>[])
        .map((item) => {
          const eventType: ComplianceVehicleActivity["eventType"] =
            item.eventType === "listing_published" || item.eventType === "listing_sold" ? item.eventType : "listing_created";

          return {
            vehicleId: typeof item.vehicleId === "string" ? item.vehicleId : "",
            eventType,
            qualifyingAt: serializeDate(item.qualifyingAt) ?? ""
          };
        })
        .filter((item) => item.vehicleId && item.qualifyingAt)
    : [];

  return {
    id,
    userId: typeof data.userId === "string" ? data.userId : "",
    alertType: data.alertType === "possible_unlicensed_trader" ? "possible_unlicensed_trader" : "possible_unlicensed_trader",
    status: data.status === "resolved" ? "resolved" : "open",
    activityCount: Number(data.activityCount ?? activities.length),
    activities,
    triggeredByVehicleId: typeof data.triggeredByVehicleId === "string" ? data.triggeredByVehicleId : undefined,
    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt),
    resolvedAt: serializeDate(data.resolvedAt)
  };
}

function serializeDealerApplicationDoc(id: string, data: Record<string, unknown>): DealerApplication {
  const legacyAcnOrAbn = typeof data.acnOrAbn === "string" ? data.acnOrAbn.replace(/\D/g, "") : "";
  const serializedAbn = typeof data.abn === "string" ? data.abn.replace(/\D/g, "") : "";
  const serializedAcn = typeof data.acn === "string" ? data.acn.replace(/\D/g, "") : "";
  const duplicateMatchFlags = data.duplicateMatchFlags && typeof data.duplicateMatchFlags === "object"
    ? data.duplicateMatchFlags as Record<string, unknown>
    : {};
  const duplicateFlags = data.duplicateFlags && typeof data.duplicateFlags === "object"
    ? data.duplicateFlags as Record<string, unknown>
    : duplicateMatchFlags;
  const trustIndicators = data.trustIndicators && typeof data.trustIndicators === "object"
    ? data.trustIndicators as Record<string, unknown>
    : {};
  const proofFiles = Array.isArray(data.lmctProofUploads)
    ? data.lmctProofUploads
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
        .map((entry) => ({
          url: typeof entry.url === "string" ? entry.url : "",
          name: typeof entry.name === "string" ? entry.name : undefined,
          contentType: typeof entry.contentType === "string" ? entry.contentType : undefined
        }))
        .filter((entry) => Boolean(entry.url))
    : [];
  const singleProofFile =
    typeof data.lmctProofUploadUrl === "string" && data.lmctProofUploadUrl
      ? [{
          url: data.lmctProofUploadUrl,
          name: typeof data.lmctProofUploadName === "string"
            ? data.lmctProofUploadName
            : typeof data.lmctCertificateName === "string"
              ? data.lmctCertificateName
              : undefined,
          contentType: typeof data.lmctProofUploadContentType === "string" ? data.lmctProofUploadContentType : undefined
        }]
      : typeof data.lmctCertificateUrl === "string" && data.lmctCertificateUrl
        ? [{
            url: data.lmctCertificateUrl,
            name: typeof data.lmctCertificateName === "string" ? data.lmctCertificateName : undefined,
            contentType: undefined
          }]
        : [];
  const normalizedProofFiles = proofFiles.length ? proofFiles : singleProofFile;

  return {
    id,
    userId: typeof data.userId === "string" ? data.userId : "",
    dealerStatus:
      data.dealerStatus === "approved"
      || data.dealerStatus === "rejected"
      || data.dealerStatus === "info_requested"
      || data.dealerStatus === "pending"
      || data.dealerStatus === "submitted_unverified"
        ? data.dealerStatus
        : "pending",
    legalBusinessName: typeof data.legalBusinessName === "string" ? data.legalBusinessName : "",
    tradingName: typeof data.tradingName === "string" ? data.tradingName : "",
    abn: serializedAbn || (legacyAcnOrAbn.length === 11 ? legacyAcnOrAbn : ""),
    acn: serializedAcn || (legacyAcnOrAbn.length === 9 ? legacyAcnOrAbn : ""),
    lmctNumber: typeof data.lmctNumber === "string" ? data.lmctNumber : "",
    contactPersonName:
      typeof data.contactPersonName === "string"
        ? data.contactPersonName
        : typeof data.contactPerson === "string"
          ? data.contactPerson
          : "",
    contactPhone:
      typeof data.contactPhone === "string"
        ? data.contactPhone
        : typeof data.phone === "string"
          ? data.phone
          : "",
    contactEmail:
      typeof data.contactEmail === "string"
        ? data.contactEmail
        : typeof data.email === "string"
          ? data.email
          : "",
    businessAddressLine1:
      typeof data.businessAddressLine1 === "string"
        ? data.businessAddressLine1
        : typeof data.businessAddress === "string"
          ? data.businessAddress
          : "",
    businessSuburb: typeof data.businessSuburb === "string" ? data.businessSuburb : "",
    businessPostcode: typeof data.businessPostcode === "string" ? data.businessPostcode : "",
    businessState: typeof data.businessState === "string" ? data.businessState : "",
    licenceState: typeof data.licenceState === "string" ? data.licenceState : "",
    licenceExpiry: typeof data.licenceExpiry === "string" ? data.licenceExpiry : "",
    licenceVerificationStatus:
      data.licenceVerificationStatus === "verified"
      || data.licenceVerificationStatus === "auto_failed"
        ? data.licenceVerificationStatus
        : "manual_review_required",
    licenceVerificationNote: typeof data.licenceVerificationNote === "string" ? data.licenceVerificationNote : undefined,
    licenceVerificationSource: typeof data.licenceVerificationSource === "string" ? data.licenceVerificationSource : undefined,
    lmctProofUploadUrl:
      typeof data.lmctProofUploadUrl === "string"
        ? data.lmctProofUploadUrl
        : typeof data.lmctCertificateUrl === "string"
          ? data.lmctCertificateUrl
          : "",
    lmctProofUploadName:
      typeof data.lmctProofUploadName === "string"
        ? data.lmctProofUploadName
        : typeof data.lmctCertificateName === "string"
          ? data.lmctCertificateName
          : undefined,
    lmctProofUploadContentType: typeof data.lmctProofUploadContentType === "string" ? data.lmctProofUploadContentType : undefined,
    proofFiles: normalizedProofFiles,
    riskLevel:
      data.riskLevel === "high" || data.riskLevel === "medium"
        ? data.riskLevel
        : "low",
    spamRiskLevel:
      data.spamRiskLevel === "high" || data.spamRiskLevel === "medium"
        ? data.spamRiskLevel
        : data.riskLevel === "high" || data.riskLevel === "medium"
          ? data.riskLevel
          : "low",
    duplicateFlags: {
      hasAny: Boolean(duplicateFlags.hasAny),
      lmctNumber: Boolean(duplicateFlags.lmctNumber),
      abn: Boolean(duplicateFlags.abn),
      acn: Boolean(duplicateFlags.acn),
      contactPhone: Boolean(duplicateFlags.contactPhone),
      contactEmail: Boolean(duplicateFlags.contactEmail)
    },
    duplicateMatchFlags: {
      hasAny: Boolean(duplicateMatchFlags.hasAny),
      lmctNumber: Boolean(duplicateMatchFlags.lmctNumber),
      abn: Boolean(duplicateMatchFlags.abn),
      acn: Boolean(duplicateMatchFlags.acn),
      contactPhone: Boolean(duplicateMatchFlags.contactPhone),
      contactEmail: Boolean(duplicateMatchFlags.contactEmail)
    },
    duplicateMatchedApplicationIds: Array.isArray(data.duplicateMatchedApplicationIds)
      ? data.duplicateMatchedApplicationIds.filter((item): item is string => typeof item === "string")
      : [],
    trustIndicators: {
      proofPresent: Boolean(trustIndicators.proofPresent),
      validAbnOrAcnFormat: Boolean(trustIndicators.validAbnOrAcnFormat),
      lmctNumberPresent: Boolean(trustIndicators.lmctNumberPresent),
      businessLocationConsistent: Boolean(trustIndicators.businessLocationConsistent),
      freeEmailDomain: Boolean(trustIndicators.freeEmailDomain),
      repeatedRejectedApplications: Boolean(trustIndicators.repeatedRejectedApplications)
    },
    rejectionHistoryCount: Number(data.rejectionHistoryCount ?? 0),
    status:
      data.status === "approved" || data.status === "rejected" || data.status === "info_requested"
        ? data.status
        : "pending",
    requestedAt: serializeDate(data.requestedAt ?? data.createdAt),
    lastSubmittedAt: serializeDate(data.lastSubmittedAt),
    updatedAt: serializeDate(data.updatedAt),
    reviewedAt: serializeDate(data.reviewedAt),
    reviewedByUid: typeof data.reviewedByUid === "string" ? data.reviewedByUid : undefined,
    reviewedBy: typeof data.reviewedBy === "string" ? data.reviewedBy : undefined,
    rejectReason: typeof data.rejectReason === "string" ? data.rejectReason : undefined,
    infoRequestNote: typeof data.infoRequestNote === "string" ? data.infoRequestNote : undefined
  };
}

function serializePendingDescriptionDoc(data: Record<string, unknown>) {
  return {
    ownerUid: typeof data.ownerUid === "string" ? data.ownerUid : "",
    pendingDescription: typeof data.pendingDescription === "string" ? data.pendingDescription : ""
  };
}

function containsContactDetails(text: string) {
  const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const phonePattern = /(?:\+?\d[\d\s()/-]{7,}\d)/;
  const contactInstructionPattern =
    /\b(call|text|email|contact|reach|message|whatsapp|sms|telegram|wechat|instagram|facebook|dm|direct message|outside the platform|off[- ]platform)\b/i;

  return emailPattern.test(text) || phonePattern.test(text) || contactInstructionPattern.test(text);
}

function validateSellerVehicleDescription(description: string) {
  if (containsContactDetails(description)) {
    throw new Error("Description cannot include phone numbers, email addresses, or instructions to contact outside CarNest.");
  }
}

function validateVehicleLocation(input: VehicleFormInput) {
  if (input.listingType !== "private") return;

  const postcode = input.sellerLocationPostcode ?? "";
  const suburb = input.sellerLocationSuburb ?? "";
  const state = toUppercaseValue(input.sellerLocationState);

  if (!isAustralianPostcode(postcode)) {
    throw new Error("Please enter a valid 4-digit Australian postcode");
  }

  const postcodeMatches = getAustralianPostcodeLocations(postcode);
  if (!postcodeMatches.length) {
    throw new Error("Please enter a valid 4-digit Australian postcode");
  }

  const suburbMatch = findAustralianPostcodeLocation(postcode, suburb);
  if (!suburbMatch) {
    throw new Error(
      postcodeMatches.length > 1
        ? "Please select a seller suburb that matches the postcode."
        : "Seller suburb must match the selected postcode."
    );
  }

  if (state !== suburbMatch.state) {
    throw new Error("Seller state must match the selected suburb and postcode.");
  }
}

function normalizeDigitsOnly(value: string, maxLength?: number) {
  const digits = value.replace(/\D/g, "");
  return typeof maxLength === "number" ? digits.slice(0, maxLength) : digits;
}

function isFutureCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const expiry = new Date(`${value}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expiry.getTime() > today.getTime();
}

function isAllowedDealerProofValue(name: string, contentType?: string) {
  const normalizedName = name.trim().toLowerCase();
  const normalizedType = contentType?.trim().toLowerCase() ?? "";
  const allowedExtensions = [".pdf", ".jpg", ".jpeg", ".png"];
  const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];

  return allowedExtensions.some((extension) => normalizedName.endsWith(extension))
    || allowedTypes.includes(normalizedType);
}

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "gmx.com"
]);

function isFreeEmailDomain(email: string) {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return FREE_EMAIL_DOMAINS.has(domain);
}

function validateDealerBusinessLocation(suburb: string, postcode: string, state: string) {
  if (!isAustralianPostcode(postcode)) return false;

  const postcodeMatches = getAustralianPostcodeLocations(postcode);
  if (!postcodeMatches.length) return false;

  const suburbMatch = findAustralianPostcodeLocation(postcode, suburb);
  if (!suburbMatch) return false;

  return suburbMatch.state === toUppercaseValue(state);
}

function buildEmptyDuplicateMatchFlags(): DealerApplicationDuplicateMatchFlags {
  return {
    hasAny: false,
    lmctNumber: false,
    abn: false,
    acn: false,
    contactPhone: false,
    contactEmail: false
  };
}

async function getDealerApplicationDuplicateSignals(
  input: ReturnType<typeof normalizeDealerApplicationInput>,
  currentUserId: string
) {
  const flags = buildEmptyDuplicateMatchFlags();
  const matchedApplicationIds = [] as string[];

  if (!isFirebaseConfigured) {
    return { flags, matchedApplicationIds };
  }

  try {
    const snapshot = await getDocs(collection(db, "dealerApplications"));
    for (const item of snapshot.docs) {
      if (item.id === currentUserId) continue;

      const application = serializeDealerApplicationDoc(item.id, item.data());
      const matchesCurrent =
        (input.lmctNumber && application.lmctNumber === input.lmctNumber)
        || (input.abn && application.abn === input.abn)
        || (input.acn && application.acn === input.acn)
        || (input.contactPhone && application.contactPhone === input.contactPhone)
        || (input.contactEmail && application.contactEmail === input.contactEmail);

      if (!matchesCurrent) continue;

      if (input.lmctNumber && application.lmctNumber === input.lmctNumber) flags.lmctNumber = true;
      if (input.abn && application.abn === input.abn) flags.abn = true;
      if (input.acn && application.acn === input.acn) flags.acn = true;
      if (input.contactPhone && application.contactPhone === input.contactPhone) flags.contactPhone = true;
      if (input.contactEmail && application.contactEmail === input.contactEmail) flags.contactEmail = true;
      matchedApplicationIds.push(application.id);
    }
  } catch {
    return { flags, matchedApplicationIds };
  }

  flags.hasAny = flags.lmctNumber || flags.abn || flags.acn || flags.contactPhone || flags.contactEmail;
  return { flags, matchedApplicationIds };
}

function buildDealerApplicationTrustIndicators(
  input: ReturnType<typeof normalizeDealerApplicationInput>,
  options: {
    rejectionHistoryCount: number;
  }
): DealerApplicationTrustIndicators {
  return {
    proofPresent: Boolean(input.lmctProofUploadUrl),
    validAbnOrAcnFormat: Boolean((input.abn && /^\d{11}$/.test(input.abn)) || (input.acn && /^\d{9}$/.test(input.acn))),
    lmctNumberPresent: Boolean(input.lmctNumber),
    businessLocationConsistent: validateDealerBusinessLocation(input.businessSuburb, input.businessPostcode, input.businessState),
    freeEmailDomain: isFreeEmailDomain(input.contactEmail),
    repeatedRejectedApplications: options.rejectionHistoryCount > 0
  };
}

function computeDealerApplicationRiskLevel(input: {
  licenceVerificationStatus: DealerLicenceVerificationStatus;
  duplicateMatchFlags: DealerApplicationDuplicateMatchFlags;
  trustIndicators: DealerApplicationTrustIndicators;
}) {
  let score = 0;

  if (input.licenceVerificationStatus === "auto_failed") score += 2;
  if (input.duplicateMatchFlags.hasAny) score += 3;
  if (input.trustIndicators.freeEmailDomain) score += 1;
  if (input.trustIndicators.repeatedRejectedApplications) score += 2;
  if (!input.trustIndicators.businessLocationConsistent) score += 1;
  if (!input.trustIndicators.validAbnOrAcnFormat) score += 2;
  if (!input.trustIndicators.proofPresent) score += 2;
  if (!input.trustIndicators.lmctNumberPresent) score += 2;

  if (score >= 5) return "high" as DealerApplicationRiskLevel;
  if (score >= 2) return "medium" as DealerApplicationRiskLevel;
  return "low" as DealerApplicationRiskLevel;
}

function isDealerApplicationActive(status?: DealerApplication["status"]) {
  return status === "pending" || status === "info_requested";
}

function getDealerApplicationCooldownRemaining(lastSubmittedAt?: string) {
  if (!lastSubmittedAt) return 0;

  const submittedAt = new Date(lastSubmittedAt).getTime();
  if (Number.isNaN(submittedAt)) return 0;

  return Math.max(0, submittedAt + DEALER_APPLICATION_RESUBMIT_COOLDOWN_MS - Date.now());
}

function formatDealerApplicationCooldownMessage(remainingMs: number) {
  const totalMinutes = Math.ceil(remainingMs / 60000);
  if (totalMinutes <= 1) {
    return "Please wait a minute before submitting another dealer application.";
  }

  return `Please wait ${totalMinutes} minutes before submitting another dealer application.`;
}

function normalizeDealerApplicationInput(input: DealerApplicationWriteInput) {
  return {
    legalBusinessName: sanitizeSingleLineText(input.legalBusinessName),
    tradingName: sanitizeSingleLineText(input.tradingName),
    abn: normalizeDigitsOnly(sanitizeSingleLineText(input.abn), 11),
    acn: normalizeDigitsOnly(sanitizeSingleLineText(input.acn), 9),
    lmctNumber: sanitizeSingleLineText(input.lmctNumber).replace(/\s+/g, ""),
    contactPersonName: sanitizeSingleLineText(input.contactPersonName),
    contactPhone: normalizeDigitsOnly(input.contactPhone, 10),
    contactEmail: sanitizeSingleLineText(input.contactEmail).toLowerCase(),
    businessAddressLine1: sanitizeSingleLineText(input.businessAddressLine1),
    businessSuburb: sanitizeSingleLineText(input.businessSuburb),
    businessPostcode: normalizeDigitsOnly(input.businessPostcode, 4),
    businessState: toUppercaseValue(input.businessState),
    licenceState: toUppercaseValue(input.licenceState),
    licenceExpiry: typeof input.licenceExpiry === "string" ? input.licenceExpiry.trim() : "",
    licenceVerificationStatus:
      (
        input.licenceVerificationStatus === "verified"
          ? "verified"
          : input.licenceVerificationStatus === "auto_failed"
            ? "auto_failed"
            : "manual_review_required"
      ) as DealerLicenceVerificationStatus,
    licenceVerificationNote: sanitizeSingleLineText(input.licenceVerificationNote ?? ""),
    licenceVerificationSource: sanitizeSingleLineText(input.licenceVerificationSource ?? ""),
    lmctProofUploadUrl: sanitizeSingleLineText(input.lmctProofUploadUrl),
    lmctProofUploadName: sanitizeSingleLineText(input.lmctProofUploadName ?? ""),
    lmctProofUploadContentType: sanitizeSingleLineText(input.lmctProofUploadContentType ?? "").toLowerCase()
  };
}

function validateDealerApplicationInput(input: DealerApplicationWriteInput) {
  const normalized = normalizeDealerApplicationInput(input);

  requireTrimmedValue(normalized.legalBusinessName, "Enter the legal business name.");
  requireTrimmedValue(normalized.lmctNumber, "Enter the LMCT number.");
  requireTrimmedValue(normalized.contactPersonName, "Enter the contact person name.");
  requireTrimmedValue(normalized.businessAddressLine1, "Enter the business address.");
  requireTrimmedValue(normalized.businessSuburb, "Enter the business suburb.");
  requireTrimmedValue(normalized.businessState, "Select the business state.");
  requireTrimmedValue(normalized.licenceState, "Enter the licence state.");
  requireTrimmedValue(normalized.licenceExpiry, "Enter the licence expiry.");
  requireTrimmedValue(normalized.licenceVerificationStatus, "Dealer licence verification is required before submitting.");

  if (!normalized.abn && !normalized.acn) {
    throw new Error("Enter an ABN or ACN before submitting.");
  }

  if (normalized.abn && !/^\d{11}$/.test(normalized.abn)) {
    throw new Error("ABN must be 11 digits.");
  }

  if (normalized.acn && !/^\d{9}$/.test(normalized.acn)) {
    throw new Error("ACN must be 9 digits.");
  }

  if (!/^\d{4}$/.test(normalized.businessPostcode)) {
    throw new Error("Please enter a valid 4-digit Australian postcode");
  }

  if (!isValidAustralianMobileNumber(normalized.contactPhone)) {
    throw new Error("Please enter a valid Australian mobile number (e.g. 0412345678)");
  }

  if (!isValidEmailAddress(normalized.contactEmail)) {
    throw new Error("Please enter a valid email address.");
  }

  if (!isFutureCalendarDate(normalized.licenceExpiry)) {
    throw new Error("Licence expiry must be a future date.");
  }

  if (
    normalized.licenceVerificationStatus !== "verified"
    && normalized.licenceVerificationStatus !== "manual_review_required"
    && normalized.licenceVerificationStatus !== "auto_failed"
  ) {
    throw new Error("Dealer licence verification status is invalid.");
  }

  if (!normalized.lmctProofUploadUrl) {
    throw new Error("Upload the LMCT proof document before submitting.");
  }

  if (!normalized.lmctProofUploadName || !isAllowedDealerProofValue(normalized.lmctProofUploadName, normalized.lmctProofUploadContentType)) {
    throw new Error("LMCT proof must be a PDF, JPG, JPEG, or PNG file.");
  }

  return normalized;
}

function serializeVehicleViewEventDoc(id: string, data: Record<string, unknown>): VehicleViewEvent {
  return {
    id,
    vehicleId: String(data.vehicleId ?? ""),
    viewedAt: serializeDate(data.viewedAt),
    sessionId: String(data.sessionId ?? ""),
    userId: typeof data.userId === "string" ? data.userId : undefined,
    role: (data.role as VehicleViewRole) ?? "guest",
    source: String(data.source ?? "direct"),
    referrer: String(data.referrer ?? ""),
    deviceType: (data.deviceType as VehicleDeviceType) ?? "desktop",
    country: typeof data.country === "string" ? data.country : "",
    state: typeof data.state === "string" ? data.state : "",
    city: typeof data.city === "string" ? data.city : "",
    listingType: (data.listingType as Vehicle["listingType"]) ?? "private",
    sellerOwnerUid: String(data.sellerOwnerUid ?? "")
  };
}

function normalizeOfferStatus(status: unknown): OfferStatus {
  if (
    status === "pending"
    || status === "countered"
    || status === "accepted"
    || status === "declined"
    || status === "accepted_pending_buyer_confirmation"
    || status === "buyer_confirmed"
    || status === "buyer_declined"
    || status === "rejected"
  ) {
    return status;
  }

  if (status === "accepted") {
    return "accepted";
  }

  if (status === "declined" || status === "withdrawn") {
    return "declined";
  }

  return "pending";
}

function serializeOfferDoc(id: string, data: Record<string, unknown>): Offer {
  const status = normalizeOfferStatus(data.status);
  const buyerUid =
    typeof data.buyerUid === "string" && data.buyerUid
      ? data.buyerUid
      : typeof data.userId === "string"
        ? data.userId
        : typeof data.submittedByUid === "string"
          ? data.submittedByUid
          : "";
  const listingOwnerUid =
    typeof data.listingOwnerUid === "string" && data.listingOwnerUid
      ? data.listingOwnerUid
      : typeof data.sellerOwnerUid === "string"
        ? data.sellerOwnerUid
        : "";
  const amount = Number(data.amount ?? data.offerAmount ?? 0);
  const messages: OfferThreadEntry[] = Array.isArray(data.messages)
    ? data.messages
        .flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const type = (item as { type?: unknown }).type;
          const sender = (item as { sender?: unknown }).sender;
          const text = typeof (item as { text?: unknown }).text === "string" ? (item as { text: string }).text : "";
          const amount = Number((item as { amount?: unknown }).amount ?? NaN);
          if (sender !== "buyer" && sender !== "seller") return [];
          const normalizedSender: OfferMessageSender = sender;
          const normalizedType: OfferThreadEntry["type"] =
            type === "offer_update"
              ? "offer_update"
              : "message";
          if (normalizedType === "message" && !text) return [];
          if (normalizedType === "offer_update" && !Number.isFinite(amount)) return [];

          return [{
            type: normalizedType,
            sender: normalizedSender,
            ...(text ? { text } : {}),
            ...(Number.isFinite(amount) ? { amount } : {}),
            createdAt: serializeDate((item as { createdAt?: unknown }).createdAt)
          }];
        })
        .sort((left, right) => (left.createdAt ?? "").localeCompare(right.createdAt ?? ""))
    : [];

  if (!messages.some((entry) => entry.type === "offer_update") && Number.isFinite(amount) && amount > 0) {
    messages.unshift({
      type: "offer_update",
      sender: "buyer",
      amount,
      createdAt: serializeDate(data.createdAt)
    });
  }

  if (!messages.some((entry) => entry.type === "message") && typeof data.message === "string" && data.message.trim()) {
    messages.push({
      type: "message",
      sender: "buyer",
      text: String(data.message),
      createdAt: serializeDate(data.createdAt)
    });
  }

  return {
    id,
    buyerUid,
    listingOwnerUid,
    vehicleId: String(data.vehicleId ?? ""),
    vehicleTitle: String(data.vehicleTitle ?? ""),
    vehiclePrice: Number(data.vehiclePrice ?? 0),
    buyerName: String(data.buyerName ?? ""),
    buyerEmail: String(data.buyerEmail ?? ""),
    buyerPhone: String(data.buyerPhone ?? ""),
    amount,
    message: String(data.message ?? ""),
    messages,
    buyerViewed: Boolean(data.buyerViewed ?? status === "pending"),
    sellerViewed: Boolean(data.sellerViewed ?? status !== "pending"),
    contactUnlocked: Boolean(data.contactUnlocked),
    contactUnlockedAt: serializeDate(data.contactUnlockedAt) ?? null,
    contactUnlockedBy:
      data.contactUnlockedBy === "buyer_confirm"
      || data.contactUnlockedBy === "seller_manual"
      || data.contactUnlockedBy === "seller_accept"
      || data.contactUnlockedBy === "buyer_counter_accept"
        ? data.contactUnlockedBy
        : null,
    contactVisibilityState:
      data.contactVisibilityState === "hidden"
      || data.contactVisibilityState === "shared_after_accept"
      || data.contactVisibilityState === "shared_after_counter_accept"
        ? data.contactVisibilityState
        : Boolean(data.contactUnlocked)
          ? "shared_after_accept"
          : "hidden",
    lastUpdatedBy:
      data.lastUpdatedBy === "buyer" || data.lastUpdatedBy === "seller"
        ? data.lastUpdatedBy
        : undefined,
    submittedByUid: typeof data.submittedByUid === "string" ? data.submittedByUid : undefined,
    status,
    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt),
    respondedAt: data.respondedAt === null ? null : serializeDate(data.respondedAt) ?? null,
    userId: typeof data.userId === "string" ? data.userId : buyerUid,
    offerAmount: amount,
    sellerOwnerUid: typeof data.sellerOwnerUid === "string" ? data.sellerOwnerUid : listingOwnerUid
  };
}

function normalizeBreakdown(value: unknown): VehicleAnalyticsBreakdown[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const label = typeof (item as { label?: unknown }).label === "string" ? (item as { label: string }).label : "";
      const count = Number((item as { count?: unknown }).count ?? 0);
      if (!label) return null;
      return { label, count };
    })
    .filter((item): item is VehicleAnalyticsBreakdown => Boolean(item));
}

function serializeVehicleAnalyticsDoc(id: string, data: Record<string, unknown>): VehicleAnalytics {
  return {
    id,
    ...data,
    totalViews: Number(data.totalViews ?? 0),
    uniqueVisitors: Number(data.uniqueVisitors ?? 0),
    views7d: Number(data.views7d ?? 0),
    views30d: Number(data.views30d ?? 0),
    saves: Number(data.saves ?? 0),
    saves7d: Number(data.saves7d ?? 0),
    saves30d: Number(data.saves30d ?? 0),
    offers: Number(data.offers ?? 0),
    offers7d: Number(data.offers7d ?? 0),
    offers30d: Number(data.offers30d ?? 0),
    inspections: Number(data.inspections ?? 0),
    inspections7d: Number(data.inspections7d ?? 0),
    inspections30d: Number(data.inspections30d ?? 0),
    topCities: normalizeBreakdown(data.topCities),
    topStates: normalizeBreakdown(data.topStates),
    topSources: normalizeBreakdown(data.topSources),
    updatedAt: serializeDate(data.updatedAt)
  } as VehicleAnalytics;
}

function countTopValues(values: Array<string | undefined>, limit = 3): VehicleAnalyticsBreakdown[] {
  const counts = new Map<string, number>();

  values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .forEach((value) => {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });

  return Array.from(counts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function buildEmptyVehicleAnalytics(vehicleId: string, sellerOwnerUid = ""): VehicleAnalytics {
  return {
    id: vehicleId,
    vehicleId,
    sellerOwnerUid,
    totalViews: 0,
    uniqueVisitors: 0,
    views7d: 0,
    views30d: 0,
    saves: 0,
    saves7d: 0,
    saves30d: 0,
    offers: 0,
    offers7d: 0,
    offers30d: 0,
    inspections: 0,
    inspections7d: 0,
    inspections30d: 0,
    topCities: [],
    topStates: [],
    topSources: []
  };
}

function countItemsCreatedSince(items: Array<{ createdAt?: string }>, since: number) {
  return items.filter((item) => {
    const createdAt = item.createdAt ? new Date(item.createdAt).getTime() : 0;
    return createdAt >= since;
  }).length;
}

function getComplianceWindowStart(now = new Date()) {
  const start = new Date(now);
  start.setFullYear(start.getFullYear() - 1);
  return start;
}

function pickLatestComplianceEvent(vehicle: Pick<Vehicle, "id" | "createdAt" | "approvedAt" | "soldAt">, now = new Date()) {
  const windowStart = getComplianceWindowStart(now).getTime();
  const candidates = [
    vehicle.createdAt ? { eventType: "listing_created" as const, timestamp: vehicle.createdAt } : null,
    vehicle.approvedAt ? { eventType: "listing_published" as const, timestamp: vehicle.approvedAt } : null,
    vehicle.soldAt ? { eventType: "listing_sold" as const, timestamp: vehicle.soldAt } : null
  ]
    .filter((item): item is { eventType: ComplianceVehicleActivity["eventType"]; timestamp: string } => Boolean(item))
    .map((item) => ({ ...item, time: new Date(item.timestamp).getTime() }))
    .filter((item) => Number.isFinite(item.time) && item.time >= windowStart)
    .sort((left, right) => right.time - left.time);

  if (!candidates.length) return null;

  return {
    vehicleId: vehicle.id,
    eventType: candidates[0].eventType,
    qualifyingAt: candidates[0].timestamp
  } satisfies ComplianceVehicleActivity;
}

function buildComplianceAssessment(
  ownerUid: string,
  vehicles: Vehicle[],
  currentStatus: ComplianceStatus = "clear"
): UserComplianceAssessment {
  const uniqueVehicles = new Map<string, Vehicle>();
  for (const vehicle of vehicles) {
    uniqueVehicles.set(vehicle.id, vehicle);
  }

  const activities = Array.from(uniqueVehicles.values())
    .map((vehicle) => pickLatestComplianceEvent(vehicle))
    .filter((activity): activity is ComplianceVehicleActivity => Boolean(activity))
    .sort((left, right) => right.qualifyingAt.localeCompare(left.qualifyingAt));

  const thresholdReached = currentStatus !== "verified_dealer" && activities.length >= 4;

  return {
    userId: ownerUid,
    rolling12MonthCount: activities.length,
    activities,
    status: currentStatus === "verified_dealer" ? "verified_dealer" : thresholdReached ? "possible_unlicensed_trader" : "clear",
    thresholdReached
  };
}

async function getComplianceAlertByUserId(userId: string) {
  if (!isFirebaseConfigured) return null;

  const snapshot = await getDoc(doc(db, "complianceAlerts", userId));
  if (!snapshot.exists()) return null;
  return serializeComplianceAlertDoc(snapshot.id, snapshot.data());
}

export async function getComplianceAlertsData() {
  if (!isFirebaseConfigured) {
    return {
      items: [] as ComplianceAlert[],
      source: "mock" as const
    };
  }

  try {
    const snapshot = await getDocs(collection(db, "complianceAlerts"));
    const items = snapshot.docs
      .map((item) => serializeComplianceAlertDoc(item.id, item.data()))
      .sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""));

    return {
      items,
      source: "firestore" as const
    };
  } catch (error) {
    return {
      items: [] as ComplianceAlert[],
      source: "firestore" as const,
      error: error instanceof Error ? error.message : "Unknown Firestore read error"
    };
  }
}

export async function getDealerApplicationByUserId(userId: string) {
  if (!isFirebaseConfigured) return null;

  const snapshot = await getDoc(doc(db, "dealerApplications", userId));
  if (!snapshot.exists()) return null;
  return serializeDealerApplicationDoc(snapshot.id, snapshot.data());
}

export async function getDealerApplicationsData() {
  if (!isFirebaseConfigured) {
    return {
      items: [] as DealerApplication[],
      source: "mock" as const
    };
  }

  try {
    const snapshot = await getDocs(collection(db, "dealerApplications"));
    const items = snapshot.docs
      .map((item) => serializeDealerApplicationDoc(item.id, item.data()))
      .sort((left, right) => (right.requestedAt ?? "").localeCompare(left.requestedAt ?? ""));

    return {
      items,
      source: "firestore" as const
    };
  } catch (error) {
    return {
      items: [] as DealerApplication[],
      source: "firestore" as const,
      error: error instanceof Error ? error.message : "Unknown Firestore read error"
    };
  }
}

export async function listVehicles() {
  const result = await getCollection<Vehicle>("vehicles", sampleVehicles, serializeVehicleDoc);
  return result.items;
}

export async function getVehiclesData() {
  return getCollection<Vehicle>("vehicles", sampleVehicles, serializeVehicleDoc);
}

export async function getOwnedVehiclesData(ownerUid: string) {
  if (!isFirebaseConfigured) {
    return {
      items: sampleVehicles.filter((vehicle) => vehicle.ownerUid === ownerUid),
      source: "mock" as const
    };
  }

  try {
    const [vehicleSnapshot, privateSnapshot] = await Promise.all([
      getDocs(query(collection(db, "vehicles"), where("ownerUid", "==", ownerUid))),
      getDocs(query(collection(db, "vehicle_private"), where("ownerUid", "==", ownerUid))).catch(() => null)
    ]);
    const pendingByVehicleId = new Map(
      (privateSnapshot?.docs ?? []).map((item) => [item.id, serializePendingDescriptionDoc(item.data()).pendingDescription])
    );
    const items = vehicleSnapshot.docs
      .map((item) => ({
        ...serializeVehicleDoc(item.id, item.data()),
        pendingDescription: pendingByVehicleId.get(item.id) ?? ""
      }))
      .sort((a, b) => {
        const aCreatedAt = a.createdAt ?? "";
        const bCreatedAt = b.createdAt ?? "";
        return bCreatedAt.localeCompare(aCreatedAt);
      });

    return {
      items,
      source: "firestore" as const
    };
  } catch (error) {
    return {
      items: [],
      source: "firestore" as const,
      error: error instanceof Error ? error.message : "Unknown Firestore read error"
    };
  }
}

export async function listPublishedVehicles() {
  const result = await getCollection<Vehicle>("vehicles", sampleVehicles, serializeVehicleDoc);
  return {
    vehicles: result.items.filter(
      (vehicle) =>
        !vehicle.deleted
        && vehicle.status === "approved"
        && (vehicle.sellerStatus === "ACTIVE" || vehicle.sellerStatus === "UNDER_OFFER")
    ),
    source: result.source,
    error: result.error
  };
}

export async function listSoldVehicles() {
  const result = await getCollection<Vehicle>("vehicles", sampleVehicles, serializeVehicleDoc);
  return {
    vehicles: result.items.filter((vehicle) => vehicle.sellerStatus === "SOLD" && !vehicle.deleted),
    source: result.source,
    error: result.error
  };
}

export async function getVehicleById(id: string) {
  if (!isFirebaseConfigured) {
    return sampleVehicles.find((vehicle) => vehicle.id === id) ?? null;
  }

  const snapshot = await getDoc(doc(db, "vehicles", id));
  if (!snapshot.exists()) return null;
  return serializeVehicleDoc(snapshot.id, snapshot.data());
}

export async function getVehiclePendingDescription(
  vehicleId: string,
  actor: VehicleActor,
  existingVehicle?: Pick<Vehicle, "id" | "ownerUid">
) {
  const ownerUid = existingVehicle?.ownerUid ?? (await getVehicleById(vehicleId))?.ownerUid ?? "";

  if (!ownerUid) {
    throw new Error("Vehicle not found.");
  }

  if (!isAdminLikeRole(actor.role) && actor.id !== ownerUid) {
    throw new Error("You do not have access to this pending description.");
  }

  if (!isFirebaseConfigured) {
    return "";
  }

  const record = await getVehiclePendingDescriptionRecord(vehicleId);
  return record?.pendingDescription ?? "";
}

export async function listUsers() {
  const fallback: AppUser[] = [
    {
      id: "super-admin-001",
      email: "peng871111@gmail.com",
      displayName: "Craig",
      role: "super_admin",
      adminPermissions: createSuperAdminPermissions()
    },
    {
      id: "admin-001",
      email: "dengue0111@gmail.com",
      displayName: "Leon",
      role: "admin",
      adminPermissions: createAdminPermissions()
    },
    { id: "seller-001", email: "seller@carnest.com", displayName: "Prestige Seller", role: "seller" },
    { id: "buyer-001", email: "buyer@carnest.com", displayName: "Qualified Buyer", role: "buyer" }
  ];
  const result = await getUsersData(fallback);
  return result.items;
}

export async function getUsersData(fallback?: AppUser[]) {
  const defaultFallback = fallback ?? [
    {
      id: "super-admin-001",
      email: "peng871111@gmail.com",
      displayName: "Craig",
      role: "super_admin",
      adminPermissions: createSuperAdminPermissions()
    },
    {
      id: "admin-001",
      email: "dengue0111@gmail.com",
      displayName: "Leon",
      role: "admin",
      adminPermissions: createAdminPermissions()
    },
    { id: "seller-001", email: "seller@carnest.com", displayName: "Prestige Seller", role: "seller" },
    { id: "buyer-001", email: "buyer@carnest.com", displayName: "Qualified Buyer", role: "buyer" }
  ] satisfies AppUser[];

  return getCollection<AppUser>("users", defaultFallback, serializeUserDoc);
}

function createEmptyUserSupportMetrics(): UserSupportAccountMetrics {
  return {
    totalListings: 0,
    liveListings: 0,
    soldListings: 0,
    pendingListings: 0,
    totalOffers: 0,
    totalEnquiries: 0,
    totalInspections: 0
  };
}

function createEmptyUserSupportRecord(): UserSupportRecord {
  return {
    matchedUser: null,
    matchedVehicle: null,
    ownedVehicles: [],
    metrics: createEmptyUserSupportMetrics()
  };
}

async function findUserByExactEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  if (!isFirebaseConfigured) {
    return (await listUsers()).find((user) => user.email.trim().toLowerCase() === normalizedEmail) ?? null;
  }

  const snapshot = await getDocs(query(collection(db, "users"), where("email", "==", normalizedEmail), limit(1)));
  if (!snapshot.docs.length) return null;
  return serializeUserDoc(snapshot.docs[0].id, snapshot.docs[0].data());
}

async function findVehiclesByOwnerForSupport(ownerUid: string) {
  if (!ownerUid) return [] as Vehicle[];

  if (!isFirebaseConfigured) {
    return sampleVehicles.filter((vehicle) => vehicle.ownerUid === ownerUid);
  }

  const snapshot = await getDocs(query(collection(db, "vehicles"), where("ownerUid", "==", ownerUid)));
  return snapshot.docs
    .map((item) => serializeVehicleDoc(item.id, item.data()))
    .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
}

async function getUserSupportMetrics(user: AppUser, ownedVehicles: Vehicle[]) {
  const email = user.email.trim().toLowerCase();

  if (!isFirebaseConfigured) {
    const allOffers = (await getOffersData()).items;
    const allInspections = (await getInspectionRequestsData()).items;
    const allMessages = (await getContactMessagesData()).items;

    return {
      totalListings: ownedVehicles.length,
      liveListings: ownedVehicles.filter((vehicle) => vehicle.status === "approved" && (vehicle.sellerStatus === "ACTIVE" || vehicle.sellerStatus === "UNDER_OFFER")).length,
      soldListings: ownedVehicles.filter((vehicle) => vehicle.sellerStatus === "SOLD").length,
      pendingListings: ownedVehicles.filter((vehicle) => vehicle.status === "pending").length,
      totalOffers: allOffers.filter((offer) => offer.listingOwnerUid === user.id).length,
      totalEnquiries: allMessages.filter((message) => message.email.trim().toLowerCase() === email).length,
      totalInspections: allInspections.filter((request) => request.sellerOwnerUid === user.id).length
    } satisfies UserSupportAccountMetrics;
  }

  const [offersSnapshot, enquiriesSnapshot, inspectionsSnapshot] = await Promise.all([
    getDocs(query(collection(db, "offers"), where("listingOwnerUid", "==", user.id))),
    getDocs(query(collection(db, "contact_messages"), where("email", "==", email))),
    getDocs(query(collection(db, "inspectionRequests"), where("sellerOwnerUid", "==", user.id)))
  ]);

  return {
    totalListings: ownedVehicles.length,
    liveListings: ownedVehicles.filter((vehicle) => vehicle.status === "approved" && (vehicle.sellerStatus === "ACTIVE" || vehicle.sellerStatus === "UNDER_OFFER")).length,
    soldListings: ownedVehicles.filter((vehicle) => vehicle.sellerStatus === "SOLD").length,
    pendingListings: ownedVehicles.filter((vehicle) => vehicle.status === "pending").length,
    totalOffers: offersSnapshot.size,
    totalEnquiries: enquiriesSnapshot.size,
    totalInspections: inspectionsSnapshot.size
  } satisfies UserSupportAccountMetrics;
}

export async function getUserSupportRecord(searchQuery: string) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) {
    return createEmptyUserSupportRecord();
  }

  let matchedUser: AppUser | null = null;
  let matchedVehicle: Vehicle | null = null;

  if (normalizedQuery.includes("@")) {
    matchedUser = await findUserByExactEmail(normalizedQuery);
  } else {
    matchedVehicle = await getVehicleById(searchQuery.trim());
    if (matchedVehicle) {
      matchedUser = await getAppUserById(matchedVehicle.ownerUid);
    }
  }

  if (!matchedUser) {
    return {
      matchedUser: null,
      matchedVehicle,
      ownedVehicles: [],
      metrics: createEmptyUserSupportMetrics()
    } satisfies UserSupportRecord;
  }

  const ownedVehicles = await findVehiclesByOwnerForSupport(matchedUser.id);
  const metrics = await getUserSupportMetrics(matchedUser, ownedVehicles);

  return {
    matchedUser,
    matchedVehicle,
    ownedVehicles,
    metrics
  } satisfies UserSupportRecord;
}

export async function getUserSupportSuggestions(searchQuery: string, maxResults = 10) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) return [] as UserSupportSuggestion[];

  const safeLimit = Math.min(Math.max(maxResults, 1), 10);
  const userLimit = Math.min(5, safeLimit);
  const listingLimit = Math.max(1, safeLimit - userLimit);

  if (!isFirebaseConfigured) {
    const users = (await listUsers())
      .filter((user) => user.email.trim().toLowerCase().startsWith(normalizedQuery))
      .slice(0, userLimit)
      .map((user) => ({
        type: "user" as const,
        queryValue: user.email,
        email: user.email,
        name: user.displayName || user.name || user.email,
        id: user.id
      }));

    const listings = sampleVehicles
      .filter((vehicle) => vehicle.id.toLowerCase().startsWith(normalizedQuery))
      .slice(0, listingLimit)
      .map((vehicle) => ({
        type: "listing" as const,
        queryValue: vehicle.id,
        email: "",
        name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        id: vehicle.id
      }));

    return [...users, ...listings].slice(0, safeLimit);
  }

  const [userSnapshot, listingSnapshot] = await Promise.all([
    getDocs(
      query(
        collection(db, "users"),
        orderBy("email"),
        where("email", ">=", normalizedQuery),
        where("email", "<=", `${normalizedQuery}\uf8ff`),
        limit(userLimit)
      )
    ),
    getDocs(
      query(
        collection(db, "vehicles"),
        orderBy(documentId()),
        where(documentId(), ">=", searchQuery.trim()),
        where(documentId(), "<=", `${searchQuery.trim()}\uf8ff`),
        limit(listingLimit)
      )
    )
  ]);

  const ownerIds = Array.from(new Set(listingSnapshot.docs.map((item) => String(item.data().ownerUid ?? "")).filter(Boolean)));
  const owners = await Promise.all(ownerIds.map((ownerId) => getAppUserById(ownerId)));
  const ownersById = new Map(owners.filter((owner): owner is AppUser => Boolean(owner)).map((owner) => [owner.id, owner]));

  const userSuggestions = userSnapshot.docs.map((item) => {
    const user = serializeUserDoc(item.id, item.data());
    return {
      type: "user" as const,
      queryValue: user.email,
      email: user.email,
      name: user.displayName || user.name || user.email,
      id: user.id
    } satisfies UserSupportSuggestion;
  });

  const listingSuggestions = listingSnapshot.docs.map((item) => {
    const vehicle = serializeVehicleDoc(item.id, item.data());
    const owner = ownersById.get(vehicle.ownerUid);

    return {
      type: "listing" as const,
      queryValue: vehicle.id,
      email: owner?.email ?? "",
      name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      id: vehicle.id
    } satisfies UserSupportSuggestion;
  });

  return [...userSuggestions, ...listingSuggestions].slice(0, safeLimit);
}

export async function getHighActivityUserSupportAccounts(maxResults = 20) {
  const safeLimit = Math.min(Math.max(maxResults, 1), 20);
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
  const cutoffIso = cutoffDate.toISOString();

  const recentSoldVehicles = !isFirebaseConfigured
    ? sampleVehicles.filter((vehicle) => {
        if (vehicle.sellerStatus !== "SOLD" || !vehicle.soldAt) return false;
        return vehicle.soldAt >= cutoffIso;
      })
    : (
        await getDocs(
          query(
            collection(db, "vehicles"),
            where("soldAt", ">=", cutoffIso),
            orderBy("soldAt", "desc")
          )
        )
      ).docs.map((item) => serializeVehicleDoc(item.id, item.data()));

  const soldVehiclesByOwner = new Map<string, Vehicle[]>();
  for (const vehicle of recentSoldVehicles) {
    if (!vehicle.ownerUid || vehicle.sellerStatus !== "SOLD" || !vehicle.soldAt) continue;
    const currentVehicles = soldVehiclesByOwner.get(vehicle.ownerUid) ?? [];
    currentVehicles.push(vehicle);
    soldVehiclesByOwner.set(vehicle.ownerUid, currentVehicles);
  }

  const topOwnerIds = Array.from(soldVehiclesByOwner.entries())
    .filter(([, vehicles]) => vehicles.length > 4)
    .sort((left, right) => {
      if (right[1].length !== left[1].length) {
        return right[1].length - left[1].length;
      }

      const rightLatest = right[1]
        .map((vehicle) => vehicle.soldAt ?? "")
        .sort()
        .at(-1) ?? "";
      const leftLatest = left[1]
        .map((vehicle) => vehicle.soldAt ?? "")
        .sort()
        .at(-1) ?? "";

      return rightLatest.localeCompare(leftLatest);
    })
    .slice(0, safeLimit)
    .map(([ownerUid]) => ownerUid);

  const accounts = await Promise.all(
    topOwnerIds.map(async (ownerUid) => {
      const user = await getAppUserById(ownerUid);
      if (!user) return null;

      const ownedVehicles = await findVehiclesByOwnerForSupport(ownerUid);
      const soldListings = (soldVehiclesByOwner.get(ownerUid) ?? [])
        .slice()
        .sort((left, right) => (right.soldAt ?? "").localeCompare(left.soldAt ?? ""));

      return {
        user,
        totalListings: ownedVehicles.length,
        soldListingsLast12Months: soldListings.length,
        soldListings
      } satisfies UserSupportHighActivityAccount;
    })
  );

  return accounts.filter((account): account is UserSupportHighActivityAccount => Boolean(account));
}

function normalizeSupportPhone(phone?: string) {
  return (phone ?? "").replace(/\D/g, "");
}

function buildSellerLocationKey(vehicle: Pick<Vehicle, "sellerLocationSuburb" | "sellerLocationPostcode" | "sellerLocationState">) {
  const suburb = (vehicle.sellerLocationSuburb ?? "").trim().toLowerCase();
  const postcode = (vehicle.sellerLocationPostcode ?? "").trim();
  const state = (vehicle.sellerLocationState ?? "").trim().toUpperCase();
  if (!suburb && !postcode && !state) return "";
  return `${suburb}|${postcode}|${state}`;
}

function isActiveSupportListing(vehicle: Vehicle) {
  return vehicle.status === "approved" && (vehicle.sellerStatus === "ACTIVE" || vehicle.sellerStatus === "UNDER_OFFER");
}

export async function getDealerRiskSupportAccounts(maxResults = 20) {
  const safeLimit = Math.min(Math.max(maxResults, 1), 20);
  const [users, vehiclesResult] = await Promise.all([listUsers(), getVehiclesData()]);
  const vehicles = vehiclesResult.items;
  const now = new Date();
  const last12MonthsDate = new Date(now);
  last12MonthsDate.setFullYear(last12MonthsDate.getFullYear() - 1);
  const last30DaysDate = new Date(now);
  last30DaysDate.setDate(last30DaysDate.getDate() - 30);
  const last12MonthsIso = last12MonthsDate.toISOString();
  const last30DaysIso = last30DaysDate.toISOString();

  const phoneCounts = new Map<string, number>();
  for (const user of users) {
    const normalizedPhone = normalizeSupportPhone(user.phone);
    if (!normalizedPhone) continue;
    phoneCounts.set(normalizedPhone, (phoneCounts.get(normalizedPhone) ?? 0) + 1);
  }

  const vehiclesByOwner = new Map<string, Vehicle[]>();
  for (const vehicle of vehicles) {
    if (!vehicle.ownerUid) continue;
    const ownedVehicles = vehiclesByOwner.get(vehicle.ownerUid) ?? [];
    ownedVehicles.push(vehicle);
    vehiclesByOwner.set(vehicle.ownerUid, ownedVehicles);
  }

  const accounts = users
    .map((user) => {
      const ownedVehicles = (vehiclesByOwner.get(user.id) ?? [])
        .slice()
        .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));

      if (!ownedVehicles.length) return null;

      const soldListingsLast12Months = ownedVehicles.filter((vehicle) => vehicle.sellerStatus === "SOLD" && (vehicle.soldAt ?? "") >= last12MonthsIso).length;
      const activeListings = ownedVehicles.filter(isActiveSupportListing).length;
      const listingsCreatedLast30Days = ownedVehicles.filter((vehicle) => (vehicle.createdAt ?? "") >= last30DaysIso).length;

      const normalizedPhone = normalizeSupportPhone(user.phone);
      const hasDuplicatePhone = normalizedPhone ? (phoneCounts.get(normalizedPhone) ?? 0) > 1 : false;

      const locationCounts = new Map<string, number>();
      for (const vehicle of ownedVehicles) {
        const locationKey = buildSellerLocationKey(vehicle);
        if (!locationKey) continue;
        locationCounts.set(locationKey, (locationCounts.get(locationKey) ?? 0) + 1);
      }
      const hasRepeatedLocation = Array.from(locationCounts.values()).some((count) => count > 1);

      let riskScore = 0;
      const riskReasons: string[] = [];

      if (soldListingsLast12Months >= 5) {
        riskScore += 40;
        riskReasons.push(`+40: ${soldListingsLast12Months} sold listings in the last 12 months`);
      }

      if (activeListings >= 3) {
        riskScore += 25;
        riskReasons.push(`+25: ${activeListings} active listings`);
      }

      if (listingsCreatedLast30Days >= 3) {
        riskScore += 15;
        riskReasons.push(`+15: ${listingsCreatedLast30Days} listings created in the last 30 days`);
      }

      if (hasDuplicatePhone) {
        riskScore += 10;
        riskReasons.push("+10: phone number is shared across multiple accounts");
      }

      if (hasRepeatedLocation) {
        riskScore += 10;
        riskReasons.push("+10: multiple listings share the same postcode/location");
      }

      const riskLevel = riskScore >= 80 ? "high" : riskScore >= 50 ? "medium" : "low";

      return {
        user,
        riskScore,
        riskLevel,
        soldListingsLast12Months,
        activeListings,
        listingsCreatedLast30Days,
        riskReasons,
        listings: ownedVehicles
      } satisfies UserSupportDealerRiskAccount;
    })
    .filter((account): account is UserSupportDealerRiskAccount => account !== null && account.riskScore > 0)
    .sort((left, right) => {
      if (right.riskScore !== left.riskScore) return right.riskScore - left.riskScore;
      if (right.soldListingsLast12Months !== left.soldListingsLast12Months) {
        return right.soldListingsLast12Months - left.soldListingsLast12Months;
      }
      return (right.user.createdAt ?? "").localeCompare(left.user.createdAt ?? "");
    })
    .slice(0, safeLimit);

  return accounts;
}

export async function getUserComplianceAssessment(
  userId: string,
  existingUser?: Pick<AppUser, "id" | "complianceStatus"> | null,
  extraVehicles: Vehicle[] = []
) {
  const currentStatus = existingUser?.complianceStatus ?? (await getAppUserById(userId))?.complianceStatus ?? "clear";

  const ownedVehicles = isFirebaseConfigured
    ? await findRecentVehiclesForOwner(userId)
    : sampleVehicles.filter((vehicle) => vehicle.ownerUid === userId);

  return buildComplianceAssessment(userId, [...ownedVehicles, ...extraVehicles], currentStatus);
}

async function syncUserComplianceState(
  userId: string,
  extraVehicles: Vehicle[] = [],
  triggeredByVehicleId?: string
) {
  const existingUser = await getAppUserById(userId);
  if (!existingUser) return null;

  const assessment = await getUserComplianceAssessment(userId, existingUser, extraVehicles);
  const nextStatus = assessment.status;
  const wasFlagged = existingUser.complianceStatus === "possible_unlicensed_trader";
  const isFlagged = nextStatus === "possible_unlicensed_trader";

  if (!isFirebaseConfigured) {
    return assessment;
  }

  if (existingUser.complianceStatus !== nextStatus || (isFlagged && !existingUser.complianceFlaggedAt)) {
    await setDoc(
      doc(db, "users", userId),
      {
        complianceStatus: nextStatus,
        complianceFlaggedAt: isFlagged ? (existingUser.complianceFlaggedAt ? Timestamp.fromDate(new Date(existingUser.complianceFlaggedAt)) : serverTimestamp()) : deleteField(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }

  if (isFlagged) {
    const existingAlert = await getComplianceAlertByUserId(userId);
    const basePayload = {
      userId,
      alertType: "possible_unlicensed_trader" as const,
      status: "open" as const,
      activityCount: assessment.rolling12MonthCount,
      activities: assessment.activities.map((activity) => ({
        vehicleId: activity.vehicleId,
        eventType: activity.eventType,
        qualifyingAt: Timestamp.fromDate(new Date(activity.qualifyingAt))
      })),
      triggeredByVehicleId: triggeredByVehicleId ?? assessment.activities[0]?.vehicleId ?? ""
    };

    await setDoc(
      doc(db, "complianceAlerts", userId),
      {
        ...basePayload,
        ...(existingAlert?.createdAt ? { createdAt: Timestamp.fromDate(new Date(existingAlert.createdAt)) } : { createdAt: serverTimestamp() }),
        updatedAt: serverTimestamp(),
        resolvedAt: deleteField()
      },
      { merge: true }
    );
  } else {
    const existingAlert = await getComplianceAlertByUserId(userId);
    if (existingAlert && existingAlert.status !== "resolved") {
      await setDoc(
        doc(db, "complianceAlerts", userId),
        {
          status: "resolved",
          updatedAt: serverTimestamp(),
          resolvedAt: serverTimestamp()
        },
        { merge: true }
      );
    }
  }

  return assessment;
}

export async function getOffersData() {
  return getCollection<Offer>("offers", [], serializeOfferDoc);
}

export async function getSellerOffersData(ownerUid: string) {
  if (!isFirebaseConfigured) {
    return {
      items: [] as Offer[],
      source: "mock" as const
    };
  }

  try {
    const snapshot = await getDocs(query(collection(db, "offers"), where("sellerOwnerUid", "==", ownerUid)));
    const items = snapshot.docs
      .map((item) => serializeOfferDoc(item.id, item.data()))
      .sort((a, b) => {
        const aCreatedAt = a.createdAt ?? "";
        const bCreatedAt = b.createdAt ?? "";
        return bCreatedAt.localeCompare(aCreatedAt);
      });

    return {
      items,
      source: "firestore" as const
    };
  } catch (error) {
    return {
      items: [] as Offer[],
      source: "firestore" as const,
      error: error instanceof Error ? error.message : "Unknown Firestore read error"
    };
  }
}

export async function getBuyerOffersData(buyerUid: string) {
  if (!isFirebaseConfigured) {
    return {
      items: [] as Offer[],
      source: "mock" as const
    };
  }

  try {
    const snapshot = await getDocs(query(collection(db, "offers"), where("userId", "==", buyerUid)));
    const items = snapshot.docs
      .map((item) => serializeOfferDoc(item.id, item.data()))
      .sort((a, b) => (b.updatedAt ?? b.createdAt ?? "").localeCompare(a.updatedAt ?? a.createdAt ?? ""));

    return {
      items,
      source: "firestore" as const
    };
  } catch (error) {
    return {
      items: [] as Offer[],
      source: "firestore" as const,
      error: error instanceof Error ? error.message : "Unknown Firestore read error"
    };
  }
}

export async function getQuotesData() {
  return getCollection<Quote>("quotes", []);
}

export async function getPricingRequestsData() {
  return getCollection<PricingRequest>("pricingRequests", []);
}

export async function getInspectionRequestsData() {
  return getCollection<InspectionRequest>("inspectionRequests", []);
}

export async function getInspectionRequestById(id: string) {
  if (!isFirebaseConfigured) {
    return null;
  }

  const snapshot = await getDoc(doc(db, "inspectionRequests", id));
  if (!snapshot.exists()) return null;
  return serializeDoc<InspectionRequest>(snapshot.id, snapshot.data());
}

export async function getSellerInspectionRequestsData(ownerUid: string) {
  if (!isFirebaseConfigured) {
    return {
      items: [] as InspectionRequest[],
      source: "mock" as const
    };
  }

  try {
    const snapshot = await getDocs(query(collection(db, "inspectionRequests"), where("sellerOwnerUid", "==", ownerUid)));
    const items = snapshot.docs
      .map((item) => serializeDoc<InspectionRequest>(item.id, item.data()))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    return {
      items,
      source: "firestore" as const
    };
  } catch (error) {
    return {
      items: [] as InspectionRequest[],
      source: "firestore" as const,
      error: error instanceof Error ? error.message : "Unknown Firestore read error"
    };
  }
}

export async function getContactMessagesData() {
  return getCollection<ContactMessage>("contact_messages", []);
}

export async function getContactMessageById(id: string) {
  if (!isFirebaseConfigured) {
    return null;
  }

  const snapshot = await getDoc(doc(db, "contact_messages", id));
  if (!snapshot.exists()) return null;
  return serializeDoc<ContactMessage>(snapshot.id, snapshot.data());
}

export async function getVehicleWarehouseQuoteRequest(vehicleId: string, ownerId: string) {
  if (!isFirebaseConfigured) return null;

  try {
    const snapshot = await getDocs(query(collection(db, "quotes"), where("vehicleId", "==", vehicleId), where("ownerId", "==", ownerId)));
    const quotes = snapshot.docs
      .map((item) => serializeDoc<Quote>(item.id, item.data()))
      .filter((quote) => quote.quoteType === "WAREHOUSE_UPGRADE" && (quote.status === "NEW" || String(quote.status) === "PENDING"))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    return quotes[0] ?? null;
  } catch {
    return null;
  }
}

export async function getSavedVehicleRecord(userId: string, vehicleId: string) {
  if (!isFirebaseConfigured) return null;

  try {
    const snapshot = await getDocs(
      query(collection(db, "savedVehicles"), where("userId", "==", userId), where("vehicleId", "==", vehicleId))
    );
    const records = snapshot.docs
      .map((item) => serializeSavedVehicleDoc(item.id, item.data()))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    return records[0] ?? null;
  } catch {
    return null;
  }
}

export async function getSavedVehiclesData(userId: string) {
  if (!isFirebaseConfigured) {
    return {
      items: [] as SavedVehicle[],
      source: "mock" as const
    };
  }

  try {
    const snapshot = await getDocs(query(collection(db, "savedVehicles"), where("userId", "==", userId)));
    const items = snapshot.docs
      .map((item) => serializeSavedVehicleDoc(item.id, item.data()))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    return {
      items,
      source: "firestore" as const
    };
  } catch (error) {
    return {
      items: [] as SavedVehicle[],
      source: "firestore" as const,
      error: error instanceof Error ? error.message : "Unknown Firestore read error"
    };
  }
}

export async function getSavedVehiclesCollectionData() {
  return getCollection<SavedVehicle>("savedVehicles", [], serializeSavedVehicleDoc);
}

export async function getVehicleViewEventsData() {
  return getCollection<VehicleViewEvent>("vehicleViewEvents", [], serializeVehicleViewEventDoc);
}

async function getVehicleActivityEventsForVehicleIds(vehicleIds: string[]) {
  if (!vehicleIds.length) return [] as VehicleActivityEvent[];
  if (!isFirebaseConfigured) return [] as VehicleActivityEvent[];

  const uniqueVehicleIds = Array.from(new Set(vehicleIds));
  const chunks = Array.from({ length: Math.ceil(uniqueVehicleIds.length / 10) }, (_, index) =>
    uniqueVehicleIds.slice(index * 10, index * 10 + 10)
  );

  const snapshots = await Promise.all(
    chunks.map((chunk) =>
      getDocs(query(collection(db, "vehicleActivityEvents"), where("vehicleId", "in", chunk))).catch(() => null)
    )
  );

  return snapshots
    .flatMap((snapshot) => snapshot?.docs ?? [])
    .map((item) => serializeVehicleActivityEventDoc(item.id, item.data()))
    .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
}

export async function markSavedVehicleActivityViewed(userId: string, vehicleId: string, activityCreatedAt: string) {
  if (!isFirebaseConfigured) return;

  const savedVehicle = await getSavedVehicleRecord(userId, vehicleId);
  if (!savedVehicle) return;

  const currentViewedAt = savedVehicle.lastViewedActivityAt ?? "";
  if (currentViewedAt >= activityCreatedAt) return;

  await updateDoc(doc(db, "savedVehicles", savedVehicle.id), {
    lastViewedActivityAt: Timestamp.fromDate(new Date(activityCreatedAt))
  });
}

export async function getSavedVehiclesWithDetails(userId: string): Promise<{
  items: Array<{
    savedVehicle: SavedVehicle;
    vehicle: Vehicle;
    latestActivity: VehicleActivityEvent | undefined;
  }>;
  source: VehicleDataSource;
  error?: string;
}> {
  const result = await getSavedVehiclesData(userId);
  const activityEvents = await getVehicleActivityEventsForVehicleIds(result.items.map((savedVehicle) => savedVehicle.vehicleId));
  const latestActivityByVehicleId = new Map<string, VehicleActivityEvent>();
  for (const event of activityEvents) {
    if (!event.vehicleId || latestActivityByVehicleId.has(event.vehicleId)) continue;
    latestActivityByVehicleId.set(event.vehicleId, event);
  }
  const vehicles = (
    await Promise.all(
      result.items.map(async (savedVehicle) => {
        try {
          const vehicle = await getVehicleById(savedVehicle.vehicleId);
          const latestActivity = latestActivityByVehicleId.get(savedVehicle.vehicleId);
          return vehicle ? { savedVehicle, vehicle, latestActivity } : null;
        } catch {
          return null;
        }
      })
    )
  ).filter(
    (
      item
    ): item is {
      savedVehicle: SavedVehicle;
      vehicle: Vehicle;
      latestActivity: VehicleActivityEvent | undefined;
    } => item !== null
  );

  return {
    items: vehicles,
    source: result.source,
    error: result.error
  };
}

async function getUserById(userId: string) {
  if (!isFirebaseConfigured) {
    const users = await listUsers();
    return users.find((user) => user.id === userId) ?? null;
  }

  const snapshot = await getDoc(doc(db, "users", userId));
  if (!snapshot.exists()) return null;

  return serializeUserDoc(snapshot.id, snapshot.data());
}

async function getUserNotificationEmail(userId: string, fallbackEmail = "") {
  const user = await getUserById(userId).catch(() => null);
  const resolvedEmail = (user?.email || fallbackEmail || "").trim().toLowerCase();
  return isValidEmailAddress(resolvedEmail) ? resolvedEmail : "";
}

async function queueOfferActivityNotificationsForOffer(
  offer: Offer,
  vehicle: Vehicle,
  actorUserId: string
) {
  if (!isFirebaseConfigured) return;
  if (vehicle.sellerStatus === "SOLD") return;

  const existingOffers = await findOffersForVehicle(offer.vehicleId);
  const previousOffers = existingOffers.filter((existingOffer) => existingOffer.id !== offer.id);
  if (!previousOffers.length) return;

  const previousHighestOffer = previousOffers.reduce((highest, existingOffer) => {
    return Math.max(highest, existingOffer.amount);
  }, 0);

  if (offer.amount <= previousHighestOffer) return;

  const recipientOffers = new Map<string, Offer>();
  for (const previousOffer of previousOffers) {
    const recipientUserId = previousOffer.buyerUid || previousOffer.userId;
    if (!recipientUserId || recipientUserId === actorUserId) continue;
    if (!recipientOffers.has(recipientUserId)) {
      recipientOffers.set(recipientUserId, previousOffer);
    }
  }

  if (!recipientOffers.size) return;

  const emailCopy = buildOfferActivityNotificationCopy(offer.vehicleId);

  for (const [recipientUserId, relatedOffer] of recipientOffers.entries()) {
    const recentNotifications = await findOfferActivityNotificationsForRecipient(offer.vehicleId, recipientUserId);
    if (recentNotifications.length >= OFFER_ACTIVITY_NOTIFICATION_LIMIT) continue;

    const latestNotification = recentNotifications[0];
    if (
      latestNotification?.createdAt
      && isWithinWindow(latestNotification.createdAt, OFFER_ACTIVITY_NOTIFICATION_DEDUPE_WINDOW_MS)
    ) {
      continue;
    }

    const recipientUser = await getUserById(recipientUserId);
    const recipientEmail = (recipientUser?.email || relatedOffer.buyerEmail || "").trim().toLowerCase();
    if (!recipientEmail || !isValidEmailAddress(recipientEmail)) continue;

    const notificationRef = await addDoc(collection(db, "offerActivityNotifications"), {
      vehicleId: offer.vehicleId,
      offerId: offer.id,
      relatedOfferId: relatedOffer.id,
      recipientUserId,
      recipientEmail,
      actorUid: actorUserId,
      subject: emailCopy.subject,
      message: emailCopy.text,
      vehicleLink: emailCopy.vehicleLink,
      deliveryChannel: "email",
      createdAt: serverTimestamp()
    });

    await addDoc(collection(db, "mail"), {
      to: recipientEmail,
      message: {
        subject: emailCopy.subject,
        text: emailCopy.text,
        html: emailCopy.html
      },
      offerActivityNotificationId: notificationRef.id,
      type: "offer_activity",
      createdAt: serverTimestamp()
    }).catch(() => undefined);
  }
}

export async function getAppUserById(userId: string) {
  try {
    return await getUserById(userId);
  } catch {
    return null;
  }
}

export async function getVehicleOwnerInfo(ownerUid: string) {
  try {
    return await getUserById(ownerUid);
  } catch {
    return null;
  }
}

function buildManagedPermissions(role: UserRole, adminPermissions?: Partial<AdminPermissions>) {
  if (role === "super_admin") {
    return createSuperAdminPermissions(adminPermissions);
  }

  if (role === "admin") {
    return createAdminPermissions(adminPermissions);
  }

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
    ...adminPermissions
  });
}

export async function updateUserAccess(userId: string, input: UserAccessUpdateInput, actor: VehicleActor, existingUser?: AppUser) {
  if (!isSuperAdminUser(actor as AppUser)) {
    throw new Error("Only the super admin can manage admin access.");
  }

  const targetUser = existingUser ?? (await getAppUserById(userId));
  if (!targetUser) {
    throw new Error("User not found.");
  }

  const managedTarget = resolveManagedUserAccess({
    email: targetUser.email,
    storedRole: input.role,
    storedPermissions: input.adminPermissions
  });

  if (managedTarget.role === "super_admin" && !isSuperAdminUser(targetUser)) {
    throw new Error("Craig is the only supported super admin account.");
  }

  const finalRole = managedTarget.role;
  const finalPermissions =
    finalRole === "buyer" || finalRole === "seller" || finalRole === "dealer"
      ? buildManagedPermissions(finalRole, input.adminPermissions)
      : managedTarget.adminPermissions;

  if (!isFirebaseConfigured) {
    return {
      user: {
        ...targetUser,
        role: finalRole,
        adminPermissions: finalPermissions
      },
      source: "mock" as const,
      writeSucceeded: false
    };
  }

  await setDoc(
    doc(db, "users", userId),
    {
      role: finalRole,
      adminPermissions: finalPermissions,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return {
    user: {
      ...targetUser,
      role: finalRole,
      adminPermissions: finalPermissions
    },
    source: "firestore" as const,
    writeSucceeded: true
  };
}

export async function updateUserSupportStatus(
  userId: string,
  action: "ban" | "unban" | "restrict" | "remove_restriction",
  actor: VehicleActor,
  existingUser?: AppUser
) {
  const targetUser = await getUserSupportActionTarget(userId, actor, existingUser);

  const isBan = action === "ban";
  const isUnban = action === "unban";
  const isRestrict = action === "restrict";
  const isRemoveRestriction = action === "remove_restriction";

  const nextUser = {
    ...targetUser,
    accountBanned: isBan ? true : isUnban ? false : targetUser.accountBanned ?? false,
    listingRestricted: isBan ? true : isRestrict ? true : isRemoveRestriction ? false : targetUser.listingRestricted ?? false
  } satisfies AppUser;

  if (!isFirebaseConfigured) {
    console.log("SUPPORT_ACTION", {
      action,
      targetUserId: targetUser.id,
      adminUserId: actor.id,
      adminEmail: actor.email ?? ""
    });
    return {
      user: nextUser,
      source: "mock" as const,
      writeSucceeded: false
    };
  }

  console.log("SUPPORT_ACTION", {
    action,
    targetUserId: targetUser.id,
    adminUserId: actor.id,
    adminEmail: actor.email ?? ""
  });

  await setDoc(
    doc(db, "users", userId),
    {
      accountBanned: nextUser.accountBanned,
      listingRestricted: nextUser.listingRestricted,
      ...(isBan ? { bannedAt: serverTimestamp() } : isUnban ? { bannedAt: deleteField() } : {}),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return {
    user: nextUser,
    source: "firestore" as const,
    writeSucceeded: true
  };
}

export async function getUserSupportActionTarget(userId: string, actor: VehicleActor, existingUser?: AppUser) {
  assertAdminPermissionForActor(actor, "manageUsers", "Only authorized admins can manage user support actions.");

  const targetUser = existingUser ?? (await getAppUserById(userId));
  if (!targetUser) {
    throw new Error("User not found.");
  }

  return targetUser;
}

export async function submitDealerApplication(input: DealerApplicationWriteInput, actor: VehicleActor) {
  if (!actor.id) {
    throw new Error("Sign in to apply for a dealer account.");
  }
  if (isAdminLikeRole(actor.role)) {
    throw new Error("Admin accounts do not need a dealer application.");
  }
  if (!actor.emailVerified) {
    throw new Error("Please verify your email address before submitting a dealer application.");
  }
  if (actor.dealerStatus === "approved" || actor.dealerVerified) {
    throw new Error("This account is already approved as a dealer.");
  }

  const serviceVerification = await verifyDealerLicenceByState(input.licenceState, input.lmctNumber, input.legalBusinessName);
  const existingApplication = await getDealerApplicationByUserId(actor.id);
  if (existingApplication && isDealerApplicationActive(existingApplication.status)) {
    throw new Error("You already have an active dealer application. Please wait for review or respond to the current information request before submitting again.");
  }

  const cooldownRemaining = getDealerApplicationCooldownRemaining(existingApplication?.lastSubmittedAt);
  if (cooldownRemaining > 0) {
    throw new Error(formatDealerApplicationCooldownMessage(cooldownRemaining));
  }

  const normalized = validateDealerApplicationInput({
    ...input,
    licenceVerificationStatus: serviceVerification.ok ? serviceVerification.status : "manual_review_required",
    licenceVerificationNote:
      serviceVerification.ok
        ? (serviceVerification.note ?? input.licenceVerificationNote)
        : "We could not complete automatic licence verification at this time. Your application will be reviewed manually.",
    licenceVerificationSource: serviceVerification.source || input.licenceVerificationSource
  });
  const rejectionHistoryCount = existingApplication?.status === "rejected"
    ? Math.max((existingApplication.rejectionHistoryCount ?? 0) + 1, 1)
    : existingApplication?.rejectionHistoryCount ?? 0;
  const duplicateSignals = await getDealerApplicationDuplicateSignals(normalized, actor.id);
  const trustIndicators = buildDealerApplicationTrustIndicators(normalized, {
    rejectionHistoryCount
  });
  const spamRiskLevel = computeDealerApplicationRiskLevel({
    licenceVerificationStatus: normalized.licenceVerificationStatus,
    duplicateMatchFlags: duplicateSignals.flags,
    trustIndicators
  });
  const lastSubmittedAt = new Date().toISOString();
  const application = {
    id: actor.id,
    userId: actor.id,
    dealerStatus: "pending" as const,
    ...normalized,
    licenceVerificationNote: normalized.licenceVerificationNote || undefined,
    licenceVerificationSource: normalized.licenceVerificationSource || undefined,
    lmctProofUploadName: normalized.lmctProofUploadName || undefined,
    lmctProofUploadContentType: normalized.lmctProofUploadContentType || undefined,
    proofFiles: normalized.lmctProofUploadUrl
      ? [{
          url: normalized.lmctProofUploadUrl,
          name: normalized.lmctProofUploadName || undefined,
          contentType: normalized.lmctProofUploadContentType || undefined
        }]
      : [],
    riskLevel: spamRiskLevel,
    spamRiskLevel,
    duplicateFlags: duplicateSignals.flags,
    duplicateMatchFlags: duplicateSignals.flags,
    duplicateMatchedApplicationIds: duplicateSignals.matchedApplicationIds,
    trustIndicators,
    rejectionHistoryCount,
    status: "pending" as const,
    requestedAt: existingApplication?.requestedAt ?? lastSubmittedAt,
    lastSubmittedAt,
    updatedAt: lastSubmittedAt
  } satisfies DealerApplication;

  if (!isFirebaseConfigured) {
    return {
      application,
      source: "mock" as const,
      writeSucceeded: false
    } satisfies DealerApplicationWriteResult;
  }

  await setDoc(
    doc(db, "dealerApplications", actor.id),
    {
      userId: actor.id,
      dealerStatus: "pending",
      ...normalized,
      ...(normalized.licenceVerificationNote ? { licenceVerificationNote: normalized.licenceVerificationNote } : {}),
      ...(normalized.licenceVerificationSource ? { licenceVerificationSource: normalized.licenceVerificationSource } : {}),
      ...(normalized.lmctProofUploadName ? { lmctProofUploadName: normalized.lmctProofUploadName } : {}),
      ...(normalized.lmctProofUploadContentType ? { lmctProofUploadContentType: normalized.lmctProofUploadContentType } : {}),
      riskLevel: spamRiskLevel,
      spamRiskLevel,
      duplicateFlags: duplicateSignals.flags,
      duplicateMatchFlags: duplicateSignals.flags,
      duplicateMatchedApplicationIds: duplicateSignals.matchedApplicationIds,
      trustIndicators,
      rejectionHistoryCount,
      status: "pending",
      ...(existingApplication?.requestedAt ? { requestedAt: Timestamp.fromDate(new Date(existingApplication.requestedAt)) } : { requestedAt: serverTimestamp() }),
      lastSubmittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      reviewedAt: deleteField(),
      reviewedByUid: deleteField()
    },
    { merge: true }
  );

  await setDoc(
    doc(db, "users", actor.id),
    {
      dealerStatus: "pending",
      dealerVerified: false,
      dealerApplicationId: actor.id,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return {
    application,
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies DealerApplicationWriteResult;
}

export async function reviewFlaggedUser(
  userId: string,
  action: "approve_dealer" | "allow_private" | "restrict_user",
  actor: VehicleActor,
  existingUser?: AppUser
) {
  assertAdminPermissionForActor(actor, "manageUsers", "Only authorized admins can review flagged users.");

  const targetUser = existingUser ?? (await getAppUserById(userId));
  if (!targetUser) {
    throw new Error("User not found.");
  }

  const isApproveDealer = action === "approve_dealer";
  const isAllowPrivate = action === "allow_private";
  const isRestrict = action === "restrict_user";

  if (!isFirebaseConfigured) {
    return {
      ...targetUser,
      role: isApproveDealer ? "dealer" : targetUser.role,
      dealerVerified: isApproveDealer ? true : targetUser.dealerVerified ?? false,
      dealerStatus: isApproveDealer ? "approved" : targetUser.dealerStatus ?? "none",
      listingRestricted: isRestrict,
      complianceStatus: isApproveDealer ? "verified_dealer" : isAllowPrivate ? "clear" : "possible_unlicensed_trader"
    } satisfies AppUser;
  }

  await setDoc(
    doc(db, "users", userId),
    {
      ...(isApproveDealer
        ? {
            role: "dealer",
            dealerVerified: true,
            dealerStatus: "approved",
            listingRestricted: false,
            complianceStatus: "verified_dealer",
            complianceFlaggedAt: deleteField()
          }
        : isAllowPrivate
          ? {
              dealerVerified: targetUser.dealerVerified ?? false,
              dealerStatus: targetUser.dealerStatus ?? "none",
              listingRestricted: false,
              complianceStatus: "clear",
              complianceFlaggedAt: deleteField()
            }
          : {
              listingRestricted: true,
              complianceStatus: "possible_unlicensed_trader",
              complianceFlaggedAt: targetUser.complianceFlaggedAt ? Timestamp.fromDate(new Date(targetUser.complianceFlaggedAt)) : serverTimestamp()
            }),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  await setDoc(
    doc(db, "complianceAlerts", userId),
    {
      status: isRestrict ? "open" : "resolved",
      updatedAt: serverTimestamp(),
      resolvedAt: isRestrict ? deleteField() : serverTimestamp()
    },
    { merge: true }
  );

  return {
    ...targetUser,
    role: isApproveDealer ? "dealer" : targetUser.role,
    dealerVerified: isApproveDealer ? true : targetUser.dealerVerified ?? false,
    dealerStatus: isApproveDealer ? "approved" : targetUser.dealerStatus ?? "none",
    listingRestricted: isRestrict,
    complianceStatus: isApproveDealer ? "verified_dealer" : isAllowPrivate ? "clear" : "possible_unlicensed_trader"
  } satisfies AppUser;
}

export async function reviewDealerApplication(
  applicationId: string,
  action: "approve" | "reject" | "request_info",
  actor: VehicleActor,
  existingApplication?: DealerApplication,
  options?: {
    rejectReason?: string;
    infoRequestNote?: string;
    reviewedBy?: string;
  }
) {
  assertAdminPermissionForActor(actor, "manageUsers", "Only authorized admins can review dealer applications.");

  const application = existingApplication ?? (await getDealerApplicationByUserId(applicationId));
  if (!application) {
    throw new Error("Dealer application not found.");
  }

  const rejectReason = sanitizeMultilineText(options?.rejectReason ?? "");
  const infoRequestNote = sanitizeMultilineText(options?.infoRequestNote ?? "");
  const reviewedBy = sanitizeSingleLineText(options?.reviewedBy ?? actor.email ?? actor.id);

  const status: DealerApplication["status"] = action === "approve" ? "approved" : action === "reject" ? "rejected" : "info_requested";
  const dealerStatus: DealerApplication["dealerStatus"] = action === "approve" ? "approved" : action === "reject" ? "rejected" : "info_requested";

  if (action === "reject" && !rejectReason) {
    throw new Error("Add a rejection reason before rejecting this application.");
  }

  if (action === "request_info" && !infoRequestNote) {
    throw new Error("Add a note describing what more information is needed.");
  }

  if (!isFirebaseConfigured) {
    return {
      application: {
        ...application,
        dealerStatus,
        status,
        reviewedBy,
        reviewedByUid: actor.id,
        rejectReason: action === "reject" ? rejectReason : undefined,
        infoRequestNote: action === "request_info" ? infoRequestNote : undefined,
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      source: "mock" as const,
      writeSucceeded: false
    } satisfies DealerApplicationWriteResult;
  }

  await setDoc(
    doc(db, "dealerApplications", applicationId),
    {
      dealerStatus,
      status,
      ...(action === "reject" ? { rejectionHistoryCount: (application.rejectionHistoryCount ?? 0) + 1 } : {}),
      reviewedBy,
      reviewedByUid: actor.id,
      ...(action === "reject" ? { rejectReason, infoRequestNote: deleteField() } : {}),
      ...(action === "request_info" ? { infoRequestNote, rejectReason: deleteField() } : {}),
      ...(action === "approve" ? { rejectReason: deleteField(), infoRequestNote: deleteField() } : {}),
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  await setDoc(
    doc(db, "users", application.userId),
    {
      ...(action === "approve"
        ? {
            role: "dealer",
            dealerStatus: "approved",
            dealerVerified: true,
            listingRestricted: false,
            complianceStatus: "verified_dealer",
            complianceFlaggedAt: deleteField()
          }
        : action === "reject"
          ? {
              dealerStatus: "rejected",
              dealerVerified: false
            }
          : {
              dealerStatus: "info_requested",
              dealerVerified: false
            }),
      dealerApplicationId: applicationId,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  if (action === "approve") {
    await setDoc(
      doc(db, "complianceAlerts", application.userId),
      {
        status: "resolved",
        updatedAt: serverTimestamp(),
        resolvedAt: serverTimestamp()
      },
      { merge: true }
    ).catch(() => undefined);
  }

  return {
      application: {
        ...application,
        dealerStatus,
        status,
        rejectionHistoryCount: action === "reject" ? (application.rejectionHistoryCount ?? 0) + 1 : application.rejectionHistoryCount,
        reviewedBy,
        reviewedByUid: actor.id,
        rejectReason: action === "reject" ? rejectReason : undefined,
        infoRequestNote: action === "request_info" ? infoRequestNote : undefined,
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies DealerApplicationWriteResult;
}

export async function getSellerTrustInfo(ownerUid: string): Promise<SellerTrustInfo> {
  if (!isFirebaseConfigured) {
    const member = (await listUsers()).find((user) => user.id === ownerUid);
    return {
      sellerType: "Private Seller",
      memberSince: member?.createdAt,
      vehiclesSoldCount: sampleVehicles.filter((vehicle) => vehicle.ownerUid === ownerUid && vehicle.sellerStatus === "SOLD").length
    };
  }

  try {
    const [sellerVehicles, soldVehicles] = await Promise.all([
      getDocs(query(collection(db, "vehicles"), where("ownerUid", "==", ownerUid))),
      getDocs(query(collection(db, "vehicles"), where("ownerUid", "==", ownerUid), where("sellerStatus", "==", "SOLD")))
    ]);

    const memberSince = sellerVehicles.docs
      .map((item) => serializeVehicleDoc(item.id, item.data()).createdAt)
      .filter(Boolean)
      .sort()[0];

    return {
      sellerType: "Private Seller",
      memberSince,
      vehiclesSoldCount: soldVehicles.size
    };
  } catch {
    return {
      sellerType: "Private Seller",
      vehiclesSoldCount: 0
    };
  }
}

async function buildVehicleAnalyticsSummary(vehicleId: string, sellerOwnerUid?: string) {
  const [viewEventSnapshot, savedVehicleSnapshot, offerSnapshot, inspectionSnapshot, storedAnalyticsSnapshot] = await Promise.all([
    getDocs(query(collection(db, "vehicleViewEvents"), where("vehicleId", "==", vehicleId))),
    getDocs(query(collection(db, "savedVehicles"), where("vehicleId", "==", vehicleId))).catch(() => null),
    getDocs(query(collection(db, "offers"), where("vehicleId", "==", vehicleId))),
    getDocs(query(collection(db, "inspectionRequests"), where("vehicleId", "==", vehicleId))),
    getDoc(doc(db, "vehicleAnalytics", vehicleId)).catch(() => null)
  ]);

  const viewEvents = viewEventSnapshot.docs.map((item) => serializeVehicleViewEventDoc(item.id, item.data()));
  const savedVehicles = (savedVehicleSnapshot?.docs ?? []).map((item) => serializeDoc<SavedVehicle>(item.id, item.data()));
  const offers = offerSnapshot.docs.map((item) => serializeOfferDoc(item.id, item.data()));
  const inspections = inspectionSnapshot.docs.map((item) => serializeDoc<InspectionRequest>(item.id, item.data()));
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const storedAnalyticsData = storedAnalyticsSnapshot?.exists() ? storedAnalyticsSnapshot.data() : null;

  const uniqueVisitors = new Set(
    viewEvents.map((event) => event.userId?.trim() || event.sessionId.trim()).filter(Boolean)
  ).size;

  const analytics: VehicleAnalytics = {
    id: vehicleId,
    vehicleId,
    sellerOwnerUid: sellerOwnerUid || viewEvents[0]?.sellerOwnerUid || "",
    totalViews: viewEvents.length,
    uniqueVisitors,
    views7d: viewEvents.filter((event) => {
      const viewedAt = event.viewedAt ? new Date(event.viewedAt).getTime() : 0;
      return viewedAt >= sevenDaysAgo;
    }).length,
    views30d: viewEvents.filter((event) => {
      const viewedAt = event.viewedAt ? new Date(event.viewedAt).getTime() : 0;
      return viewedAt >= thirtyDaysAgo;
    }).length,
    saves:
      savedVehicleSnapshot?.size ??
      (storedAnalyticsData ? Number(storedAnalyticsData.saves ?? 0) : 0),
    saves7d:
      savedVehicleSnapshot
        ? countItemsCreatedSince(savedVehicles, sevenDaysAgo)
        : storedAnalyticsData
          ? Number(storedAnalyticsData.saves7d ?? 0)
          : 0,
    saves30d:
      savedVehicleSnapshot
        ? countItemsCreatedSince(savedVehicles, thirtyDaysAgo)
        : storedAnalyticsData
          ? Number(storedAnalyticsData.saves30d ?? 0)
          : 0,
    offers: offerSnapshot.size,
    offers7d: countItemsCreatedSince(offers, sevenDaysAgo),
    offers30d: countItemsCreatedSince(offers, thirtyDaysAgo),
    inspections: inspectionSnapshot.size,
    inspections7d: countItemsCreatedSince(inspections, sevenDaysAgo),
    inspections30d: countItemsCreatedSince(inspections, thirtyDaysAgo),
    topCities: countTopValues(viewEvents.map((event) => event.city)),
    topStates: countTopValues(viewEvents.map((event) => event.state)),
    topSources: countTopValues(viewEvents.map((event) => event.source)),
    updatedAt: new Date().toISOString()
  };

  return analytics;
}

export async function getVehicleAnalytics(vehicleId: string, sellerOwnerUid?: string) {
  if (!isFirebaseConfigured) {
    return {
      analytics: buildEmptyVehicleAnalytics(vehicleId, sellerOwnerUid),
      source: "mock" as const
    };
  }

  try {
    const analytics = await buildVehicleAnalyticsSummary(vehicleId, sellerOwnerUid);

    try {
      await setDoc(
        doc(db, "vehicleAnalytics", vehicleId),
        {
          vehicleId: analytics.vehicleId,
          sellerOwnerUid: analytics.sellerOwnerUid,
          totalViews: analytics.totalViews,
          uniqueVisitors: analytics.uniqueVisitors,
          views7d: analytics.views7d,
          views30d: analytics.views30d,
          saves: analytics.saves,
          saves7d: analytics.saves7d,
          saves30d: analytics.saves30d,
          offers: analytics.offers,
          offers7d: analytics.offers7d,
          offers30d: analytics.offers30d,
          inspections: analytics.inspections,
          inspections7d: analytics.inspections7d,
          inspections30d: analytics.inspections30d,
          topCities: analytics.topCities,
          topStates: analytics.topStates,
          topSources: analytics.topSources,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    } catch {
      // Best effort only. The live summary is still returned to the UI.
    }

    return {
      analytics,
      source: "firestore" as const
    };
  } catch (error) {
    return {
      analytics: buildEmptyVehicleAnalytics(vehicleId, sellerOwnerUid),
      source: "firestore" as const,
      error: error instanceof Error ? error.message : "Unknown analytics read error"
    };
  }
}

export async function getStoredVehicleAnalytics(vehicleId: string) {
  if (!isFirebaseConfigured) {
    return {
      analytics: buildEmptyVehicleAnalytics(vehicleId),
      source: "mock" as const
    };
  }

  try {
    const snapshot = await getDoc(doc(db, "vehicleAnalytics", vehicleId));
    if (!snapshot.exists()) {
      return {
        analytics: buildEmptyVehicleAnalytics(vehicleId),
        source: "firestore" as const
      };
    }

    return {
      analytics: serializeVehicleAnalyticsDoc(snapshot.id, snapshot.data()),
      source: "firestore" as const
    };
  } catch (error) {
    return {
      analytics: buildEmptyVehicleAnalytics(vehicleId),
      source: "firestore" as const,
      error: error instanceof Error ? error.message : "Unknown analytics read error"
    };
  }
}

function assertVehicleManager(actor: VehicleActor) {
  if (!isAdminLikeRole(actor.role) && !isSellerLikeRole(actor.role)) {
    throw new Error("Only admins and seller accounts can manage vehicles.");
  }

  if (actor.role === "dealer") {
    assertApprovedDealer(actor, "Your dealer application is still under review, so dealer vehicle tools are temporarily unavailable.");
  }
}

function isSellerWorkspaceActor(actor: VehicleActor) {
  return isSellerWorkspaceRole(actor.role);
}

function assertListingEligibility(actor: VehicleActor) {
  if (actor.listingRestricted) {
    throw new Error("Your account is currently restricted from creating new listings. Please contact CarNest support.");
  }

  if (actor.role === "dealer") {
    assertApprovedDealer(actor, "Your dealer application is still under review, so new listings are temporarily unavailable.");
  }
}

function assertAdminPermissionForActor(actor: VehicleActor, permission: keyof AdminPermissions, message: string) {
  if (!isAdminLikeRole(actor.role)) {
    throw new Error(message);
  }

  if (actor.role === "super_admin") return;

  if (!hasAdminPermission(actor as AppUser, permission)) {
    throw new Error(message);
  }
}

export async function softDeleteVehicle(
  id: string,
  actor: VehicleActor,
  existingVehicle?: Vehicle,
  deleteReason?: string
) {
  assertAdminPermissionForActor(actor, "deleteListings", "You do not have access to delete listings.");

  const targetVehicle = existingVehicle ?? (await getVehicleById(id));
  if (!targetVehicle) {
    throw new Error("Vehicle not found.");
  }

  const nextVehicle = {
    ...targetVehicle,
    deleted: true,
    deletedAt: new Date().toISOString(),
    deletedBy: actor.id,
    deleteReason: deleteReason?.trim() ?? ""
  } satisfies Vehicle;

  if (!isFirebaseConfigured) {
    return {
      vehicle: nextVehicle,
      source: "mock" as const,
      writeSucceeded: false
    };
  }

  await setDoc(
    doc(db, "vehicles", id),
    {
      deleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: actor.id,
      deleteReason: deleteReason?.trim() ?? "",
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return {
    vehicle: nextVehicle,
    source: "firestore" as const,
    writeSucceeded: true
  };
}

function assertVehicleOwnership(actor: VehicleActor, vehicle: Vehicle) {
  if (isAdminLikeRole(actor.role)) return;
  if (vehicle.ownerUid !== actor.id) {
    throw new Error("You can only edit vehicles you own.");
  }
}

function resolveVehicleStatus(actor: VehicleActor, existingVehicle?: Vehicle): VehicleStatus {
  if (!existingVehicle) {
    return isAdminLikeRole(actor.role) ? "approved" : "pending";
  }

  return existingVehicle.status;
}

function toUppercaseValue(value?: string) {
  return (value ?? "").toUpperCase();
}

function sanitizeSingleLineText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeMultilineText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function requireTrimmedValue(value: string, message: string) {
  const trimmed = sanitizeSingleLineText(value);
  if (!trimmed) {
    throw new Error(message);
  }
  return trimmed;
}

function normalizeDuplicateText(value?: string) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function buildOfferThreadEntryForWrite(entry: OfferThreadEntry) {
  return {
    type: entry.type,
    sender: entry.sender,
    ...(entry.text ? { text: entry.text } : {}),
    ...(typeof entry.amount === "number" ? { amount: entry.amount } : {}),
    createdAt: Timestamp.now()
  };
}

const OFFER_ACTIVITY_NOTIFICATION_SUBJECT = "Update on your offer activity";
const OFFER_ACTIVITY_NOTIFICATION_LIMIT = 3;
const OFFER_ACTIVITY_NOTIFICATION_DEDUPE_WINDOW_MS = 6 * 60 * 60 * 1000;
type OfferLifecycleNotificationKind =
  | "new_offer_to_seller"
  | "seller_accepted_offer"
  | "seller_declined_offer"
  | "seller_countered_offer"
  | "buyer_accepted_counteroffer";

function buildOfferActivityNotificationCopy(vehicleId: string) {
  const vehicleLink = buildAbsoluteUrl(`/inventory/${vehicleId}`);
  const text = [
    "There has been new activity on a vehicle you’ve made an offer on.",
    "The listing is seeing continued interest.",
    "Vehicles with multiple interested parties may move quickly.",
    "",
    `View the vehicle: ${vehicleLink}`
  ].join("\n");
  const html = [
    "<p>There has been new activity on a vehicle you’ve made an offer on.</p>",
    "<p>The listing is seeing continued interest.</p>",
    "<p>Vehicles with multiple interested parties may move quickly.</p>",
    `<p><a href="${vehicleLink}">View the vehicle</a></p>`
  ].join("");

  return {
    subject: OFFER_ACTIVITY_NOTIFICATION_SUBJECT,
    text,
    html,
    vehicleLink
  };
}

async function queueOfferLifecycleEmailNotification(
  kind: OfferLifecycleNotificationKind,
  offer: Offer,
  recipientEmail: string
) {
  if (!isFirebaseConfigured) return;

  const normalizedRecipientEmail = recipientEmail.trim().toLowerCase();
  if (!normalizedRecipientEmail || !isValidEmailAddress(normalizedRecipientEmail)) {
    console.warn("[offer-email] No valid recipient email resolved for offer lifecycle email.", {
      event: kind,
      offerId: offer.id,
      recipientEmail
    });
    return;
  }

  const endpoint =
    typeof window !== "undefined"
      ? "/api/offer-notifications"
      : buildAbsoluteUrl("/api/offer-notifications");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        event: kind,
        to: normalizedRecipientEmail,
        vehicleTitle: offer.vehicleTitle,
        amount: offer.amount,
        offerId: offer.id
      }),
      keepalive: true,
      cache: "no-store"
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("[offer-email] Failed to trigger transactional email", {
        event: kind,
        offerId: offer.id,
        recipientEmail: normalizedRecipientEmail,
        status: response.status,
        body
      });
    }
  } catch (error) {
    console.error("[offer-email] Failed to reach transactional email endpoint", {
      event: kind,
      offerId: offer.id,
      recipientEmail: normalizedRecipientEmail,
      error: error instanceof Error ? error.message : String(error)
    });
  }
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

function buildOfferMessageForReturn(sender: OfferMessageSender, text: string): OfferThreadEntry {
  return {
    type: "message",
    sender,
    text,
    createdAt: new Date().toISOString()
  };
}

function buildOfferUpdateForReturn(sender: OfferMessageSender, amount: number): OfferThreadEntry {
  return {
    type: "offer_update",
    sender,
    amount,
    createdAt: new Date().toISOString()
  };
}

function isWithinWindow(createdAt: string | undefined, windowMs: number) {
  if (!createdAt) return false;
  const timestamp = new Date(createdAt).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp <= windowMs;
}

async function findRecentOffersForUser(userId: string, vehicleId: string) {
  if (!isFirebaseConfigured) return [] as Offer[];

  const snapshot = await getDocs(query(collection(db, "offers"), where("userId", "==", userId), where("vehicleId", "==", vehicleId)));
  return snapshot.docs.map((item) => serializeOfferDoc(item.id, item.data()));
}

async function findOffersForVehicle(vehicleId: string) {
  if (!isFirebaseConfigured) {
    return [] as Offer[];
  }

  const snapshot = await getDocs(query(collection(db, "offers"), where("vehicleId", "==", vehicleId)));
  return snapshot.docs
    .map((item) => serializeOfferDoc(item.id, item.data()))
    .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
}

async function findOfferActivityNotificationsForRecipient(vehicleId: string, recipientUserId: string) {
  if (!isFirebaseConfigured) {
    return [] as OfferActivityNotificationLog[];
  }

  const snapshot = await getDocs(
    query(
      collection(db, "offerActivityNotifications"),
      where("vehicleId", "==", vehicleId),
      where("recipientUserId", "==", recipientUserId)
    )
  );

  return snapshot.docs
    .map((item) => serializeOfferActivityNotificationDoc(item.id, item.data()))
    .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
}

async function findRecentInspectionRequestsForUser(userId: string, vehicleId: string) {
  if (!isFirebaseConfigured) return [] as InspectionRequest[];

  const snapshot = await getDocs(
    query(collection(db, "inspectionRequests"), where("submittedByUid", "==", userId), where("vehicleId", "==", vehicleId))
  );
  return snapshot.docs.map((item) => serializeDoc<InspectionRequest>(item.id, item.data()));
}

async function findRecentPricingRequestsForUser(userId: string) {
  if (!isFirebaseConfigured) return [] as PricingRequest[];

  const snapshot = await getDocs(query(collection(db, "pricingRequests"), where("userId", "==", userId)));
  return snapshot.docs.map((item) => serializeDoc<PricingRequest>(item.id, item.data()));
}

async function findRecentContactMessagesForEmail(email: string) {
  if (!isFirebaseConfigured) return [] as ContactMessage[];

  const snapshot = await getDocs(query(collection(db, "contact_messages"), where("email", "==", email)));
  return snapshot.docs.map((item) => serializeDoc<ContactMessage>(item.id, item.data()));
}

async function findRecentVehiclesForOwner(ownerUid: string) {
  if (!isFirebaseConfigured) return [] as Vehicle[];

  const snapshot = await getDocs(query(collection(db, "vehicles"), where("ownerUid", "==", ownerUid)));
  return snapshot.docs.map((item) => serializeVehicleDoc(item.id, item.data()));
}

function normalizeVehicleInput(input: VehicleFormInput): VehicleFormInput {
  return {
    ...input,
    make: toUppercaseValue(input.make),
    model: toUppercaseValue(input.model),
    transmission: toUppercaseValue(input.transmission),
    fuelType: toUppercaseValue(input.fuelType),
    drivetrain: toUppercaseValue(input.drivetrain),
    bodyType: toUppercaseValue(input.bodyType),
    colour: toUppercaseValue(input.colour),
    regoExpiry: typeof input.regoExpiry === "string" ? input.regoExpiry.trim() : "",
    serviceHistory: toUppercaseValue(input.serviceHistory),
    keyCount: toUppercaseValue(input.keyCount),
    sellerLocationSuburb: toUppercaseValue(input.sellerLocationSuburb),
    sellerLocationPostcode: typeof input.sellerLocationPostcode === "string" ? input.sellerLocationPostcode.replace(/\D/g, "").slice(0, 4) : "",
    sellerLocationState: toUppercaseValue(input.sellerLocationState),
    description: sanitizeMultilineText(input.description),
    serviceQuoteNotes: sanitizeMultilineText(input.serviceQuoteNotes ?? "")
  };
}

function buildVehiclePayload(input: VehicleFormInput, actor: VehicleActor, existingVehicle?: Vehicle) {
  const normalizedInput = normalizeVehicleInput(input);
  const ownerUid = existingVehicle?.ownerUid ?? actor.id;
  const ownerRole = existingVehicle?.ownerRole ?? (isAdminLikeRole(actor.role) ? "admin" : "seller");
  const galleryImages = normalizedInput.imageUrls.length ? normalizedInput.imageUrls : normalizedInput.images;
  const coverImage =
    normalizedInput.coverImage ||
    normalizedInput.coverImageUrl ||
    galleryImages[0] ||
    "";

  return {
    sellerId: ownerUid,
    ownerUid,
    ownerRole,
    listingType: normalizedInput.listingType,
    status: resolveVehicleStatus(actor, existingVehicle),
    sellerStatus: existingVehicle?.sellerStatus ?? "ACTIVE",
    ownershipVerified: true,
    publishAuthorized: true,
    storedInWarehouse: normalizedInput.listingType === "warehouse",
    warehouseAddress: normalizedInput.listingType === "warehouse" ? "CarNest Warehouse" : "",
    sellerLocationSuburb: normalizedInput.listingType === "private" ? normalizedInput.sellerLocationSuburb ?? "" : "",
    sellerLocationPostcode: normalizedInput.listingType === "private" ? normalizedInput.sellerLocationPostcode ?? "" : "",
    sellerLocationState: normalizedInput.listingType === "private" ? normalizedInput.sellerLocationState ?? "" : "",
    make: normalizedInput.make,
    model: normalizedInput.model,
    variant: "",
    year: normalizedInput.year,
    price: normalizedInput.price,
    mileage: normalizedInput.mileage,
    transmission: normalizedInput.transmission,
    fuelType: normalizedInput.fuelType,
    drivetrain: normalizedInput.drivetrain,
    bodyType: normalizedInput.bodyType,
    colour: normalizedInput.colour,
    vin: "",
    rego: "",
    regoExpiry: normalizedInput.regoExpiry ?? "",
    description: normalizedInput.description,
    features: [],
    conditionNotes: "",
    serviceHistory: normalizedInput.serviceHistory,
    keyCount: normalizedInput.keyCount,
    coverImage,
    coverImageUrl: normalizedInput.coverImageUrl || coverImage,
    imageUrls: galleryImages,
    images: galleryImages,
    submissionPreference: normalizedInput.submissionPreference ?? "basic",
    serviceQuoteNotes: normalizedInput.serviceQuoteNotes ?? "",
    underOfferBuyerUid: existingVehicle?.underOfferBuyerUid ?? "",
    soldAt: existingVehicle?.soldAt ?? ""
  };
}

async function getVehiclePendingDescriptionRecord(vehicleId: string) {
  if (!isFirebaseConfigured) return null;

  const snapshot = await getDoc(doc(db, "vehicle_private", vehicleId));
  if (!snapshot.exists()) return null;

  return serializePendingDescriptionDoc(snapshot.data());
}

async function syncVehiclePendingDescription(vehicleId: string, ownerUid: string, pendingDescription: string) {
  if (!isFirebaseConfigured) return;

  const privateRef = doc(db, "vehicle_private", vehicleId);
  if (!pendingDescription) {
    await deleteDoc(privateRef).catch(() => undefined);
    return;
  }

  await setDoc(
    privateRef,
    {
      ownerUid,
      pendingDescription,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

function removeVehicleImageUrl(imageUrls: string[], imageUrl: string) {
  const imageIndex = imageUrls.indexOf(imageUrl);
  if (imageIndex < 0) return imageUrls;

  return [...imageUrls.slice(0, imageIndex), ...imageUrls.slice(imageIndex + 1)];
}

export async function createVehicle(input: VehicleFormInput, actor: VehicleActor) {
  if (!isAdminLikeRole(actor.role) && !isSellerWorkspaceActor(actor)) {
    throw new Error("Only signed-in seller accounts can create vehicles.");
  }
  if (isAdminLikeRole(actor.role)) {
    assertAdminPermissionForActor(actor, "manageVehicles", "You do not have access to manage vehicles.");
  }

  if (isSellerWorkspaceActor(actor) && isFirebaseConfigured) {
    assertListingEligibility(actor);
    const recentVehicles = await findRecentVehiclesForOwner(actor.id);
    const submissionsInDay = recentVehicles.filter((vehicle) => isWithinWindow(vehicle.createdAt, 24 * 60 * 60 * 1000));
    if (submissionsInDay.length >= 3) {
      throw new Error("Too many requests. Please try again later.");
    }
  }

  if (isSellerWorkspaceActor(actor) && !isFirebaseConfigured) {
    assertListingEligibility(actor);
  }

  if (isSellerWorkspaceActor(actor)) {
    validateSellerVehicleDescription(normalizeVehicleInput(input).description);
  }
  validateVehicleLocation(normalizeVehicleInput(input));

  if (!isFirebaseConfigured) {
    const createdAt = new Date().toISOString();
    const baseVehicle = {
      id: `${actor.role}-sample-${Date.now()}`,
      ...buildVehiclePayload(input, actor),
      approvedAt: resolveVehicleStatus(actor) === "approved" ? createdAt : "",
      createdAt,
      updatedAt: createdAt
    } satisfies Vehicle;
    const assessment =
      isSellerWorkspaceActor(actor)
        ? await getUserComplianceAssessment(actor.id, {
            id: actor.id,
            complianceStatus: "clear"
          }, [baseVehicle])
        : null;
    const vehicle = {
      ...baseVehicle,
      manualReviewReason: assessment?.status === "possible_unlicensed_trader" ? "possible_unlicensed_trader" : undefined
    } satisfies Vehicle;

    return {
      vehicle,
      source: "mock" as const,
      writeSucceeded: false
    } satisfies VehicleWriteResult;
  }

  const payload = {
    ...buildVehiclePayload(input, actor),
    ...(resolveVehicleStatus(actor) === "approved" ? { approvedAt: serverTimestamp() } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const createdAt = new Date().toISOString();
  const ref = await addDoc(collection(db, "vehicles"), payload);
  let vehicle: Vehicle = {
    id: ref.id,
    ...buildVehiclePayload(input, actor),
    approvedAt: resolveVehicleStatus(actor) === "approved" ? createdAt : "",
    createdAt,
    updatedAt: createdAt
  };

  if (isSellerWorkspaceActor(actor)) {
    const assessment = await syncUserComplianceState(actor.id, [vehicle], vehicle.id);
    if (assessment?.status === "possible_unlicensed_trader") {
      await updateDoc(doc(db, "vehicles", ref.id), {
        status: "pending",
        manualReviewReason: "possible_unlicensed_trader",
        updatedAt: serverTimestamp()
      });

      vehicle = {
        ...vehicle,
        status: "pending",
        manualReviewReason: "possible_unlicensed_trader",
        updatedAt: new Date().toISOString()
      };
    }
  }

  return {
    vehicle,
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies VehicleWriteResult;
}

export async function updateVehicle(id: string, input: VehicleFormInput, actor: VehicleActor, existingVehicle?: Vehicle) {
  assertVehicleManager(actor);
  if (isAdminLikeRole(actor.role)) {
    assertAdminPermissionForActor(actor, "manageVehicles", "You do not have access to manage vehicles.");
  }
  if (existingVehicle) {
    assertVehicleOwnership(actor, existingVehicle);
  }

  const normalizedInput = normalizeVehicleInput(input);
  validateVehicleLocation(normalizedInput);
  if (isSellerLikeRole(actor.role)) {
    validateSellerVehicleDescription(normalizedInput.description);
  }

  if (!isFirebaseConfigured) {
    const baseVehicle =
      existingVehicle ??
      ({
        id,
        sellerId: actor.id,
        ownerUid: actor.id,
        ownerRole: isAdminLikeRole(actor.role) ? "admin" : "seller",
        listingType: input.listingType,
        status: isAdminLikeRole(actor.role) ? "approved" : "pending",
        sellerStatus: "ACTIVE",
        ownershipVerified: true,
        publishAuthorized: true,
        storedInWarehouse: input.listingType === "warehouse",
        warehouseAddress: "",
        sellerLocationSuburb: "",
        sellerLocationPostcode: "",
        sellerLocationState: "",
        make: "",
        model: "",
        variant: "",
        year: input.year,
        price: input.price,
        mileage: input.mileage,
        transmission: input.transmission,
        fuelType: input.fuelType,
        drivetrain: input.drivetrain,
        bodyType: input.bodyType,
        colour: input.colour,
        vin: "",
        rego: "",
        regoExpiry: input.regoExpiry ?? "",
        description: "",
        features: [],
        conditionNotes: "",
        serviceHistory: "",
        keyCount: "",
        coverImage: "",
        coverImageUrl: "",
        imageUrls: [],
        images: [],
        soldAt: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } satisfies Vehicle);

    const nextPayload = buildVehiclePayload(normalizedInput, actor, baseVehicle);
    const pendingDescription =
      isSellerLikeRole(actor.role)
        ? normalizedInput.description === baseVehicle.description
          ? ""
          : normalizedInput.description
        : "";
    const adminDescriptionChanged =
      isAdminLikeRole(actor.role) &&
      normalizedInput.description !== baseVehicle.description;
    const sellerDescriptionChanged =
      isSellerLikeRole(actor.role)
      && normalizedInput.description !== (baseVehicle.pendingDescription || baseVehicle.description);
    const moderatedPayload =
      isSellerLikeRole(actor.role)
        ? {
            ...nextPayload,
            description: baseVehicle.description
          }
        : {
            ...nextPayload,
            description: normalizedInput.description
          };

    const vehicle = {
      id,
      ...moderatedPayload,
      pendingDescription: adminDescriptionChanged ? "" : pendingDescription,
      createdAt: baseVehicle.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } satisfies Vehicle;

    return {
      vehicle,
      source: "mock" as const,
      writeSucceeded: false,
      descriptionReviewPending: sellerDescriptionChanged || Boolean(pendingDescription)
    } satisfies VehicleWriteResult;
  }

  const baseVehicle = existingVehicle ?? (await getVehicleById(id));
  if (!baseVehicle) {
    throw new Error("Vehicle not found.");
  }
  assertVehicleOwnership(actor, baseVehicle);

  const nextPayload = buildVehiclePayload(normalizedInput, actor, baseVehicle);
  const adminDescriptionChanged =
    isAdminLikeRole(actor.role) &&
    normalizedInput.description !== baseVehicle.description;
  const sellerDescriptionChanged =
    isSellerLikeRole(actor.role) &&
    normalizedInput.description !== (baseVehicle.pendingDescription || baseVehicle.description);

  const pendingDescription =
    isSellerLikeRole(actor.role)
      ? normalizedInput.description === baseVehicle.description
        ? ""
        : normalizedInput.description
      : "";

  const moderatedPayload =
    isSellerLikeRole(actor.role)
      ? {
          ...nextPayload,
          description: baseVehicle.description
        }
      : {
          ...nextPayload,
          description: normalizedInput.description
        };

  await updateDoc(doc(db, "vehicles", id), {
    ...moderatedPayload,
    updatedAt: serverTimestamp()
  });
  await syncVehiclePendingDescription(id, baseVehicle.ownerUid, adminDescriptionChanged ? "" : pendingDescription);

  const vehicle = {
    id,
    ...moderatedPayload,
    pendingDescription: adminDescriptionChanged ? "" : pendingDescription,
    createdAt: baseVehicle.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString()
  } satisfies Vehicle;

  return {
    vehicle,
    source: "firestore" as const,
    writeSucceeded: true,
    descriptionReviewPending: sellerDescriptionChanged || Boolean(pendingDescription)
  } satisfies VehicleWriteResult;
}

export async function approveVehiclePendingDescription(
  id: string,
  actor: VehicleActor,
  existingVehicle?: Pick<Vehicle, "id" | "ownerUid">
) {
  assertAdminPermissionForActor(actor, "manageVehicles", "Only authorized admins can approve pending vehicle descriptions.");

  const baseVehicle = await getVehicleById(id);
  if (!baseVehicle) {
    throw new Error("Vehicle not found.");
  }

  const pendingDescription = await getVehiclePendingDescription(id, actor, existingVehicle ?? baseVehicle);

  if (!pendingDescription) {
    throw new Error("No pending description is awaiting review.");
  }

  if (!isFirebaseConfigured) {
    const vehicle = {
      ...baseVehicle,
      description: pendingDescription,
      pendingDescription: "",
      updatedAt: new Date().toISOString()
    } satisfies Vehicle;

    return {
      vehicle,
      source: "mock" as const,
      writeSucceeded: false
    } satisfies VehicleWriteResult;
  }

  const batch = writeBatch(db);
  batch.update(doc(db, "vehicles", id), {
    description: pendingDescription,
    updatedAt: serverTimestamp()
  });
  batch.delete(doc(db, "vehicle_private", id));
  await batch.commit();

  const vehicle = {
    ...baseVehicle,
    description: pendingDescription,
    pendingDescription: "",
    updatedAt: new Date().toISOString()
  } satisfies Vehicle;

  return {
    vehicle,
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies VehicleWriteResult;
}

export async function rejectVehiclePendingDescription(
  id: string,
  actor: VehicleActor,
  existingVehicle?: Pick<Vehicle, "id" | "ownerUid">
) {
  assertAdminPermissionForActor(actor, "manageVehicles", "Only authorized admins can reject pending vehicle descriptions.");

  const baseVehicle = await getVehicleById(id);
  if (!baseVehicle) {
    throw new Error("Vehicle not found.");
  }

  const pendingDescription = await getVehiclePendingDescription(id, actor, existingVehicle ?? baseVehicle);
  if (!pendingDescription) {
    throw new Error("No pending description is awaiting review.");
  }

  if (!isFirebaseConfigured) {
    const vehicle = {
      ...baseVehicle,
      pendingDescription: "",
      updatedAt: new Date().toISOString()
    } satisfies Vehicle;

    return {
      vehicle,
      source: "mock" as const,
      writeSucceeded: false
    } satisfies VehicleWriteResult;
  }

  const batch = writeBatch(db);
  batch.update(doc(db, "vehicles", id), {
    updatedAt: serverTimestamp()
  });
  batch.delete(doc(db, "vehicle_private", id));
  await batch.commit();

  const vehicle = {
    ...baseVehicle,
    pendingDescription: "",
    updatedAt: new Date().toISOString()
  } satisfies Vehicle;

  return {
    vehicle,
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies VehicleWriteResult;
}

export async function deleteVehicleImage(
  id: string,
  imageUrl: string,
  actor: VehicleActor,
  existingVehicle?: Vehicle
) {
  assertVehicleManager(actor);
  if (isAdminLikeRole(actor.role)) {
    assertAdminPermissionForActor(actor, "manageVehicles", "You do not have access to manage vehicles.");
  }

  const baseVehicle = existingVehicle ?? (await getVehicleById(id));
  if (!baseVehicle) {
    throw new Error("Vehicle not found.");
  }

  assertVehicleOwnership(actor, baseVehicle);

  const existingImageUrls = baseVehicle.imageUrls?.length ? baseVehicle.imageUrls : baseVehicle.images ?? [];
  if (!existingImageUrls.includes(imageUrl)) {
    throw new Error("Image not found on this vehicle.");
  }

  if (existingImageUrls.length <= 1) {
    throw new Error("Upload a replacement before removing the final saved image.");
  }

  const nextImageUrls = removeVehicleImageUrl(existingImageUrls, imageUrl);
  const nextCoverImage = nextImageUrls[0] ?? "";

  if (!isFirebaseConfigured) {
    const vehicle = {
      ...baseVehicle,
      coverImage: nextCoverImage,
      coverImageUrl: nextCoverImage,
      imageUrls: nextImageUrls,
      images: nextImageUrls,
      updatedAt: new Date().toISOString()
    } satisfies Vehicle;

    return {
      vehicle,
      source: "mock" as const,
      writeSucceeded: false,
      storageDeleteSucceeded: false
    };
  }

  await updateDoc(doc(db, "vehicles", id), {
    coverImage: nextCoverImage,
    coverImageUrl: nextCoverImage,
    imageUrls: nextImageUrls,
    images: nextImageUrls,
    updatedAt: serverTimestamp()
  });

  const storageDeleteSucceeded = await deleteVehicleImageFile(imageUrl);

  const vehicle = {
    ...baseVehicle,
    coverImage: nextCoverImage,
    coverImageUrl: nextCoverImage,
    imageUrls: nextImageUrls,
    images: nextImageUrls,
    updatedAt: new Date().toISOString()
  } satisfies Vehicle;

  return {
    vehicle,
    source: "firestore" as const,
    writeSucceeded: true,
    storageDeleteSucceeded
  };
}

export async function updateVehicleStatus(id: string, status: VehicleStatus, actor: VehicleActor, existingVehicle?: Vehicle) {
  assertAdminPermissionForActor(actor, "manageVehicles", "Only authorized admins can update vehicle approval status.");

  const baseVehicle = existingVehicle ?? (await getVehicleById(id));
  if (!baseVehicle) {
    throw new Error("Vehicle not found.");
  }

  if (!isFirebaseConfigured) {
    const approvedAt = status === "approved" ? baseVehicle.approvedAt || new Date().toISOString() : "";
    const vehicle = {
      ...baseVehicle,
      status,
      approvedAt,
      updatedAt: new Date().toISOString()
    } satisfies Vehicle;

    return {
      vehicle,
      source: "mock" as const,
      writeSucceeded: false
    } satisfies VehicleWriteResult;
  }

  await updateDoc(doc(db, "vehicles", id), {
    status,
    approvedAt: status === "approved" ? (baseVehicle.approvedAt ? Timestamp.fromDate(new Date(baseVehicle.approvedAt)) : serverTimestamp()) : deleteField(),
    updatedAt: serverTimestamp()
  });

  await syncUserComplianceState(baseVehicle.ownerUid, [], baseVehicle.id);

  const approvedAt = status === "approved" ? baseVehicle.approvedAt || new Date().toISOString() : "";
  const vehicle = {
    ...baseVehicle,
    status,
    approvedAt,
    updatedAt: new Date().toISOString()
  } satisfies Vehicle;

  return {
    vehicle,
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies VehicleWriteResult;
}

export async function updateSellerVehicleStatus(
  id: string,
  sellerStatus: SellerVehicleStatus,
  actor: VehicleActor,
  existingVehicle?: Vehicle
) {
  if (!isSellerLikeRole(actor.role) && !isAdminLikeRole(actor.role)) {
    throw new Error("Only sellers and admins can update seller listing status.");
  }
  if (actor.role === "dealer") {
    assertApprovedDealer(actor, "Your dealer application is still under review, so dealer listing controls are temporarily unavailable.");
  }
  if (isAdminLikeRole(actor.role)) {
    assertAdminPermissionForActor(actor, "manageVehicles", "You do not have access to manage seller listings.");
  }

  const baseVehicle = existingVehicle ?? (await getVehicleById(id));
  if (!baseVehicle) {
    throw new Error("Vehicle not found.");
  }

  assertVehicleOwnership(actor, baseVehicle);

  const soldAt = sellerStatus === "SOLD" ? new Date().toISOString() : undefined;

  if (!isFirebaseConfigured) {
    const vehicle = {
      ...baseVehicle,
      sellerStatus,
      underOfferBuyerUid: sellerStatus === "UNDER_OFFER" ? baseVehicle.underOfferBuyerUid ?? "" : "",
      soldAt,
      updatedAt: new Date().toISOString()
    } satisfies Vehicle;

    return {
      vehicle,
      source: "mock" as const,
      writeSucceeded: false
    } satisfies VehicleWriteResult;
  }

  await updateDoc(doc(db, "vehicles", id), {
    sellerStatus,
    underOfferBuyerUid: sellerStatus === "UNDER_OFFER" ? baseVehicle.underOfferBuyerUid ?? "" : deleteField(),
    soldAt: sellerStatus === "SOLD" ? serverTimestamp() : deleteField(),
    updatedAt: serverTimestamp()
  });

  await syncUserComplianceState(baseVehicle.ownerUid, [], baseVehicle.id);

  const vehicle = {
    ...baseVehicle,
    sellerStatus,
    underOfferBuyerUid: sellerStatus === "UNDER_OFFER" ? baseVehicle.underOfferBuyerUid ?? "" : "",
    soldAt,
    updatedAt: new Date().toISOString()
  } satisfies Vehicle;

  return {
    vehicle,
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies VehicleWriteResult;
}

export async function recordVehicleViewEvent(input: VehicleViewEventWriteInput) {
  const payloadBase = {
    vehicleId: input.vehicleId,
    sessionId: input.sessionId,
    ...(input.userId ? { userId: input.userId } : {}),
    role: input.role,
    source: input.source,
    referrer: input.referrer,
    deviceType: input.deviceType,
    country: input.country ?? "",
    state: input.state ?? "",
    city: input.city ?? "",
    listingType: input.listingType,
    sellerOwnerUid: input.sellerOwnerUid
  };

  if (!isFirebaseConfigured) {
    return {
      event: {
        id: `mock-view-${Date.now()}`,
        ...payloadBase,
        viewedAt: new Date().toISOString()
      } satisfies VehicleViewEvent,
      source: "mock" as const,
      writeSucceeded: false
    };
  }

  const ref = await addDoc(collection(db, "vehicleViewEvents"), {
    ...payloadBase,
    viewedAt: serverTimestamp()
  });

  return {
    event: {
      id: ref.id,
      ...payloadBase,
      viewedAt: new Date().toISOString()
    } satisfies VehicleViewEvent,
    source: "firestore" as const,
    writeSucceeded: true
  };
}

export async function createOffer(input: OfferWriteInput) {
  if (!input.userId) {
    throw new Error("Please sign in to submit an offer.");
  }

  const buyerName = requireTrimmedValue(input.buyerName, "Please enter your name.");
  const buyerEmail = requireTrimmedValue(input.buyerEmail, "Please enter your email address.");
  const buyerPhone = requireTrimmedValue(input.buyerPhone, "Please enter your phone number.");
  if (!isValidEmailAddress(buyerEmail)) {
    throw new Error("Please enter a valid email address.");
  }

  if (input.offerAmount <= 0) {
    throw new Error("Offer amount must be greater than zero.");
  }

  const minimumOffer = Math.max(1000, Math.round(input.vehiclePrice * 0.5));
  if (input.offerAmount < minimumOffer) {
    throw new Error("Please enter a realistic offer amount.");
  }

  const vehicle = await getVehicleById(input.vehicleId);
  if (!vehicle || vehicle.status !== "approved" || vehicle.sellerStatus === "WITHDRAWN" || vehicle.sellerStatus === "SOLD") {
    throw new Error("This vehicle is not currently available for offers.");
  }
  if (vehicle.sellerStatus === "UNDER_OFFER") {
    throw new Error("This vehicle is currently under offer.");
  }

  const sanitizedMessage = sanitizeMultilineText(input.message);
  const initialMessages = [
    buildOfferUpdateForReturn("buyer", input.offerAmount),
    ...(sanitizedMessage ? [buildOfferMessageForReturn("buyer", sanitizedMessage)] : [])
  ];
  const initialMessagesForWrite = initialMessages.map(buildOfferThreadEntryForWrite);

  const payloadBase = {
    buyerUid: input.userId,
    listingOwnerUid: input.sellerOwnerUid,
    userId: input.userId,
    vehicleId: input.vehicleId,
    vehicleTitle: input.vehicleTitle,
    vehiclePrice: input.vehiclePrice,
    buyerName,
    buyerEmail,
    buyerPhone,
    amount: input.offerAmount,
    offerAmount: input.offerAmount,
    message: sanitizedMessage,
    messages: initialMessages,
    buyerViewed: true,
    sellerViewed: false,
    contactUnlocked: false,
    contactUnlockedAt: null,
    contactUnlockedBy: null,
    contactVisibilityState: "hidden" as OfferContactVisibilityState,
    lastUpdatedBy: "buyer" as const,
    sellerOwnerUid: input.sellerOwnerUid,
    submittedByUid: input.submittedByUid ?? input.userId,
    respondedAt: null,
    updatedAt: new Date().toISOString()
  };

  if (isFirebaseConfigured) {
    const recentOffers = await findRecentOffersForUser(input.userId, input.vehicleId);
    const offersInWindow = recentOffers.filter((offer) => isWithinWindow(offer.createdAt, 30 * 60 * 1000));
    if (offersInWindow.length >= 2) {
      throw new Error("Too many requests. Please try again later.");
    }

    const offersInDay = recentOffers.filter((offer) => isWithinWindow(offer.createdAt, 24 * 60 * 60 * 1000));
    if (offersInDay.length >= 3) {
      throw new Error("Too many requests. Please try again later.");
    }

    const duplicateFingerprint = `${input.offerAmount}|${normalizeDuplicateText(sanitizedMessage)}`;
    const hasDuplicate = offersInWindow.some(
      (offer) => `${offer.offerAmount}|${normalizeDuplicateText(offer.message)}` === duplicateFingerprint
    );
    if (hasDuplicate) {
      throw new Error("It looks like this request was already submitted.");
    }
  }

  if (!isFirebaseConfigured) {
    const offer = {
      id: `mock-offer-${Date.now()}`,
      ...payloadBase,
      status: "pending" as const,
      createdAt: new Date().toISOString()
    } satisfies Offer;

    return {
      offer,
      source: "mock" as const,
      writeSucceeded: false
    } satisfies OfferWriteResult;
  }

  const payload = {
    ...payloadBase,
    messages: initialMessagesForWrite,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, "offers"), payload);
  try {
    await addDoc(collection(db, "vehicleActivityEvents"), {
      vehicleId: input.vehicleId,
      type: "offer_created",
      message: "Activity update: a new offer has been made on a vehicle you saved.",
      actorUid: input.userId,
      createdAt: serverTimestamp()
    });
  } catch {
    // Offer submission should still succeed even if the activity feed event cannot be written.
  }
  try {
    await saveVehicle({ userId: input.userId, vehicleId: input.vehicleId });
  } catch {
    // Offer submission should still succeed even if the optional auto-save cannot complete.
  }
  const offer = {
    id: ref.id,
    ...payloadBase,
    status: "pending" as const,
    createdAt: new Date().toISOString()
  } satisfies Offer;

  const sellerNotificationEmail = await getUserNotificationEmail(input.sellerOwnerUid);
  await queueOfferLifecycleEmailNotification("new_offer_to_seller", offer, sellerNotificationEmail);
  await queueOfferActivityNotificationsForOffer(offer, vehicle, input.userId).catch(() => undefined);

  return {
    offer,
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies OfferWriteResult;
}

export async function createInspectionRequest(input: InspectionRequestWriteInput) {
  if (!input.submittedByUid) {
    throw new Error("Please sign in to request an inspection.");
  }

  const buyerName = requireTrimmedValue(input.buyerName, "Please enter your name.");
  const buyerEmail = requireTrimmedValue(input.buyerEmail, "Please enter your email address.");
  const buyerPhone = requireTrimmedValue(input.buyerPhone, "Please enter your phone number.");
  const preferredTime = requireTrimmedValue(input.preferredTime, "Please share a preferred inspection time.");
  if (!isValidEmailAddress(buyerEmail)) {
    throw new Error("Please enter a valid email address.");
  }
  const sanitizedMessage = sanitizeMultilineText(input.message);

  const payloadBase = {
    vehicleId: input.vehicleId,
    vehicleTitle: input.vehicleTitle,
    buyerName,
    buyerEmail,
    buyerPhone,
    preferredTime,
    message: sanitizedMessage,
    listingType: input.listingType,
    sellerOwnerUid: input.sellerOwnerUid,
    submittedByUid: input.submittedByUid
  };

  if (isFirebaseConfigured) {
    const recentInspectionRequests = await findRecentInspectionRequestsForUser(input.submittedByUid, input.vehicleId);
    const requestsInWindow = recentInspectionRequests.filter((inspectionRequest) =>
      isWithinWindow(inspectionRequest.createdAt, 30 * 60 * 1000)
    );
    if (requestsInWindow.length >= 2) {
      throw new Error("Too many requests. Please try again later.");
    }

    const requestsInDay = recentInspectionRequests.filter((inspectionRequest) =>
      isWithinWindow(inspectionRequest.createdAt, 24 * 60 * 60 * 1000)
    );
    if (requestsInDay.length >= 3) {
      throw new Error("Too many requests. Please try again later.");
    }

    const duplicateFingerprint = `${normalizeDuplicateText(preferredTime)}|${normalizeDuplicateText(sanitizedMessage)}`;
    const hasDuplicate = requestsInWindow.some(
      (inspectionRequest) =>
        `${normalizeDuplicateText(inspectionRequest.preferredTime)}|${normalizeDuplicateText(inspectionRequest.message)}` ===
        duplicateFingerprint
    );
    if (hasDuplicate) {
      throw new Error("It looks like this request was already submitted.");
    }
  }

  if (!isFirebaseConfigured) {
    const inspectionRequest = {
      id: `mock-inspection-${Date.now()}`,
      ...payloadBase,
      status: "NEW" as const,
      createdAt: new Date().toISOString()
    } satisfies InspectionRequest;

    return {
      inspectionRequest,
      source: "mock" as const,
      writeSucceeded: false
    } satisfies InspectionRequestWriteResult;
  }

  const payload = {
    ...payloadBase,
    status: "NEW",
    createdAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, "inspectionRequests"), payload);
  const inspectionRequest = {
    id: ref.id,
    ...payloadBase,
    status: "NEW" as const,
    createdAt: new Date().toISOString()
  } satisfies InspectionRequest;

  return {
    inspectionRequest,
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies InspectionRequestWriteResult;
}

export async function createPricingRequest(input: PricingRequestWriteInput) {
  if (!input.userId) {
    throw new Error("Please sign in to request pricing advice.");
  }

  const timeline = requireTrimmedValue(input.timeline, "Please select your selling timeline.") as PricingRequestTimeline;
  const message = sanitizeMultilineText(requireTrimmedValue(input.message, "Please enter a few notes for our team."));
  const currentPrice =
    typeof input.currentPrice === "number" && Number.isFinite(input.currentPrice) && input.currentPrice > 0
      ? input.currentPrice
      : undefined;
  const vehicleId = input.vehicleId?.trim() || undefined;

  const payloadBase = {
    userId: input.userId,
    ...(vehicleId ? { vehicleId } : {}),
    ...(currentPrice ? { currentPrice } : {}),
    timeline,
    message,
    status: "NEW" as const,
    response: ""
  };

  if (isFirebaseConfigured) {
    const recentPricingRequests = await findRecentPricingRequestsForUser(input.userId);
    const requestsInWindow = recentPricingRequests.filter((pricingRequest) => isWithinWindow(pricingRequest.createdAt, 60 * 60 * 1000));
    if (requestsInWindow.length >= 2) {
      throw new Error("Too many requests. Please try again later.");
    }

    const requestsInDay = recentPricingRequests.filter((pricingRequest) => isWithinWindow(pricingRequest.createdAt, 24 * 60 * 60 * 1000));
    if (requestsInDay.length >= 4) {
      throw new Error("Too many requests. Please try again later.");
    }

    const duplicateFingerprint = `${vehicleId ?? ""}|${normalizeDuplicateText(timeline)}|${normalizeDuplicateText(message)}`;
    const hasDuplicate = requestsInWindow.some(
      (pricingRequest) =>
        `${pricingRequest.vehicleId ?? ""}|${normalizeDuplicateText(pricingRequest.timeline)}|${normalizeDuplicateText(pricingRequest.message)}` ===
        duplicateFingerprint
    );
    if (hasDuplicate) {
      throw new Error("It looks like this request was already submitted.");
    }
  }

  if (!isFirebaseConfigured) {
    const pricingRequest = {
      id: `mock-pricing-${Date.now()}`,
      ...payloadBase,
      createdAt: new Date().toISOString()
    } satisfies PricingRequest;

    return {
      pricingRequest,
      source: "mock" as const,
      writeSucceeded: false
    } satisfies PricingRequestWriteResult;
  }

  const payload = {
    ...payloadBase,
    createdAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, "pricingRequests"), payload);
  const pricingRequest = {
    id: ref.id,
    ...payloadBase,
    createdAt: new Date().toISOString()
  } satisfies PricingRequest;

  return {
    pricingRequest,
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies PricingRequestWriteResult;
}

export async function saveVehicle(input: SaveVehicleWriteInput) {
  if (!input.userId) {
    throw new Error("Please sign in to save this vehicle.");
  }

  if (!isFirebaseConfigured) {
    const savedVehicle = {
      id: `mock-saved-${Date.now()}`,
      userId: input.userId,
      vehicleId: input.vehicleId,
      createdAt: new Date().toISOString()
    } satisfies SavedVehicle;

    return {
      savedVehicle,
      source: "mock" as const,
      writeSucceeded: false
    } satisfies SaveVehicleWriteResult;
  }

  const existing = await getSavedVehicleRecord(input.userId, input.vehicleId);
  if (existing) {
    return {
      savedVehicle: existing,
      source: "firestore" as const,
      writeSucceeded: true
    } satisfies SaveVehicleWriteResult;
  }

  const payload = {
    userId: input.userId,
    vehicleId: input.vehicleId,
    createdAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, "savedVehicles"), payload);
  const savedVehicle = {
    id: ref.id,
    userId: input.userId,
    vehicleId: input.vehicleId,
    createdAt: new Date().toISOString()
  } satisfies SavedVehicle;

  return {
    savedVehicle,
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies SaveVehicleWriteResult;
}

export async function updateInspectionRequestStatus(
  id: string,
  status: InspectionRequestStatus,
  actor: VehicleActor,
  existingInspectionRequest?: InspectionRequest
) {
  if (!isAdminLikeRole(actor.role) && !isSellerLikeRole(actor.role)) {
    throw new Error("Only admins and sellers can update inspection requests.");
  }
  if (isAdminLikeRole(actor.role)) {
    assertAdminPermissionForActor(actor, "manageInspections", "You do not have access to manage inspection requests.");
  }

  const inspectionRequest = existingInspectionRequest ?? (await getInspectionRequestById(id));
  if (!inspectionRequest) {
    throw new Error("Inspection request not found.");
  }

  if (isSellerLikeRole(actor.role) && inspectionRequest.sellerOwnerUid !== actor.id) {
    throw new Error("You can only manage inspection requests for your own vehicles.");
  }

  if (!isFirebaseConfigured) {
    return {
      inspectionRequest: {
        ...inspectionRequest,
        status
      },
      source: "mock" as const,
      writeSucceeded: false
    } satisfies InspectionRequestWriteResult;
  }

  await updateDoc(doc(db, "inspectionRequests", id), { status });

  return {
    inspectionRequest: {
      ...inspectionRequest,
      status
    },
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies InspectionRequestWriteResult;
}

export async function appendOfferMessage(
  id: string,
  sender: OfferMessageSender,
  text: string,
  actor: VehicleActor,
  existingOffer?: Offer
) {
  const sanitizedText = sanitizeMultilineText(text);
  if (!sanitizedText) {
    throw new Error("Please enter a message before replying.");
  }

  if (isAdminLikeRole(actor.role)) {
    assertAdminPermissionForActor(actor, "manageOffers", "You do not have access to manage offers.");
  }

  const offer =
    existingOffer ??
    (
      await (async () => {
        if (!isFirebaseConfigured) return null;
        const snapshot = await getDoc(doc(db, "offers", id));
        if (!snapshot.exists()) return null;
        return serializeOfferDoc(snapshot.id, snapshot.data());
      })()
    );

  if (!offer) {
    throw new Error("Offer not found.");
  }

  const isOfferSeller = offer.listingOwnerUid === actor.id;
  const isOfferBuyer = offer.buyerUid === actor.id;

  if (sender === "seller" && !isOfferSeller && !isAdminLikeRole(actor.role)) {
    throw new Error("You can only reply to offers for your own vehicles.");
  }

  if (sender === "buyer" && !isOfferBuyer && !isAdminLikeRole(actor.role)) {
    throw new Error("You can only reply to your own offers.");
  }

  if (sender === "buyer" && offer.status !== "pending" && offer.status !== "countered") {
    throw new Error("Buyer replies are only available while the negotiation is still active.");
  }

  const nextMessage = buildOfferMessageForReturn(sender, sanitizedText);
  const nextMessages = [...offer.messages, nextMessage];
  const nextBuyerViewed = sender === "seller" ? false : true;
  const nextSellerViewed = sender === "seller" ? true : false;

  if (!isFirebaseConfigured) {
    return {
      offer: {
        ...offer,
        messages: nextMessages,
        buyerViewed: nextBuyerViewed,
        sellerViewed: nextSellerViewed,
        updatedAt: new Date().toISOString()
      },
      source: "mock" as const,
      writeSucceeded: false
    } satisfies OfferWriteResult;
  }

  await updateDoc(doc(db, "offers", id), {
    messages: [...offer.messages.map(toStoredOfferThreadEntry), buildOfferThreadEntryForWrite(buildOfferMessageForReturn(sender, sanitizedText))],
    buyerViewed: nextBuyerViewed,
    sellerViewed: nextSellerViewed,
    updatedAt: serverTimestamp()
  });

  return {
    offer: {
      ...offer,
      messages: nextMessages,
      buyerViewed: nextBuyerViewed,
      sellerViewed: nextSellerViewed,
      updatedAt: new Date().toISOString()
    },
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies OfferWriteResult;
}

export async function updateOfferAmount(
  id: string,
  nextAmount: number,
  sender: OfferMessageSender,
  actor: VehicleActor,
  existingOffer?: Offer
) {
  if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
    throw new Error("Offer amount must be greater than zero.");
  }

  if (isAdminLikeRole(actor.role)) {
    assertAdminPermissionForActor(actor, "manageOffers", "You do not have access to manage offers.");
  }

  const offer =
    existingOffer ??
    (
      await (async () => {
        if (!isFirebaseConfigured) return null;
        const snapshot = await getDoc(doc(db, "offers", id));
        if (!snapshot.exists()) return null;
        return serializeOfferDoc(snapshot.id, snapshot.data());
      })()
    );

  if (!offer) {
    throw new Error("Offer not found.");
  }

  const isOfferSeller = offer.listingOwnerUid === actor.id;
  const isOfferBuyer = offer.buyerUid === actor.id;

  if (sender === "seller" && !isOfferSeller && !isAdminLikeRole(actor.role)) {
    throw new Error("You can only counter offers for your own listings.");
  }

  if (sender === "buyer" && !isOfferBuyer && !isAdminLikeRole(actor.role)) {
    throw new Error("You can only revise your own offers.");
  }

  if (sender === "seller" && offer.status !== "pending") {
    throw new Error("Counteroffers are only available while a buyer offer is still pending.");
  }

  if (sender === "buyer" && offer.status !== "pending" && offer.status !== "countered") {
    throw new Error("Price updates are only available while the negotiation is still active.");
  }

  const minimumOffer = Math.max(1000, Math.round(offer.vehiclePrice * 0.5));
  if (nextAmount < minimumOffer) {
    throw new Error("Please enter a realistic offer amount.");
  }

  const nextEntry = buildOfferUpdateForReturn(sender, nextAmount);
  const nextMessages = [...offer.messages, nextEntry];
  const nextStatus: OfferStatus =
    sender === "seller"
      ? "countered"
      : "pending";
  const nextBuyerViewed = sender === "seller" ? false : true;
  const nextSellerViewed = sender === "seller" ? true : false;
  const nextRespondedAt = sender === "seller" ? new Date().toISOString() : null;

  if (!isFirebaseConfigured) {
    return {
      offer: {
        ...offer,
        amount: nextAmount,
        offerAmount: nextAmount,
        status: nextStatus,
        messages: nextMessages,
        buyerViewed: nextBuyerViewed,
        sellerViewed: nextSellerViewed,
        lastUpdatedBy: sender,
        respondedAt: nextRespondedAt,
        updatedAt: new Date().toISOString()
      },
      source: "mock" as const,
      writeSucceeded: false
    } satisfies OfferWriteResult;
  }

  await updateDoc(doc(db, "offers", id), {
    amount: nextAmount,
    offerAmount: nextAmount,
    status: nextStatus,
    messages: [...offer.messages.map(toStoredOfferThreadEntry), buildOfferThreadEntryForWrite(nextEntry)],
    buyerViewed: nextBuyerViewed,
    sellerViewed: nextSellerViewed,
    lastUpdatedBy: sender,
    respondedAt: sender === "seller" ? serverTimestamp() : null,
    updatedAt: serverTimestamp()
  });

  if (sender === "seller") {
    const buyerNotificationEmail = await getUserNotificationEmail(offer.buyerUid, offer.buyerEmail);
    await queueOfferLifecycleEmailNotification("seller_countered_offer", {
      ...offer,
      amount: nextAmount,
      offerAmount: nextAmount,
      status: nextStatus,
      messages: nextMessages,
      buyerViewed: nextBuyerViewed,
      sellerViewed: nextSellerViewed,
      lastUpdatedBy: sender,
      respondedAt: nextRespondedAt,
      updatedAt: new Date().toISOString()
    }, buyerNotificationEmail);
  }

  return {
    offer: {
      ...offer,
      amount: nextAmount,
      offerAmount: nextAmount,
      status: nextStatus,
      messages: nextMessages,
      buyerViewed: nextBuyerViewed,
      sellerViewed: nextSellerViewed,
      lastUpdatedBy: sender,
      respondedAt: nextRespondedAt,
      updatedAt: new Date().toISOString()
    },
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies OfferWriteResult;
}

export async function submitBuyerReplacementOffer(
  id: string,
  nextAmount: number,
  actor: VehicleActor,
  existingOffer?: Offer
) {
  if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
    throw new Error("Offer amount must be greater than zero.");
  }

  if (isAdminLikeRole(actor.role)) {
    assertAdminPermissionForActor(actor, "manageOffers", "You do not have access to manage offers.");
  }

  const offer =
    existingOffer ??
    (
      await (async () => {
        if (!isFirebaseConfigured) return null;
        const snapshot = await getDoc(doc(db, "offers", id));
        if (!snapshot.exists()) return null;
        return serializeOfferDoc(snapshot.id, snapshot.data());
      })()
    );

  if (!offer) {
    throw new Error("Offer not found.");
  }

  const isOfferBuyer = offer.buyerUid === actor.id;
  if (!isOfferBuyer && !isAdminLikeRole(actor.role)) {
    throw new Error("You can only update your own offers.");
  }

  if (offer.status !== "buyer_declined") {
    throw new Error("A replacement offer is only available after you decline an accepted offer.");
  }

  const minimumOffer = Math.max(1000, Math.round(offer.vehiclePrice * 0.5));
  if (nextAmount < minimumOffer) {
    throw new Error("Please enter a realistic offer amount.");
  }

  const vehicle = await getVehicleById(offer.vehicleId);
  if (!vehicle || vehicle.status !== "approved" || vehicle.sellerStatus === "WITHDRAWN" || vehicle.sellerStatus === "SOLD") {
    throw new Error("This vehicle is not currently available for another offer.");
  }

  if (vehicle.sellerStatus === "UNDER_OFFER" && vehicle.underOfferBuyerUid && vehicle.underOfferBuyerUid !== offer.buyerUid) {
    throw new Error("This vehicle is currently under offer.");
  }

  const nextEntry = buildOfferUpdateForReturn("buyer", nextAmount);
  const nextMessages = [...offer.messages, nextEntry];

  if (!isFirebaseConfigured) {
    return {
      offer: {
        ...offer,
        amount: nextAmount,
        offerAmount: nextAmount,
        status: "pending",
        messages: nextMessages,
        buyerViewed: true,
        sellerViewed: false,
        lastUpdatedBy: "buyer",
        respondedAt: null,
        updatedAt: new Date().toISOString()
      },
      source: "mock" as const,
      writeSucceeded: false
    } satisfies OfferWriteResult;
  }

  await updateDoc(doc(db, "offers", id), {
    amount: nextAmount,
    offerAmount: nextAmount,
    status: "pending",
    messages: [...offer.messages.map(toStoredOfferThreadEntry), buildOfferThreadEntryForWrite(nextEntry)],
    buyerViewed: true,
    sellerViewed: false,
    lastUpdatedBy: "buyer",
    respondedAt: null,
    updatedAt: serverTimestamp()
  });

  return {
    offer: {
      ...offer,
      amount: nextAmount,
      offerAmount: nextAmount,
      status: "pending",
      messages: nextMessages,
      buyerViewed: true,
      sellerViewed: false,
      lastUpdatedBy: "buyer",
      respondedAt: null,
      updatedAt: new Date().toISOString()
    },
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies OfferWriteResult;
}

export async function markBuyerOfferResponsesViewed(buyerUid: string) {
  if (!buyerUid || !isFirebaseConfigured) return;

  const snapshot = await getDocs(query(collection(db, "offers"), where("userId", "==", buyerUid)));
  const offers = snapshot.docs.map((item) => serializeOfferDoc(item.id, item.data()));
  const pendingUpdates = offers.filter((offer) => !offer.buyerViewed);

  await Promise.all(
    pendingUpdates.map((offer) =>
      updateDoc(doc(db, "offers", offer.id), {
        buyerViewed: true,
        updatedAt: serverTimestamp()
      })
    )
  );
}

export async function markSellerOffersViewed(ownerUid: string) {
  if (!ownerUid || !isFirebaseConfigured) return;

  const snapshot = await getDocs(query(collection(db, "offers"), where("sellerOwnerUid", "==", ownerUid)));
  const offers = snapshot.docs.map((item) => serializeOfferDoc(item.id, item.data()));
  const pendingUpdates = offers.filter((offer) => !offer.sellerViewed);

  await Promise.all(
    pendingUpdates.map((offer) =>
      updateDoc(doc(db, "offers", offer.id), {
        sellerViewed: true,
        updatedAt: serverTimestamp()
      })
    )
  );
}

export async function unlockOfferContactDetails(
  id: string,
  actor: VehicleActor,
  existingOffer?: Offer
) {
  if (isAdminLikeRole(actor.role)) {
    assertAdminPermissionForActor(actor, "manageOffers", "You do not have access to manage offers.");
  }

  const offer =
    existingOffer ??
    (
      await (async () => {
        if (!isFirebaseConfigured) return null;
        const snapshot = await getDoc(doc(db, "offers", id));
        if (!snapshot.exists()) return null;
        return serializeOfferDoc(snapshot.id, snapshot.data());
      })()
    );

  if (!offer) {
    throw new Error("Offer not found.");
  }

  const isOfferSeller = offer.listingOwnerUid === actor.id;
  if (!isOfferSeller && !isAdminLikeRole(actor.role)) {
    throw new Error("You can only share contact details for offers on your own vehicles.");
  }

  if (offer.contactUnlocked) {
    return {
      offer,
      source: isFirebaseConfigured ? ("firestore" as const) : ("mock" as const),
      writeSucceeded: isFirebaseConfigured
    } satisfies OfferWriteResult;
  }

  const now = new Date().toISOString();

  if (!isFirebaseConfigured) {
    return {
      offer: {
        ...offer,
        contactUnlocked: true,
        contactUnlockedAt: now,
        contactUnlockedBy: "seller_manual",
        contactVisibilityState: "shared_after_accept",
        buyerViewed: false,
        sellerViewed: true,
        updatedAt: now
      },
      source: "mock" as const,
      writeSucceeded: false
    } satisfies OfferWriteResult;
  }

  await updateDoc(doc(db, "offers", id), {
    contactUnlocked: true,
    contactUnlockedAt: serverTimestamp(),
    contactUnlockedBy: "seller_manual" satisfies OfferContactUnlockSource,
    contactVisibilityState: "shared_after_accept" satisfies OfferContactVisibilityState,
    buyerViewed: false,
    sellerViewed: true,
    updatedAt: serverTimestamp()
  });

  return {
      offer: {
        ...offer,
        contactUnlocked: true,
        contactUnlockedAt: now,
        contactUnlockedBy: "seller_manual",
        contactVisibilityState: "shared_after_accept",
        buyerViewed: false,
        sellerViewed: true,
        updatedAt: now
      },
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies OfferWriteResult;
}

export async function updateOfferStatus(id: string, status: OfferStatus, actor: VehicleActor, existingOffer?: Offer) {
  if (isAdminLikeRole(actor.role)) {
    assertAdminPermissionForActor(actor, "manageOffers", "You do not have access to manage offers.");
  }

  const offer =
    existingOffer ??
    (
      await (async () => {
        if (!isFirebaseConfigured) return null;
        const snapshot = await getDoc(doc(db, "offers", id));
        if (!snapshot.exists()) return null;
        return serializeOfferDoc(snapshot.id, snapshot.data());
      })()
    );

  if (!offer) {
    throw new Error("Offer not found.");
  }

  const isOfferSeller = offer.listingOwnerUid === actor.id;
  const isOfferBuyer = offer.buyerUid === actor.id;

  if (!isAdminLikeRole(actor.role) && !isOfferSeller && !isOfferBuyer) {
    throw new Error("You do not have access to update this offer.");
  }

  const isLegacyTransition =
    status === "accepted_pending_buyer_confirmation"
    || status === "buyer_confirmed"
    || status === "buyer_declined"
    || status === "rejected";

  let nextRespondedAt = offer.respondedAt ?? null;
  let nextBuyerViewed = offer.buyerViewed;
  let nextSellerViewed = offer.sellerViewed;
  let nextContactUnlocked = offer.contactUnlocked;
  let nextContactUnlockedBy = offer.contactUnlockedBy ?? null;
  let nextContactUnlockedAt = offer.contactUnlockedAt ?? null;
  let nextContactVisibilityState = offer.contactVisibilityState ?? (offer.contactUnlocked ? "shared_after_accept" : "hidden");
  let nextLastUpdatedBy = offer.lastUpdatedBy;
  let nextVehiclePatch: { sellerStatus: SellerVehicleStatus; underOfferBuyerUid: string } | null = null;
  let emailKind: OfferLifecycleNotificationKind | null = null;
  let emailRecipient = "";

  if (!isLegacyTransition) {
    if (status === "accepted") {
      if (isOfferSeller && offer.status === "pending") {
        nextRespondedAt = new Date().toISOString();
        nextBuyerViewed = false;
        nextSellerViewed = true;
        nextContactUnlocked = true;
        nextContactUnlockedBy = "seller_accept";
        nextContactUnlockedAt = new Date().toISOString();
        nextContactVisibilityState = "shared_after_accept";
        nextLastUpdatedBy = "seller";
        emailKind = "seller_accepted_offer";
        emailRecipient = await getUserNotificationEmail(offer.buyerUid, offer.buyerEmail);
      } else if (isOfferBuyer && offer.status === "countered") {
        nextRespondedAt = new Date().toISOString();
        nextBuyerViewed = true;
        nextSellerViewed = false;
        nextContactUnlocked = true;
        nextContactUnlockedBy = "buyer_counter_accept";
        nextContactUnlockedAt = new Date().toISOString();
        nextContactVisibilityState = "shared_after_counter_accept";
        nextLastUpdatedBy = "buyer";
        emailKind = "buyer_accepted_counteroffer";
        emailRecipient = await getUserNotificationEmail(offer.listingOwnerUid);
      } else {
        throw new Error("This offer cannot be accepted right now.");
      }
    } else if (status === "declined") {
      if (isOfferSeller && offer.status === "pending") {
        nextRespondedAt = new Date().toISOString();
        nextBuyerViewed = false;
        nextSellerViewed = true;
        nextContactUnlocked = false;
        nextContactUnlockedBy = null;
        nextContactUnlockedAt = null;
        nextContactVisibilityState = "hidden";
        nextLastUpdatedBy = "seller";
      } else if (isOfferBuyer && offer.status === "countered") {
        nextRespondedAt = new Date().toISOString();
        nextBuyerViewed = true;
        nextSellerViewed = true;
        nextContactUnlocked = false;
        nextContactUnlockedBy = null;
        nextContactUnlockedAt = null;
        nextContactVisibilityState = "hidden";
        nextLastUpdatedBy = "buyer";
      } else {
        throw new Error("This offer cannot be declined right now.");
      }
    } else {
      throw new Error("This status transition is not supported.");
    }
  } else {
    if (isOfferSeller && status === "accepted_pending_buyer_confirmation" && offer.status !== "pending") {
      throw new Error("Only pending offers can be accepted.");
    }

    if (isOfferSeller && status === "rejected" && offer.status !== "pending") {
      throw new Error("Only pending offers can be rejected.");
    }

    if (isOfferBuyer && status === "buyer_confirmed" && offer.status !== "accepted_pending_buyer_confirmation") {
      throw new Error("This offer is not awaiting buyer confirmation.");
    }

    if (isOfferBuyer && status === "buyer_declined" && offer.status !== "accepted_pending_buyer_confirmation") {
      throw new Error("This offer is not awaiting buyer confirmation.");
    }

    nextRespondedAt =
      status === "accepted_pending_buyer_confirmation" || status === "rejected"
        ? new Date().toISOString()
        : offer.respondedAt ?? null;

    nextBuyerViewed =
      status === "accepted_pending_buyer_confirmation" || status === "rejected"
        ? false
        : status === "buyer_confirmed" || status === "buyer_declined"
          ? true
          : offer.buyerViewed;

    nextSellerViewed =
      status === "accepted_pending_buyer_confirmation" || status === "rejected"
        ? true
        : status === "buyer_confirmed" || status === "buyer_declined"
          ? true
          : offer.sellerViewed;

    nextContactUnlocked = status === "buyer_confirmed" ? true : offer.contactUnlocked;
    nextContactUnlockedBy = status === "buyer_confirmed" ? "buyer_confirm" : offer.contactUnlockedBy ?? null;
    nextContactUnlockedAt = status === "buyer_confirmed" ? new Date().toISOString() : offer.contactUnlockedAt ?? null;
    nextContactVisibilityState = status === "buyer_confirmed" ? "shared_after_accept" : offer.contactVisibilityState ?? "hidden";
    nextLastUpdatedBy =
      status === "accepted_pending_buyer_confirmation" || status === "rejected"
        ? "seller"
        : status === "buyer_confirmed" || status === "buyer_declined"
          ? "buyer"
          : offer.lastUpdatedBy;

    const baseVehicle = await getVehicleById(offer.vehicleId);
    if (!baseVehicle) {
      throw new Error("Vehicle not found.");
    }

    if (
      status === "accepted_pending_buyer_confirmation"
      && baseVehicle.sellerStatus === "UNDER_OFFER"
      && baseVehicle.underOfferBuyerUid
      && baseVehicle.underOfferBuyerUid !== offer.buyerUid
    ) {
      throw new Error("This vehicle is already under offer.");
    }

    nextVehiclePatch =
      status === "accepted_pending_buyer_confirmation"
        ? {
            sellerStatus: "UNDER_OFFER" as const,
            underOfferBuyerUid: offer.buyerUid
          }
        : status === "buyer_declined"
          ? {
              sellerStatus: "ACTIVE" as const,
              underOfferBuyerUid: ""
            }
          : null;
  }

  if (!isFirebaseConfigured) {
    return {
      offer: {
        ...offer,
        status,
        buyerViewed: nextBuyerViewed,
        sellerViewed: nextSellerViewed,
        contactUnlocked: nextContactUnlocked,
        contactUnlockedAt: nextContactUnlockedAt,
        contactUnlockedBy: nextContactUnlockedBy,
        contactVisibilityState: nextContactVisibilityState,
        lastUpdatedBy: nextLastUpdatedBy,
        respondedAt: nextRespondedAt,
        updatedAt: new Date().toISOString()
      },
      source: "mock" as const,
      writeSucceeded: false
    } satisfies OfferWriteResult;
  }

  const batch = writeBatch(db);

  if (nextVehiclePatch) {
    batch.update(doc(db, "vehicles", offer.vehicleId), {
      sellerStatus: nextVehiclePatch.sellerStatus,
      underOfferBuyerUid: nextVehiclePatch.underOfferBuyerUid || deleteField(),
      updatedAt: serverTimestamp()
    });
  }

  batch.update(doc(db, "offers", id), {
    status,
    buyerViewed: nextBuyerViewed,
    sellerViewed: nextSellerViewed,
    contactUnlocked: nextContactUnlocked,
    contactUnlockedAt:
      status === "buyer_confirmed" || status === "accepted"
        ? serverTimestamp()
        : nextContactUnlockedAt,
    contactUnlockedBy: nextContactUnlockedBy,
    contactVisibilityState: nextContactVisibilityState,
    lastUpdatedBy: nextLastUpdatedBy,
    respondedAt:
      status === "accepted_pending_buyer_confirmation"
      || status === "rejected"
      || status === "accepted"
      || status === "declined"
        ? serverTimestamp()
        : nextRespondedAt,
    updatedAt: serverTimestamp()
  });

  await batch.commit();

  const nextOffer = {
    ...offer,
    status,
    buyerViewed: nextBuyerViewed,
    sellerViewed: nextSellerViewed,
    contactUnlocked: nextContactUnlocked,
    contactUnlockedAt: nextContactUnlockedAt,
    contactUnlockedBy: nextContactUnlockedBy,
    contactVisibilityState: nextContactVisibilityState,
    lastUpdatedBy: nextLastUpdatedBy,
    respondedAt: nextRespondedAt,
    updatedAt: new Date().toISOString()
  } satisfies Offer;

  if (emailKind && emailRecipient) {
    await queueOfferLifecycleEmailNotification(emailKind, nextOffer, emailRecipient);
  }

  return {
    offer: nextOffer,
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies OfferWriteResult;
}

export async function createQuote(input: QuoteWriteInput) {
  return createQuoteRequest(input);
}

export async function createQuoteRequest(input: QuoteWriteInput) {
  const payloadBase = {
    ownerId: input.ownerId,
    sellerUid: input.sellerUid,
    sellerName: input.sellerName,
    sellerEmail: input.sellerEmail,
    ...(input.vehicleId ? { vehicleId: input.vehicleId } : {}),
    vehicleYear: input.vehicleYear,
    vehicleMake: input.vehicleMake,
    vehicleModel: input.vehicleModel,
    quoteType: input.quoteType,
    source: input.source,
    notes: input.notes
  };

  if (!isFirebaseConfigured) {
    const quote = {
      id: `mock-quote-${Date.now()}`,
      ...payloadBase,
      status: "NEW" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } satisfies Quote;

    return {
      quote,
      source: "mock" as const,
      writeSucceeded: false
    } satisfies QuoteWriteResult;
  }

  const payload = {
    ...payloadBase,
    status: "NEW",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, "quotes"), payload);
  const quote = {
    id: ref.id,
    ...payloadBase,
    status: "NEW" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  } satisfies Quote;

  return {
    quote,
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies QuoteWriteResult;
}

export async function updateQuoteStatus(id: string, status: QuoteStatus, actor: VehicleActor, existingQuote?: Quote) {
  assertAdminPermissionForActor(actor, "manageQuotes", "Only authorized admins can update quote request statuses.");

  const quote =
    existingQuote ??
    (
      await (async () => {
        if (!isFirebaseConfigured) return null;
        const snapshot = await getDoc(doc(db, "quotes", id));
        if (!snapshot.exists()) return null;
        return serializeDoc<Quote>(snapshot.id, snapshot.data());
      })()
    );

  if (!quote) {
    throw new Error("Quote request not found.");
  }

  if (!isFirebaseConfigured) {
    return {
      quote: {
        ...quote,
        status,
        updatedAt: new Date().toISOString()
      },
      source: "mock" as const,
      writeSucceeded: false
    } satisfies QuoteWriteResult;
  }

  await updateDoc(doc(db, "quotes", id), {
    status,
    updatedAt: serverTimestamp()
  });

  return {
    quote: {
      ...quote,
      status,
      updatedAt: new Date().toISOString()
    },
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies QuoteWriteResult;
}

export async function createContactMessage(input: ContactMessageWriteInput) {
  const name = sanitizeSingleLineText(requireTrimmedValue(input.name, "Please enter your name."));
  const email = requireTrimmedValue(input.email, "Please enter your email address.").toLowerCase();
  const phone = sanitizeSingleLineText(requireTrimmedValue(input.phone, "Please enter your phone number."));
  const subject = sanitizeSingleLineText(requireTrimmedValue(input.subject, "Please enter a subject."));
  const message = sanitizeMultilineText(requireTrimmedValue(input.message, "Please enter your message."));

  if (!isValidEmailAddress(email)) {
    throw new Error("Please enter a valid email address.");
  }

  if (!/^\d+$/.test(phone) || !isValidAustralianMobileNumber(phone)) {
    throw new Error("Please enter a valid Australian mobile number (e.g. 0412345678)");
  }

  const payloadBase = {
    name,
    email,
    phone,
    subject,
    message,
    category: input.category,
    status: "NEW" as const
  };

  if (isFirebaseConfigured) {
    const recentMessages = await findRecentContactMessagesForEmail(email);
    const messagesInWindow = recentMessages.filter((contactMessage) => isWithinWindow(contactMessage.createdAt, 10 * 60 * 1000));
    if (messagesInWindow.length >= 3) {
      throw new Error("Too many requests. Please try again later.");
    }

    const messagesInDay = recentMessages.filter((contactMessage) => isWithinWindow(contactMessage.createdAt, 24 * 60 * 60 * 1000));
    if (messagesInDay.length >= 10) {
      throw new Error("Too many requests. Please try again later.");
    }

    const duplicateFingerprint = `${normalizeDuplicateText(subject)}|${normalizeDuplicateText(message)}|${input.category}`;
    const hasDuplicate = messagesInWindow.some(
      (contactMessage) =>
        `${normalizeDuplicateText(contactMessage.subject)}|${normalizeDuplicateText(contactMessage.message)}|${contactMessage.category}` ===
        duplicateFingerprint
    );
    if (hasDuplicate) {
      throw new Error("It looks like this request was already submitted.");
    }
  }

  if (!isFirebaseConfigured) {
    const contactMessage = {
      id: `mock-contact-${Date.now()}`,
      ...payloadBase,
      createdAt: new Date().toISOString()
    } satisfies ContactMessage;

    return {
      contactMessage,
      source: "mock" as const,
      writeSucceeded: false
    } satisfies ContactMessageWriteResult;
  }

  const payload = {
    ...payloadBase,
    createdAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, "contact_messages"), payload);
  const contactMessage = {
    id: ref.id,
    ...payloadBase,
    createdAt: new Date().toISOString()
  } satisfies ContactMessage;

  return {
    contactMessage,
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies ContactMessageWriteResult;
}

export async function updateContactMessageStatus(
  id: string,
  status: ContactMessageStatus,
  actor: VehicleActor,
  existingContactMessage?: ContactMessage
) {
  assertAdminPermissionForActor(actor, "manageEnquiries", "Only authorized admins can update enquiry statuses.");

  const contactMessage =
    existingContactMessage ??
    (
      await (async () => {
        if (!isFirebaseConfigured) return null;
        const snapshot = await getDoc(doc(db, "contact_messages", id));
        if (!snapshot.exists()) return null;
        return serializeDoc<ContactMessage>(snapshot.id, snapshot.data());
      })()
    );

  if (!contactMessage) {
    throw new Error("Enquiry not found.");
  }

  if (!isFirebaseConfigured) {
    return {
      contactMessage: {
        ...contactMessage,
        status
      },
      source: "mock" as const,
      writeSucceeded: false
    } satisfies ContactMessageWriteResult;
  }

  await updateDoc(doc(db, "contact_messages", id), { status });

  return {
    contactMessage: {
      ...contactMessage,
      status
    },
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies ContactMessageWriteResult;
}

export async function updatePricingRequest(
  id: string,
  input: PricingRequestUpdateInput,
  actor: VehicleActor,
  existingPricingRequest?: PricingRequest
) {
  assertAdminPermissionForActor(actor, "managePricing", "Only authorized admins can update pricing requests.");

  const pricingRequest =
    existingPricingRequest ??
    (
      await (async () => {
        if (!isFirebaseConfigured) return null;
        const snapshot = await getDoc(doc(db, "pricingRequests", id));
        if (!snapshot.exists()) return null;
        return serializeDoc<PricingRequest>(snapshot.id, snapshot.data());
      })()
    );

  if (!pricingRequest) {
    throw new Error("Pricing request not found.");
  }

  const response = input.response?.trim() ?? "";
  const leadRating = input.leadRating?.trim() ? input.leadRating : undefined;
  const nextAction = input.nextAction?.trim() ? input.nextAction : undefined;
  const respondedAt = response ? new Date().toISOString() : undefined;

  if (!isFirebaseConfigured) {
    return {
      pricingRequest: {
        ...pricingRequest,
        status: input.status,
        response,
        leadRating,
        nextAction,
        respondedAt
      },
      source: "mock" as const,
      writeSucceeded: false
    } satisfies PricingRequestWriteResult;
  }

  await updateDoc(doc(db, "pricingRequests", id), {
    status: input.status,
    response,
    leadRating: leadRating ?? deleteField(),
    nextAction: nextAction ?? deleteField(),
    respondedAt: response ? serverTimestamp() : deleteField()
  });

  return {
    pricingRequest: {
      ...pricingRequest,
      status: input.status,
      response,
      leadRating,
      nextAction,
      respondedAt
    },
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies PricingRequestWriteResult;
}
