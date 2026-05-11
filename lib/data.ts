import { Timestamp, addDoc, arrayRemove, arrayUnion, collection, deleteDoc, deleteField, doc, documentId, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
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
import { extractFirebaseStoragePath } from "@/lib/firebase-storage-paths";
import { deleteVehicleImageFiles } from "@/lib/storage";
import { getVehicleDisplayReference } from "@/lib/utils";
import {
  AccountType,
  AdminAuditActionType,
  AdminAuditRecordType,
  AdminPermissions,
  AppUser,
  ComplianceAlert,
  ComplianceStatus,
  ComplianceVehicleActivity,
  ContactMessage,
  ContactMessageCategory,
  ContactMessageStatus,
  DealerApplication,
  DealerApplicationProofFile,
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
  CustomerProfile,
  CustomerProfileStatus,
  UserRole,
  UserComplianceAssessment,
  Vehicle,
  VehicleActivityEvent,
  VehicleActor,
  VehicleAnalytics,
  VehicleAnalyticsBreakdown,
  VehicleFormInput,
  VehicleImageAsset,
  VehicleListingHistoryEntry,
  VehicleListingHistoryStatus,
  VehicleListingPriceHistoryEntry,
  VehicleListingStatusTimelineEntry,
  VehicleStatus,
  VehicleViewEvent,
  VehicleViewRole,
  VehicleDeviceType,
  VehicleRecord,
  VehicleRecordStatus,
  WarehouseRelationshipTree,
  UserSupportDealerRiskAccount,
  UserSupportAccountMetrics,
  UserSupportHighActivityAccount,
  UserSupportRecord,
  UserSupportSuggestion,
  WarehouseConditionItem,
  WarehouseDeclarationAnswer,
  WarehouseIntakeAgreement,
  WarehouseIntakeConditionReport,
  WarehouseIntakeDeclarations,
  WarehouseIntakeFileRecord,
  WarehouseIntakeOwnerDetails,
  WarehouseIntakePhotoRecord,
  WarehouseIntakeRecord,
  WarehouseServiceFeeItem,
  WarehouseIntakeSignature,
  WarehouseIntakeStatus,
  WarehouseIntakeVehicleDetails
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
  | "vehicleAnalytics"
  | "warehouseIntakes"
  | "customerProfiles"
  | "vehicleRecords"
  | "adminOperationalEvents";
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

export interface DealerAdditionalInformationInput {
  dealerResponseNote: string;
  additionalUploads: DealerApplicationProofFile[];
}

export interface DealerTermsAcceptanceResult {
  agreedToDealerTerms: boolean;
  agreedToTerms: boolean;
  agreedAt: string;
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
    const snapshot = await readFirestoreWithAuthRetry(() => getDocs(collection(db, name)));
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

function isFirestoreAuthPermissionError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();
  return message.includes("permission-denied")
    || message.includes("missing or insufficient permissions")
    || message.includes("unauthenticated");
}

async function readFirestoreWithAuthRetry<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (!isFirestoreAuthPermissionError(error) || !auth.currentUser) {
      throw error;
    }

    await auth.currentUser.getIdToken(true);
    return await operation();
  }
}

function serializeDate(value: unknown) {
  if (value && typeof value === "object" && "toDate" in (value as Record<string, unknown>)) {
    return ((value as { toDate: () => Date }).toDate()).toISOString();
  }
  return typeof value === "string" ? value : undefined;
}

function isPlainFirestoreWriteObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sanitizeFirestoreWriteValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeFirestoreWriteValue(item))
      .filter((item) => item !== undefined);
  }

  if (!isPlainFirestoreWriteObject(value)) {
    return value;
  }

  const entries = Object.entries(value).flatMap(([key, entry]) => {
    const sanitized = sanitizeFirestoreWriteValue(entry);
    return sanitized === undefined ? [] : [[key, sanitized] as const];
  });

  return Object.fromEntries(entries);
}

function sanitizeFirestoreWriteData<T extends Record<string, unknown>>(value: T): T {
  return sanitizeFirestoreWriteValue(value) as T;
}

function parseCurrencyNumber(value: unknown) {
  const normalized = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(normalized) ? normalized : 0;
}

function getActorDisplayName(actor?: Pick<VehicleActor, "displayName" | "name" | "email"> | null) {
  return actor?.displayName || actor?.name || actor?.email || "CarNest Admin";
}

function normalizeVehicleListingHistoryStatusFromVehicle(vehicle: Vehicle): VehicleListingHistoryStatus {
  if (vehicle.deleted || vehicle.status === "rejected" || vehicle.sellerStatus === "WITHDRAWN") return "withdrawn";
  if (vehicle.sellerStatus === "SOLD" || Boolean(vehicle.soldAt)) return "sold";
  if (vehicle.sellerStatus === "UNDER_OFFER") return "under_offer";
  if (vehicle.listingType === "warehouse" || vehicle.storedInWarehouse) return "warehouse_managed";
  if (vehicle.status === "approved") return "published";
  return "draft";
}

function upsertPriceHistory(
  entries: VehicleListingPriceHistoryEntry[],
  amount: number,
  capturedAt: string
) {
  if (!Number.isFinite(amount) || amount <= 0) return entries;
  const last = entries[entries.length - 1];
  if (last && last.amount === amount) return entries;
  return entries.concat({ amount, capturedAt });
}

function upsertStatusTimeline(
  entries: VehicleListingStatusTimelineEntry[],
  status: VehicleListingHistoryStatus,
  actor: VehicleActor | null,
  changedAt: string
) {
  const last = entries[entries.length - 1];
  if (last?.status === status) return entries;
  return entries.concat({
    status,
    changedAt,
    changedByUid: actor?.id || "",
    changedByName: getActorDisplayName(actor)
  });
}

async function writeAdminOperationalEvent(input: {
  actor: VehicleActor | null;
  recordType: AdminAuditRecordType;
  actionType: AdminAuditActionType;
  affectedRecordId: string;
  summary: string;
  customerProfileId?: string;
  vehicleRecordId?: string;
  intakeEventId?: string;
  publicListingId?: string;
}) {
  if (!isFirebaseConfigured || !input.actor || !isAdminLikeRole(input.actor.role)) return;

  const ref = doc(collection(db, "adminOperationalEvents"));
  await setDoc(ref, sanitizeFirestoreWriteData({
    recordType: input.recordType,
    actionType: input.actionType,
    affectedRecordId: input.affectedRecordId,
    customerProfileId: input.customerProfileId || "",
    vehicleRecordId: input.vehicleRecordId || "",
    intakeEventId: input.intakeEventId || "",
    publicListingId: input.publicListingId || "",
    staffUid: input.actor.id,
    staffName: getActorDisplayName(input.actor),
    summary: input.summary,
    createdAt: serverTimestamp()
  }));
}

async function resolveVehicleRecordIdFromPublicVehicle(vehicle: Vehicle) {
  if (!isFirebaseConfigured) return "";

  const vin = sanitizeSingleLineText(vehicle.vin ?? "");
  if (vin) {
    const snapshot = await getDocs(query(collection(db, "vehicleRecords"), where("vin", "==", vin), limit(1)));
    if (!snapshot.empty) return snapshot.docs[0].id;
  }

  const registrationPlate = sanitizeSingleLineText(vehicle.rego ?? "");
  if (registrationPlate) {
    const snapshot = await getDocs(query(collection(db, "vehicleRecords"), where("registrationPlate", "==", registrationPlate), limit(1)));
    if (!snapshot.empty) return snapshot.docs[0].id;
  }

  if (vehicle.id.trim()) {
    const snapshot = await getDocs(query(collection(db, "vehicleRecords"), where("publicListingId", "==", vehicle.id.trim()), limit(1)));
    if (!snapshot.empty) return snapshot.docs[0].id;
  }

  return "";
}

async function syncVehicleRecordFromPublicListing(
  vehicle: Vehicle,
  actor: VehicleActor | null,
  actionType: AdminAuditActionType = "linked_listing_synced"
) {
  if (!isFirebaseConfigured) return "";

  const existingId = await resolveVehicleRecordIdFromPublicVehicle(vehicle);
  const existingRecord = existingId ? await getVehicleRecordById(existingId) : null;
  const ref = existingId ? doc(db, "vehicleRecords", existingId) : doc(collection(db, "vehicleRecords"));
  const now = new Date().toISOString();
  const listingStatus = normalizeVehicleListingHistoryStatusFromVehicle(vehicle);
  const displayReference = getVehicleDisplayReference(vehicle);
  const priceHistory = upsertPriceHistory(existingRecord?.listingHistory.find((entry) => entry.publicListingId === vehicle.id)?.askingPriceHistory ?? [], vehicle.price, vehicle.updatedAt || now);
  const statusTransitions = upsertStatusTimeline(
    existingRecord?.listingHistory.find((entry) => entry.publicListingId === vehicle.id)?.statusTransitions ?? [],
    listingStatus,
    actor,
    vehicle.updatedAt || now
  );
  const listingHistoryEntry: VehicleListingHistoryEntry = {
    ...(existingRecord?.listingHistory.find((entry) => entry.publicListingId === vehicle.id) ?? createEmptyVehicleListingHistoryEntry()),
    id: existingRecord?.listingHistory.find((entry) => entry.publicListingId === vehicle.id)?.id || `listing-history-${vehicle.id}`,
    publicListingId: vehicle.id,
    displayReference,
    customerProfileId: existingRecord?.customerProfileId || "",
    customerNameSnapshot: vehicle.customerName || "",
    createdAt: existingRecord?.listingHistory.find((entry) => entry.publicListingId === vehicle.id)?.createdAt || vehicle.createdAt || now,
    publishedAt:
      listingStatus === "published" || listingStatus === "under_offer" || listingStatus === "warehouse_managed" || listingStatus === "sold"
        ? (existingRecord?.listingHistory.find((entry) => entry.publicListingId === vehicle.id)?.publishedAt || vehicle.approvedAt || vehicle.createdAt || now)
        : existingRecord?.listingHistory.find((entry) => entry.publicListingId === vehicle.id)?.publishedAt || "",
    withdrawnAt: listingStatus === "withdrawn" ? (vehicle.updatedAt || now) : existingRecord?.listingHistory.find((entry) => entry.publicListingId === vehicle.id)?.withdrawnAt || "",
    soldAt: listingStatus === "sold" ? (vehicle.soldAt || vehicle.updatedAt || now) : existingRecord?.listingHistory.find((entry) => entry.publicListingId === vehicle.id)?.soldAt || "",
    currentStatus: listingStatus,
    askingPriceHistory: priceHistory,
    statusTransitions
  };
  const listingHistory = [
    ...(existingRecord?.listingHistory.filter((entry) => entry.publicListingId !== vehicle.id) ?? []),
    listingHistoryEntry
  ].sort((left, right) => (right.createdAt || "").localeCompare(left.createdAt || ""));
  const estimatedTotalIncome = (existingRecord?.gstInclusiveServiceFeeTotal ?? 0) + parseCurrencyNumber(vehicle.price);

  await setDoc(ref, sanitizeFirestoreWriteData({
    ...createEmptyVehicleRecord(),
    ...(existingRecord ?? {}),
    publicListingId: vehicle.id,
    displayReference,
    title: existingRecord?.title || `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.variant}`.replace(/\s+/g, " ").trim(),
    make: vehicle.make || existingRecord?.make || "",
    model: vehicle.model || existingRecord?.model || "",
    variant: vehicle.variant || existingRecord?.variant || "",
    year: vehicle.year ? String(vehicle.year) : existingRecord?.year || "",
    registrationPlate: vehicle.rego || existingRecord?.registrationPlate || "",
    vin: vehicle.vin || existingRecord?.vin || "",
    colour: vehicle.colour || existingRecord?.colour || "",
    odometer: vehicle.mileage ? String(vehicle.mileage) : existingRecord?.odometer || "",
    registrationExpiry: vehicle.regoExpiry || existingRecord?.registrationExpiry || "",
    fuelType: vehicle.fuelType || existingRecord?.fuelType || "",
    transmission: vehicle.transmission || existingRecord?.transmission || "",
    askingPrice: String(vehicle.price || parseCurrencyNumber(existingRecord?.askingPrice)),
    status:
      listingStatus === "sold"
        ? "sold"
        : listingStatus === "withdrawn"
          ? "withdrawn"
          : listingStatus === "under_offer"
            ? "under_offer"
            : listingStatus === "warehouse_managed"
              ? "warehouse_managed"
              : "listed",
    listingHistory,
    estimatedTotalIncome,
    soldGrossTotal: listingStatus === "sold" ? parseCurrencyNumber(vehicle.price) : Number(existingRecord?.soldGrossTotal ?? 0),
    realisedRevenue:
      listingStatus === "sold"
        ? parseCurrencyNumber(vehicle.price) + Number(existingRecord?.gstInclusiveServiceFeeTotal ?? 0)
        : Number(existingRecord?.realisedRevenue ?? 0),
    lastEditedByUid: actor?.id || existingRecord?.lastEditedByUid || "",
    lastEditedByName: getActorDisplayName(actor) || existingRecord?.lastEditedByName || "",
    lastEditedAt: serverTimestamp(),
    ...(existingId ? {} : { createdAt: serverTimestamp() }),
    updatedAt: serverTimestamp()
  }), { merge: true });

  await writeAdminOperationalEvent({
    actor,
    recordType: "public_listing",
    actionType,
    affectedRecordId: vehicle.id,
    vehicleRecordId: ref.id,
    publicListingId: vehicle.id,
    summary: `${displayReference} synced to vehicle master record as ${listingStatus.replace(/_/g, " ")}.`
  }).catch(() => undefined);

  return ref.id;
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
  const accountType: AccountType =
    data.accountType === "dealer" || data.role === "dealer"
      ? "dealer"
      : "private";
  const managedAccess = resolveManagedUserAccess({
    email,
    storedRole: typeof data.role === "string" ? data.role : accountType === "dealer" ? "dealer" : "private",
    storedPermissions: data.adminPermissions && typeof data.adminPermissions === "object" ? (data.adminPermissions as Record<string, boolean>) : undefined
  });

  const dealerPlan = normalizeDealerPlan(data.dealerPlan ?? data.planType);
  const agreedToDealerTerms = Boolean(data.agreedToDealerTerms ?? data.agreedToTerms);
  const shopPublicVisible = typeof data.shopPublicVisible === "boolean"
    ? data.shopPublicVisible
    : typeof data.shopVisible === "boolean"
      ? data.shopVisible
      : undefined;

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
    accountType,
    adminPermissions: normalizeAdminPermissions(data.adminPermissions, managedAccess.role, email),
    complianceStatus:
      data.complianceStatus === "possible_unlicensed_trader" || data.complianceStatus === "verified_dealer"
        ? data.complianceStatus
        : "clear",
    complianceFlaggedAt: serializeDate(data.complianceFlaggedAt),
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
    dealerApplicationId: typeof data.dealerApplicationId === "string" ? data.dealerApplicationId : undefined,
    agreedToDealerTerms,
    agreedToTerms: agreedToDealerTerms,
    agreedAt: serializeDate(data.agreedAt),
    dealerPlan,
    planType: dealerPlan,
    maxListings: typeof data.maxListings === "number" ? data.maxListings : undefined,
    shopPublicVisible,
    shopVisible: shopPublicVisible,
    brandingEnabled: typeof data.brandingEnabled === "boolean" ? data.brandingEnabled : undefined,
    contactDisplayEnabled: typeof data.contactDisplayEnabled === "boolean" ? data.contactDisplayEnabled : undefined,
    listingRestricted: Boolean(data.listingRestricted),
    createdAt: serializeDate(data.createdAt)
  };
}

function serializeVehicleDoc(id: string, data: Record<string, unknown>): Vehicle {
  const legacyImages = Array.isArray(data.images) ? (data.images as string[]) : [];
  const imageUrls = Array.isArray(data.imageUrls) ? (data.imageUrls as string[]) : legacyImages;
  const imageAssets = Array.isArray(data.imageAssets)
    ? (data.imageAssets as Array<Record<string, unknown>>)
        .map((item) => ({
          thumbnailUrl: typeof item.thumbnailUrl === "string" ? item.thumbnailUrl : "",
          fullUrl: typeof item.fullUrl === "string" ? item.fullUrl : ""
        }))
        .filter((item): item is VehicleImageAsset => Boolean(item.thumbnailUrl) && Boolean(item.fullUrl))
    : [];
  const coverImage =
    typeof data.coverImage === "string" && data.coverImage
      ? (data.coverImage as string)
      : imageAssets[0]?.thumbnailUrl
        ? imageAssets[0].thumbnailUrl
      : typeof data.coverImageUrl === "string" && data.coverImageUrl
        ? (data.coverImageUrl as string)
        : imageUrls[0];
  const coverImageUrl =
    typeof data.coverImageUrl === "string" && data.coverImageUrl
      ? (data.coverImageUrl as string)
      : imageAssets[0]?.fullUrl || coverImage;
  const normalizedVehicleStatus = normalizeVehicleStatus(data.status);
  const normalizedSellerStatus = normalizeSellerVehicleStatus(data.sellerStatus, data.status);
  const isManagedByCarnest =
    data.isManagedByCarnest === true
    || data.managedBy === "carnest"
    || data.sellerType === "warehouse"
    || data.source === "admin"
    || data.ownerRole === "admin"
    || data.listingType === "warehouse";

  return {
    id,
    ...data,
    status: normalizedVehicleStatus,
    sellerStatus: normalizedSellerStatus,
    isManagedByCarnest,
    approvedAt: serializeDate(data.approvedAt),
    deleted: Boolean(data.deleted),
    deletedAt: serializeDate(data.deletedAt),
    deletedBy: typeof data.deletedBy === "string" ? data.deletedBy : "",
    deleteReason: typeof data.deleteReason === "string" ? data.deleteReason : "",
    regoExpiry: typeof data.regoExpiry === "string" ? data.regoExpiry : "",
    sellerLocationPostcode: typeof data.sellerLocationPostcode === "string" ? data.sellerLocationPostcode : "",
    customerEmail: typeof data.customerEmail === "string" ? data.customerEmail : "",
    customerName:
      typeof data.customerName === "string"
        ? data.customerName
        : data.customerName === null
          ? null
          : "",
    manualReviewReason: data.manualReviewReason === "possible_unlicensed_trader" ? "possible_unlicensed_trader" : undefined,
    viewCount: Number(data.viewCount ?? 0),
    uniqueViewCount: Number(data.uniqueViewCount ?? 0),
    lastViewedAt: serializeDate(data.lastViewedAt),
    coverImage,
    coverImageUrl,
    imageAssets,
    imageUrls,
    images: imageUrls,
    soldAt: serializeDate(data.soldAt),
    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt)
  } as Vehicle;
}

const WAREHOUSE_DECLARATION_DEFAULT = "unknown" as const;
const WAREHOUSE_CONDITION_DEFAULT = "not_checked" as const;
const WAREHOUSE_EXTERIOR_KEYS = [
  "frontExterior",
  "rearExterior",
  "leftSide",
  "rightSide",
  "wheels",
  "visibleDefects"
] as const;
const WAREHOUSE_INTERIOR_KEYS = [
  "interiorGeneral",
  "seatsTrimMarks",
  "dashboardConsole",
  "odometerPhoto"
] as const;
const WAREHOUSE_MECHANICAL_KEYS = [
  "vinPhoto",
  "storageTransportNotes",
  "inspectionReadinessNotes"
] as const;

function normalizeWarehouseDeclarationAnswer(value: unknown): WarehouseDeclarationAnswer {
  return value === "yes" || value === "no" || value === "unknown" ? value : WAREHOUSE_DECLARATION_DEFAULT;
}

function normalizeWarehouseConditionStatus(value: unknown): WarehouseConditionItem["condition"] {
  return value === "documented"
    || value === "not_checked"
    ? value
    : WAREHOUSE_CONDITION_DEFAULT;
}

function normalizeWarehousePreferredContactMethod(value: unknown): WarehouseIntakeOwnerDetails["preferredContactMethod"] {
  return value === "phone"
    || value === "email"
    || value === "sms"
    || value === "whatsapp"
    || value === "wechat"
    || value === "either"
    || value === "other"
    ? value
    : "either";
}

function normalizeWarehouseIdentificationDocumentType(value: unknown): WarehouseIntakeOwnerDetails["identificationDocumentType"] {
  return value === "driver_licence"
    || value === "passport"
    || value === "other"
    ? value
    : "";
}

function serializeWarehouseFileRecord(value: unknown): WarehouseIntakeFileRecord | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const storagePath = extractFirebaseStoragePath(
    typeof input.storagePath === "string"
      ? input.storagePath
      : typeof input.url === "string"
        ? input.url
        : ""
  );
  if (!storagePath) return null;

  return {
    storagePath,
    name: typeof input.name === "string" ? input.name : "Uploaded file",
    uploadedAt: serializeDate(input.uploadedAt),
    contentType: typeof input.contentType === "string" ? input.contentType : ""
  };
}

function createEmptyWarehouseConditionSection(keys: readonly string[]) {
  return Object.fromEntries(
    keys.map((key) => [
      key,
      {
        condition: WAREHOUSE_CONDITION_DEFAULT,
        documented: false,
        notes: ""
      } satisfies WarehouseConditionItem
    ])
  );
}

function serializeWarehouseConditionSection(value: unknown, keys: readonly string[]) {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return Object.fromEntries(
    keys.map((key) => {
      const item = source[key];
      const input = item && typeof item === "object" ? (item as Record<string, unknown>) : {};

      return [
        key,
        {
          condition: normalizeWarehouseConditionStatus(input.condition),
          documented: input.documented === true || normalizeWarehouseConditionStatus(input.condition) === "documented",
          notes: typeof input.notes === "string" ? input.notes : ""
        } satisfies WarehouseConditionItem
      ];
    })
  );
}

function createEmptyWarehouseOwnerDetails(): WarehouseIntakeOwnerDetails {
  return {
    fullName: "",
    email: "",
    phone: "",
    address: "",
    dateOfBirth: "",
    preferredContactMethod: "either",
    customerVerificationNotes: "",
    identificationDocumentType: "",
    identificationDocumentNumber: "",
    companyOwned: false,
    companyName: "",
    abn: "",
    acn: "",
    identificationDocument: null,
    isLegalOwnerConfirmed: false
  };
}

function createEmptyWarehouseVehicleDetails(): WarehouseIntakeVehicleDetails {
  return {
    make: "",
    model: "",
    variant: "",
    year: "",
    registrationPlate: "",
    vin: "",
    colour: "",
    odometer: "",
    registrationExpiry: "",
    numberOfKeys: "",
    fuelType: "",
    transmission: "",
    askingPrice: "",
    reservePrice: "",
    serviceHistory: "",
    accidentHistory: "",
    ownershipProof: null,
    notes: ""
  };
}

export function createEmptyWarehouseServiceFeeItem(overrides?: Partial<WarehouseServiceFeeItem>): WarehouseServiceFeeItem {
  return {
    id: overrides?.id || `service-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    serviceName: overrides?.serviceName || "",
    category: overrides?.category || "sundry",
    amount: typeof overrides?.amount === "number" ? overrides.amount : 0,
    gstIncluded: overrides?.gstIncluded ?? true,
    customerVisible: overrides?.customerVisible ?? true,
    internalNote: overrides?.internalNote || ""
  };
}

function createEmptyWarehouseDeclarations(): WarehouseIntakeDeclarations {
  return {
    writtenOffHistory: WAREHOUSE_DECLARATION_DEFAULT,
    repairableWriteOffHistory: WAREHOUSE_DECLARATION_DEFAULT,
    stolenRecoveredHistory: WAREHOUSE_DECLARATION_DEFAULT,
    hailDamageHistory: WAREHOUSE_DECLARATION_DEFAULT,
    floodDamageHistory: WAREHOUSE_DECLARATION_DEFAULT,
    engineReplacementHistory: WAREHOUSE_DECLARATION_DEFAULT,
    odometerDiscrepancyKnown: WAREHOUSE_DECLARATION_DEFAULT,
    financeOwing: WAREHOUSE_DECLARATION_DEFAULT,
    financeCompanyName: "",
    isInformationAccurate: false
  };
}

function createEmptyWarehouseConditionReport(): WarehouseIntakeConditionReport {
  return {
    exterior: createEmptyWarehouseConditionSection(WAREHOUSE_EXTERIOR_KEYS),
    interior: createEmptyWarehouseConditionSection(WAREHOUSE_INTERIOR_KEYS),
    mechanical: createEmptyWarehouseConditionSection(WAREHOUSE_MECHANICAL_KEYS)
  };
}

function createEmptyWarehouseAgreement(): WarehouseIntakeAgreement {
  return {
    informationAccurateConfirmed: false,
    storageAssistanceAuthorized: false,
    electronicSigningConsented: false,
    insuranceMaintainedConfirmed: false,
    directSaleResponsibilityConfirmed: false,
    conditionDocumentationConfirmed: false,
    reviewedAt: ""
  };
}

function createEmptyWarehouseSignature(): WarehouseIntakeSignature {
  return {
    signerName: "",
    adminStaffName: ""
  };
}

function createEmptyVehicleListingHistoryEntry(): VehicleListingHistoryEntry {
  return {
    id: "",
    publicListingId: "",
    displayReference: "",
    customerProfileId: "",
    customerNameSnapshot: "",
    createdAt: "",
    publishedAt: "",
    withdrawnAt: "",
    soldAt: "",
    currentStatus: "draft",
    askingPriceHistory: [],
    statusTransitions: []
  };
}

export function createEmptyCustomerProfile(): Omit<CustomerProfile, "id"> {
  return {
    fullName: "",
    email: "",
    normalizedEmail: "",
    phone: "",
    normalizedPhone: "",
    address: "",
    dateOfBirth: "",
    preferredContactMethod: "either",
    customerVerificationNotes: "",
    identificationDocumentType: "",
    identificationDocumentNumber: "",
    companyOwned: false,
    companyName: "",
    abn: "",
    acn: "",
    identificationDocument: null,
    isLegalOwnerConfirmed: false,
    declarations: createEmptyWarehouseDeclarations(),
    agreement: createEmptyWarehouseAgreement(),
    signature: createEmptyWarehouseSignature(),
    latestIntakeId: "",
    latestVehicleRecordId: "",
    linkedVehicleRecordIds: [],
    linkedListingIds: [],
    status: "active",
    lastEditedByUid: "",
    lastEditedByName: "",
    lastEditedAt: "",
    createdByUid: "",
    createdAt: "",
    updatedAt: ""
  };
}

export function createEmptyVehicleRecord(): Omit<VehicleRecord, "id"> {
  return {
    customerProfileId: "",
    publicListingId: "",
    displayReference: "",
    title: "",
    make: "",
    model: "",
    variant: "",
    year: "",
    registrationPlate: "",
    vin: "",
    colour: "",
    odometer: "",
    registrationExpiry: "",
    numberOfKeys: "",
    fuelType: "",
    transmission: "",
    askingPrice: "",
    reservePrice: "",
    serviceHistory: "",
    accidentHistory: "",
    ownershipProof: null,
    declarations: createEmptyWarehouseDeclarations(),
    notes: "",
    linkedIntakeIds: [],
    latestIntakeId: "",
    status: "draft",
    listingHistory: [],
    realisedRevenue: 0,
    outstandingIntakeCosts: 0,
    storageRevenue: 0,
    soldGrossTotal: 0,
    serviceFeeSubtotal: 0,
    gstInclusiveServiceFeeTotal: 0,
    estimatedTotalIncome: 0,
    intakeEventCount: 0,
    lastEditedByUid: "",
    lastEditedByName: "",
    lastEditedAt: "",
    activeIntakeEditorUid: "",
    activeIntakeEditorName: "",
    activeIntakeEditedAt: "",
    lastCalculatedAt: "",
    createdByUid: "",
    createdAt: "",
    updatedAt: ""
  };
}

export function createEmptyWarehouseIntakeRecord(vehicle?: Vehicle | null): Omit<WarehouseIntakeRecord, "id"> {
  const vehicleTitle = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim() : "";

  return {
    customerProfileId: "",
    vehicleRecordId: "",
    vehicleId: vehicle?.id,
    vehicleReference: vehicle ? getVehicleDisplayReference(vehicle) : "",
    vehicleTitle,
    status: "draft",
    ownerDetails: {
      ...createEmptyWarehouseOwnerDetails(),
      fullName: vehicle?.customerName ?? "",
      email: vehicle?.customerEmail ?? ""
    },
    vehicleDetails: {
      ...createEmptyWarehouseVehicleDetails(),
      make: vehicle?.make ?? "",
      model: vehicle?.model ?? "",
      variant: vehicle?.variant ?? "",
      year: vehicle?.year ? String(vehicle.year) : "",
      registrationPlate: vehicle?.rego ?? "",
      vin: vehicle?.vin ?? "",
      colour: vehicle?.colour ?? "",
      odometer: vehicle?.mileage ? String(vehicle.mileage) : "",
      registrationExpiry: vehicle?.regoExpiry ?? "",
      numberOfKeys: vehicle?.keyCount ?? "",
      serviceHistory: vehicle?.serviceHistory ?? ""
    },
    declarations: createEmptyWarehouseDeclarations(),
    conditionReport: createEmptyWarehouseConditionReport(),
    photos: [],
    serviceItems: [],
    intakeDate: "",
    assignedStaffUid: "",
    assignedStaffName: "",
    intakeNotes: "",
    projectedRevenueSnapshot: 0,
    storageStartDate: "",
    storageEndDate: "",
    storageDurationDays: 0,
    serviceFeeSubtotal: 0,
    gstInclusiveServiceFeeTotal: 0,
    gstAmount: 0,
    agreement: createEmptyWarehouseAgreement(),
    signature: createEmptyWarehouseSignature(),
    signedPdfStoragePath: "",
    signedPdfFileName: "",
    pdfGeneratedAt: "",
    completedAt: "",
    emailSentAt: "",
    photoCount: 0,
    adminStaffName: "",
    lastEditedByUid: "",
    lastEditedByName: "",
    lastEditedAt: "",
    activeEditorUid: "",
    activeEditorName: "",
    activeEditorAt: "",
    createdByUid: "",
    createdAt: "",
    updatedAt: ""
  };
}

function serializeWarehouseIntakeDoc(id: string, data: Record<string, unknown>): WarehouseIntakeRecord {
  const ownerInput = data.ownerDetails && typeof data.ownerDetails === "object" ? (data.ownerDetails as Record<string, unknown>) : {};
  const vehicleInput = data.vehicleDetails && typeof data.vehicleDetails === "object" ? (data.vehicleDetails as Record<string, unknown>) : {};
  const declarationInput = data.declarations && typeof data.declarations === "object" ? (data.declarations as Record<string, unknown>) : {};
  const agreementInput = data.agreement && typeof data.agreement === "object" ? (data.agreement as Record<string, unknown>) : {};
  const signatureInput = data.signature && typeof data.signature === "object" ? (data.signature as Record<string, unknown>) : {};
  const conditionInput = data.conditionReport && typeof data.conditionReport === "object" ? (data.conditionReport as Record<string, unknown>) : {};
  const photos = Array.isArray(data.photos)
    ? (data.photos as Array<Record<string, unknown>>)
        .map((item, index) => ({
          id: typeof item.id === "string" && item.id ? item.id : `${id}-photo-${index + 1}`,
          category: typeof item.category === "string" ? item.category : "extraPhotos",
          label: typeof item.label === "string" && item.label ? item.label : "Vehicle photo",
          storagePath: extractFirebaseStoragePath(
            typeof item.storagePath === "string"
              ? item.storagePath
              : typeof item.url === "string"
                ? item.url
                : ""
          ),
          name: typeof item.name === "string" ? item.name : "",
          uploadedAt: serializeDate(item.uploadedAt),
          contentType: typeof item.contentType === "string" ? item.contentType : ""
        }))
        .filter((item) => item.storagePath)
    : [];
  const serviceItems = Array.isArray(data.serviceItems)
    ? (data.serviceItems as Array<Record<string, unknown>>)
        .map((item, index) => createEmptyWarehouseServiceFeeItem({
          id: typeof item.id === "string" && item.id ? item.id : `${id}-service-${index + 1}`,
          serviceName: typeof item.serviceName === "string" ? item.serviceName : "",
          category: typeof item.category === "string" ? item.category as WarehouseServiceFeeItem["category"] : "sundry",
          amount: Number(item.amount ?? 0),
          gstIncluded: item.gstIncluded !== false,
          customerVisible: item.customerVisible !== false,
          internalNote: typeof item.internalNote === "string" ? item.internalNote : ""
        }))
    : [];
  const computedServiceFeeSubtotal = serviceItems.reduce((sum, item) => sum + item.amount, 0);
  const computedGstInclusiveServiceFeeTotal = serviceItems.reduce(
    (sum, item) => sum + (item.gstIncluded ? item.amount : item.amount * 1.1),
    0
  );
  const storageStartDate = serializeDate(data.storageStartDate);
  const storageEndDate = serializeDate(data.storageEndDate);
  const intakeDate = serializeDate(data.intakeDate) || serializeDate(data.createdAt);
  const storageDurationDays = Number(
    data.storageDurationDays
      ?? (storageStartDate && storageEndDate
        ? Math.max(
            Math.round((new Date(storageEndDate).getTime() - new Date(storageStartDate).getTime()) / (1000 * 60 * 60 * 24)),
            0
          )
        : 0)
  );

  return {
    id,
    customerProfileId: typeof data.customerProfileId === "string" ? data.customerProfileId : "",
    vehicleRecordId: typeof data.vehicleRecordId === "string" ? data.vehicleRecordId : "",
    vehicleId: typeof data.vehicleId === "string" ? data.vehicleId : "",
    vehicleReference: typeof data.vehicleReference === "string" ? data.vehicleReference : "",
    vehicleTitle: typeof data.vehicleTitle === "string" ? data.vehicleTitle : "",
    status: data.status === "review_ready" || data.status === "signed" ? data.status : "draft",
    ownerDetails: {
      fullName: typeof ownerInput.fullName === "string" ? ownerInput.fullName : "",
      email: typeof ownerInput.email === "string" ? ownerInput.email : "",
      phone: typeof ownerInput.phone === "string" ? ownerInput.phone : "",
      address: typeof ownerInput.address === "string" ? ownerInput.address : "",
      dateOfBirth: typeof ownerInput.dateOfBirth === "string" ? ownerInput.dateOfBirth : "",
      preferredContactMethod: normalizeWarehousePreferredContactMethod(ownerInput.preferredContactMethod),
      customerVerificationNotes: typeof ownerInput.customerVerificationNotes === "string" ? ownerInput.customerVerificationNotes : "",
      identificationDocumentType: normalizeWarehouseIdentificationDocumentType(ownerInput.identificationDocumentType),
      identificationDocumentNumber: typeof ownerInput.identificationDocumentNumber === "string" ? ownerInput.identificationDocumentNumber : "",
      companyOwned: ownerInput.companyOwned === true,
      companyName: typeof ownerInput.companyName === "string" ? ownerInput.companyName : "",
      abn: typeof ownerInput.abn === "string" ? ownerInput.abn : "",
      acn: typeof ownerInput.acn === "string" ? ownerInput.acn : "",
      identificationDocument: serializeWarehouseFileRecord(
        ownerInput.identificationDocument ?? ownerInput.licencePhoto
      ),
      isLegalOwnerConfirmed: ownerInput.isLegalOwnerConfirmed === true
    },
    vehicleDetails: {
      make: typeof vehicleInput.make === "string" ? vehicleInput.make : "",
      model: typeof vehicleInput.model === "string" ? vehicleInput.model : "",
      variant: typeof vehicleInput.variant === "string" ? vehicleInput.variant : "",
      year: typeof vehicleInput.year === "string" ? vehicleInput.year : "",
      registrationPlate: typeof vehicleInput.registrationPlate === "string" ? vehicleInput.registrationPlate : "",
      vin: typeof vehicleInput.vin === "string" ? vehicleInput.vin : "",
      colour: typeof vehicleInput.colour === "string" ? vehicleInput.colour : "",
      odometer: typeof vehicleInput.odometer === "string" ? vehicleInput.odometer : "",
      registrationExpiry: typeof vehicleInput.registrationExpiry === "string" ? vehicleInput.registrationExpiry : "",
      numberOfKeys: typeof vehicleInput.numberOfKeys === "string" ? vehicleInput.numberOfKeys : "",
      fuelType: typeof vehicleInput.fuelType === "string" ? vehicleInput.fuelType : "",
      transmission: typeof vehicleInput.transmission === "string" ? vehicleInput.transmission : "",
      askingPrice: typeof vehicleInput.askingPrice === "string" ? vehicleInput.askingPrice : "",
      reservePrice: typeof vehicleInput.reservePrice === "string" ? vehicleInput.reservePrice : "",
      serviceHistory: typeof vehicleInput.serviceHistory === "string" ? vehicleInput.serviceHistory : "",
      accidentHistory: typeof vehicleInput.accidentHistory === "string" ? vehicleInput.accidentHistory : "",
      ownershipProof: serializeWarehouseFileRecord(
        vehicleInput.ownershipProof ?? ownerInput.ownershipVerification
      ),
      notes: typeof vehicleInput.notes === "string" ? vehicleInput.notes : ""
    },
    declarations: {
      writtenOffHistory: normalizeWarehouseDeclarationAnswer(declarationInput.writtenOffHistory),
      repairableWriteOffHistory: normalizeWarehouseDeclarationAnswer(declarationInput.repairableWriteOffHistory),
      stolenRecoveredHistory: normalizeWarehouseDeclarationAnswer(declarationInput.stolenRecoveredHistory),
      hailDamageHistory: normalizeWarehouseDeclarationAnswer(declarationInput.hailDamageHistory),
      floodDamageHistory: normalizeWarehouseDeclarationAnswer(declarationInput.floodDamageHistory),
      engineReplacementHistory: normalizeWarehouseDeclarationAnswer(declarationInput.engineReplacementHistory),
      odometerDiscrepancyKnown: normalizeWarehouseDeclarationAnswer(declarationInput.odometerDiscrepancyKnown),
      financeOwing: normalizeWarehouseDeclarationAnswer(declarationInput.financeOwing),
      financeCompanyName: typeof declarationInput.financeCompanyName === "string" ? declarationInput.financeCompanyName : "",
      isInformationAccurate: declarationInput.isInformationAccurate === true
    },
    conditionReport: {
      exterior: serializeWarehouseConditionSection(conditionInput.exterior, WAREHOUSE_EXTERIOR_KEYS),
      interior: serializeWarehouseConditionSection(conditionInput.interior, WAREHOUSE_INTERIOR_KEYS),
      mechanical: serializeWarehouseConditionSection(conditionInput.mechanical, WAREHOUSE_MECHANICAL_KEYS)
    },
    photos,
    serviceItems,
    intakeDate,
    assignedStaffUid: typeof data.assignedStaffUid === "string" ? data.assignedStaffUid : "",
    assignedStaffName: typeof data.assignedStaffName === "string" ? data.assignedStaffName : "",
    intakeNotes: typeof data.intakeNotes === "string" ? data.intakeNotes : "",
    projectedRevenueSnapshot: Number(
      data.projectedRevenueSnapshot
      ?? (Math.max(parseCurrencyNumber(vehicleInput.askingPrice), parseCurrencyNumber(vehicleInput.reservePrice)) + computedGstInclusiveServiceFeeTotal)
    ),
    storageStartDate,
    storageEndDate,
    storageDurationDays,
    serviceFeeSubtotal: Number(data.serviceFeeSubtotal ?? computedServiceFeeSubtotal),
    gstInclusiveServiceFeeTotal: Number(data.gstInclusiveServiceFeeTotal ?? computedGstInclusiveServiceFeeTotal),
    gstAmount: Number(data.gstAmount ?? Math.max(computedGstInclusiveServiceFeeTotal - computedServiceFeeSubtotal, 0)),
    agreement: {
      informationAccurateConfirmed: agreementInput.informationAccurateConfirmed === true,
      storageAssistanceAuthorized: agreementInput.storageAssistanceAuthorized === true,
      electronicSigningConsented: agreementInput.electronicSigningConsented === true,
      insuranceMaintainedConfirmed: agreementInput.insuranceMaintainedConfirmed === true,
      directSaleResponsibilityConfirmed: agreementInput.directSaleResponsibilityConfirmed === true,
      conditionDocumentationConfirmed: agreementInput.conditionDocumentationConfirmed === true,
      reviewedAt: serializeDate(agreementInput.reviewedAt)
    },
    signature: {
      signerName: typeof signatureInput.signerName === "string" ? signatureInput.signerName : "",
      adminStaffName: typeof signatureInput.adminStaffName === "string" ? signatureInput.adminStaffName : "",
      signedAt: serializeDate(signatureInput.signedAt),
      signatureStoragePath: extractFirebaseStoragePath(
        typeof signatureInput.signatureStoragePath === "string"
          ? signatureInput.signatureStoragePath
          : typeof signatureInput.signatureImageUrl === "string"
            ? signatureInput.signatureImageUrl
            : ""
      )
    },
    signedPdfStoragePath: extractFirebaseStoragePath(
      typeof data.signedPdfStoragePath === "string"
        ? data.signedPdfStoragePath
        : typeof data.signedPdfUrl === "string"
          ? data.signedPdfUrl
          : ""
    ),
    signedPdfFileName: typeof data.signedPdfFileName === "string" ? data.signedPdfFileName : "",
    pdfGeneratedAt: serializeDate(data.pdfGeneratedAt),
    completedAt: serializeDate(data.completedAt),
    emailSentAt: serializeDate(data.emailSentAt),
    photoCount: Number(data.photoCount ?? photos.length),
    adminStaffName: typeof data.adminStaffName === "string" ? data.adminStaffName : "",
    lastEditedByUid: typeof data.lastEditedByUid === "string" ? data.lastEditedByUid : "",
    lastEditedByName: typeof data.lastEditedByName === "string" ? data.lastEditedByName : "",
    lastEditedAt: serializeDate(data.lastEditedAt),
    activeEditorUid: typeof data.activeEditorUid === "string" ? data.activeEditorUid : "",
    activeEditorName: typeof data.activeEditorName === "string" ? data.activeEditorName : "",
    activeEditorAt: serializeDate(data.activeEditorAt),
    createdByUid: typeof data.createdByUid === "string" ? data.createdByUid : "",
    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt)
  };
}

function normalizeVehicleListingHistoryStatus(value: unknown): VehicleListingHistoryStatus {
  return value === "published"
    || value === "under_offer"
    || value === "withdrawn"
    || value === "sold"
    || value === "warehouse_managed"
    ? value
    : "draft";
}

function serializeVehicleListingPriceHistory(items: unknown): VehicleListingPriceHistoryEntry[] {
  return Array.isArray(items)
    ? items
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map((item) => ({
          amount: Number(item.amount ?? 0),
          capturedAt: serializeDate(item.capturedAt)
        }))
        .filter((item) => Number.isFinite(item.amount))
    : [];
}

function serializeVehicleListingStatusTimeline(items: unknown): VehicleListingStatusTimelineEntry[] {
  return Array.isArray(items)
    ? items
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map((item) => ({
          status: normalizeVehicleListingHistoryStatus(item.status),
          changedAt: serializeDate(item.changedAt),
          changedByUid: typeof item.changedByUid === "string" ? item.changedByUid : "",
          changedByName: typeof item.changedByName === "string" ? item.changedByName : ""
        }))
    : [];
}

function serializeVehicleListingHistory(items: unknown): VehicleListingHistoryEntry[] {
  return Array.isArray(items)
    ? items
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map((item, index) => {
          const base = createEmptyVehicleListingHistoryEntry();
          return {
            ...base,
            id: typeof item.id === "string" && item.id ? item.id : `listing-history-${index + 1}`,
            publicListingId: typeof item.publicListingId === "string" ? item.publicListingId : "",
            displayReference: typeof item.displayReference === "string" ? item.displayReference : "",
            customerProfileId: typeof item.customerProfileId === "string" ? item.customerProfileId : "",
            customerNameSnapshot: typeof item.customerNameSnapshot === "string" ? item.customerNameSnapshot : "",
            createdAt: serializeDate(item.createdAt),
            publishedAt: serializeDate(item.publishedAt),
            withdrawnAt: serializeDate(item.withdrawnAt),
            soldAt: serializeDate(item.soldAt),
            currentStatus: normalizeVehicleListingHistoryStatus(item.currentStatus),
            askingPriceHistory: serializeVehicleListingPriceHistory(item.askingPriceHistory),
            statusTransitions: serializeVehicleListingStatusTimeline(item.statusTransitions)
          };
        })
    : [];
}

function serializeCustomerProfileDoc(id: string, data: Record<string, unknown>): CustomerProfile {
  const base = createEmptyCustomerProfile();

  return {
    id,
    fullName: typeof data.fullName === "string" ? data.fullName : "",
    email: typeof data.email === "string" ? data.email : "",
    normalizedEmail: typeof data.normalizedEmail === "string" ? data.normalizedEmail : "",
    phone: typeof data.phone === "string" ? data.phone : "",
    normalizedPhone: typeof data.normalizedPhone === "string" ? data.normalizedPhone : "",
    address: typeof data.address === "string" ? data.address : "",
    dateOfBirth: typeof data.dateOfBirth === "string" ? data.dateOfBirth : "",
    preferredContactMethod: normalizeWarehousePreferredContactMethod(data.preferredContactMethod),
    customerVerificationNotes: typeof data.customerVerificationNotes === "string" ? data.customerVerificationNotes : "",
    identificationDocumentType: normalizeWarehouseIdentificationDocumentType(data.identificationDocumentType),
    identificationDocumentNumber: typeof data.identificationDocumentNumber === "string" ? data.identificationDocumentNumber : "",
    companyOwned: data.companyOwned === true,
    companyName: typeof data.companyName === "string" ? data.companyName : "",
    abn: typeof data.abn === "string" ? data.abn : "",
    acn: typeof data.acn === "string" ? data.acn : "",
    identificationDocument: serializeWarehouseFileRecord(data.identificationDocument ?? data.licencePhoto),
    isLegalOwnerConfirmed: data.isLegalOwnerConfirmed === true,
    declarations: {
      ...base.declarations,
      ...(serializeWarehouseIntakeDoc(id, { declarations: data.declarations }).declarations)
    },
    agreement: {
      ...base.agreement,
      ...(serializeWarehouseIntakeDoc(id, { agreement: data.agreement }).agreement)
    },
    signature: {
      ...base.signature,
      ...(serializeWarehouseIntakeDoc(id, { signature: data.signature }).signature)
    },
    latestIntakeId: typeof data.latestIntakeId === "string" ? data.latestIntakeId : "",
    latestVehicleRecordId: typeof data.latestVehicleRecordId === "string" ? data.latestVehicleRecordId : "",
    linkedVehicleRecordIds: Array.isArray(data.linkedVehicleRecordIds)
      ? (data.linkedVehicleRecordIds as unknown[]).filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [],
    linkedListingIds: Array.isArray(data.linkedListingIds)
      ? (data.linkedListingIds as unknown[]).filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [],
    status: data.status === "archived" ? "archived" : "active",
    lastEditedByUid: typeof data.lastEditedByUid === "string" ? data.lastEditedByUid : "",
    lastEditedByName: typeof data.lastEditedByName === "string" ? data.lastEditedByName : "",
    lastEditedAt: serializeDate(data.lastEditedAt),
    createdByUid: typeof data.createdByUid === "string" ? data.createdByUid : "",
    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt)
  };
}

function serializeVehicleRecordDoc(id: string, data: Record<string, unknown>): VehicleRecord {
  return {
    id,
    customerProfileId: typeof data.customerProfileId === "string" ? data.customerProfileId : "",
    publicListingId: typeof data.publicListingId === "string" ? data.publicListingId : "",
    displayReference: typeof data.displayReference === "string" ? data.displayReference : "",
    title: typeof data.title === "string" ? data.title : "",
    make: typeof data.make === "string" ? data.make : "",
    model: typeof data.model === "string" ? data.model : "",
    variant: typeof data.variant === "string" ? data.variant : "",
    year: typeof data.year === "string" ? data.year : "",
    registrationPlate: typeof data.registrationPlate === "string" ? data.registrationPlate : "",
    vin: typeof data.vin === "string" ? data.vin : "",
    colour: typeof data.colour === "string" ? data.colour : "",
    odometer: typeof data.odometer === "string" ? data.odometer : "",
    registrationExpiry: typeof data.registrationExpiry === "string" ? data.registrationExpiry : "",
    numberOfKeys: typeof data.numberOfKeys === "string" ? data.numberOfKeys : "",
    fuelType: typeof data.fuelType === "string" ? data.fuelType : "",
    transmission: typeof data.transmission === "string" ? data.transmission : "",
    askingPrice: typeof data.askingPrice === "string" ? data.askingPrice : "",
    reservePrice: typeof data.reservePrice === "string" ? data.reservePrice : "",
    serviceHistory: typeof data.serviceHistory === "string" ? data.serviceHistory : "",
    accidentHistory: typeof data.accidentHistory === "string" ? data.accidentHistory : "",
    ownershipProof: serializeWarehouseFileRecord(data.ownershipProof),
    declarations: {
      ...createEmptyWarehouseDeclarations(),
      ...(serializeWarehouseIntakeDoc(id, { declarations: data.declarations }).declarations)
    },
    notes: typeof data.notes === "string" ? data.notes : "",
    linkedIntakeIds: Array.isArray(data.linkedIntakeIds)
      ? (data.linkedIntakeIds as unknown[]).filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [],
    latestIntakeId: typeof data.latestIntakeId === "string" ? data.latestIntakeId : "",
    status:
      data.status === "active"
      || data.status === "archived"
      || data.status === "warehouse_managed"
      || data.status === "private_seller_managed"
      || data.status === "listed"
      || data.status === "under_offer"
      || data.status === "sold"
      || data.status === "withdrawn"
        ? data.status
        : "draft",
    listingHistory: serializeVehicleListingHistory(data.listingHistory),
    realisedRevenue: Number(data.realisedRevenue ?? 0),
    outstandingIntakeCosts: Number(data.outstandingIntakeCosts ?? 0),
    storageRevenue: Number(data.storageRevenue ?? 0),
    soldGrossTotal: Number(data.soldGrossTotal ?? 0),
    serviceFeeSubtotal: Number(data.serviceFeeSubtotal ?? 0),
    gstInclusiveServiceFeeTotal: Number(data.gstInclusiveServiceFeeTotal ?? 0),
    estimatedTotalIncome: Number(data.estimatedTotalIncome ?? 0),
    intakeEventCount: Number(data.intakeEventCount ?? 0),
    lastEditedByUid: typeof data.lastEditedByUid === "string" ? data.lastEditedByUid : "",
    lastEditedByName: typeof data.lastEditedByName === "string" ? data.lastEditedByName : "",
    lastEditedAt: serializeDate(data.lastEditedAt),
    activeIntakeEditorUid: typeof data.activeIntakeEditorUid === "string" ? data.activeIntakeEditorUid : "",
    activeIntakeEditorName: typeof data.activeIntakeEditorName === "string" ? data.activeIntakeEditorName : "",
    activeIntakeEditedAt: serializeDate(data.activeIntakeEditedAt),
    lastCalculatedAt: serializeDate(data.lastCalculatedAt),
    createdByUid: typeof data.createdByUid === "string" ? data.createdByUid : "",
    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt)
  };
}

function serializeVehicleActivityEventDoc(id: string, data: Record<string, unknown>): VehicleActivityEvent {
  const type = typeof data.type === "string" ? data.type : "offer_created";
  const imageUrls = Array.isArray(data.imageUrls)
    ? (data.imageUrls as unknown[]).filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  return {
    id,
    vehicleId: typeof data.vehicleId === "string" ? data.vehicleId : "",
    type:
      type === "vehicle_submitted"
      || type === "approved"
      || type === "rejected"
      || type === "edited"
      || type === "marked_as_sold"
      || type === "undo_sold"
      || type === "deleted"
      || type === "restored"
      || type === "admin_note_added"
      || type === "warehouse_activity_added"
      ? type
      : "offer_created",
    message: typeof data.message === "string" ? data.message : "",
    imageUrls,
    createdBy:
      typeof data.createdBy === "string"
        ? data.createdBy
        : typeof data.actorUid === "string"
          ? data.actorUid
          : "CarNest",
    createdByUid: typeof data.createdByUid === "string" ? data.createdByUid : undefined,
    actorUid: typeof data.actorUid === "string" ? data.actorUid : undefined,
    createdAt: serializeDate(data.createdAt),
    visibility: data.visibility === "customer" || data.visibility === "seller" ? "customer" : "admin"
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

function normalizeDealerPlan(value: unknown) {
  if (value === "starter" || value === "growth" || value === "pro" || value === "tier1" || value === "tier2" || value === "tier3") {
    return value;
  }
  return "free" as const;
}

function generateDealerReferenceId(source?: unknown) {
  const serialized = serializeDate(source);
  const timestamp = serialized ? new Date(serialized).getTime() : Date.now();
  return `DN-${String(timestamp).slice(-4)}`;
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
  const dealerPlan = normalizeDealerPlan(data.dealerPlan ?? data.planType);
  const agreedToDealerTerms = typeof data.agreedToDealerTerms === "boolean"
    ? data.agreedToDealerTerms
    : typeof data.agreedToTerms === "boolean"
      ? data.agreedToTerms
      : undefined;
  const shopPublicVisible = typeof data.shopPublicVisible === "boolean"
    ? data.shopPublicVisible
    : typeof data.shopVisible === "boolean"
      ? data.shopVisible
      : false;
  const additionalUploads = Array.isArray(data.additionalUploads)
    ? data.additionalUploads
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
        .map((entry) => ({
          url: typeof entry.url === "string" ? entry.url : "",
          name: typeof entry.name === "string" ? entry.name : undefined,
          contentType: typeof entry.contentType === "string" ? entry.contentType : undefined
        }))
        .filter((entry) => Boolean(entry.url))
    : [];

  return {
    id,
    userId: typeof data.userId === "string" ? data.userId : "",
    referenceId: typeof data.referenceId === "string" ? data.referenceId : generateDealerReferenceId(data.requestedAt ?? data.createdAt),
    dealerStatus:
      data.dealerStatus === "approved"
      || data.dealerStatus === "rejected"
      || data.dealerStatus === "info_requested"
      || data.dealerStatus === "pending"
      || data.dealerStatus === "pending_review"
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
      data.status === "approved" || data.status === "rejected" || data.status === "info_requested" || data.status === "pending_review"
        ? data.status
        : "pending",
    requestedAt: serializeDate(data.requestedAt ?? data.createdAt),
    lastSubmittedAt: serializeDate(data.lastSubmittedAt),
    updatedAt: serializeDate(data.updatedAt),
    reviewedAt: serializeDate(data.reviewedAt),
    reviewedByUid: typeof data.reviewedByUid === "string" ? data.reviewedByUid : undefined,
    reviewedBy: typeof data.reviewedBy === "string" ? data.reviewedBy : undefined,
    agreedToDealerTerms,
    agreedToTerms: agreedToDealerTerms,
    agreedAt: serializeDate(data.agreedAt),
    dealerPlan,
    planType: dealerPlan,
    maxListings: typeof data.maxListings === "number" ? data.maxListings : 3,
    shopPublicVisible,
    shopVisible: shopPublicVisible,
    brandingEnabled: typeof data.brandingEnabled === "boolean" ? data.brandingEnabled : false,
    contactDisplayEnabled: typeof data.contactDisplayEnabled === "boolean" ? data.contactDisplayEnabled : false,
    adminNote: typeof data.adminNote === "string" ? data.adminNote : undefined,
    infoRequested: typeof data.infoRequested === "boolean" ? data.infoRequested : undefined,
    infoRequestedAt: serializeDate(data.infoRequestedAt),
    dealerResponseNote: typeof data.dealerResponseNote === "string" ? data.dealerResponseNote : undefined,
    additionalUploads,
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

function validateCustomerContactEmail(input: VehicleFormInput, actor: VehicleActor) {
  if (!isAdminLikeRole(actor.role) || input.listingType !== "warehouse") return;

  const customerEmails = parseCustomerEmailList(input.customerEmail ?? "");
  if (!customerEmails.length) {
    throw new Error("Customer contact email is required for warehouse-managed vehicles.");
  }
}

function parseCustomerEmailList(value: string) {
  return value
    .split(",")
    .map((item) => sanitizeSingleLineText(item).toLowerCase())
    .filter(Boolean);
}

function normalizeCustomerProfileEmail(value?: string) {
  return parseCustomerEmailList(value ?? "")[0] ?? "";
}

function normalizeCustomerProfilePhone(value?: string) {
  return sanitizeSingleLineText(value ?? "").replace(/\D/g, "");
}

function normalizeCustomerEmailList(value?: string) {
  const uniqueEmails = Array.from(new Set(parseCustomerEmailList(value ?? "")));
  if (!uniqueEmails.length) return "";

  for (const email of uniqueEmails) {
    if (!isValidEmailAddress(email)) {
      throw new Error("Please enter a valid customer contact email.");
    }
  }

  return uniqueEmails.join(", ");
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
  return status === "pending" || status === "pending_review" || status === "info_requested";
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
    visitorKeyHash: typeof data.visitorKeyHash === "string" ? data.visitorKeyHash : undefined,
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
  if (!isFirebaseConfigured) {
    return {
      vehicles: sampleVehicles.filter(
        (vehicle) =>
          !vehicle.deleted
          && vehicle.status === "approved"
          && (vehicle.sellerStatus === "ACTIVE" || vehicle.sellerStatus === "UNDER_OFFER")
      ),
      source: "mock" as const
    };
  }

  try {
    const snapshot = await getDocs(
      query(
        collection(db, "vehicles"),
        where("status", "==", "approved"),
        where("sellerStatus", "in", ["ACTIVE", "UNDER_OFFER"])
      )
    );

    const vehicles = snapshot.docs
      .map((item) => serializeVehicleDoc(item.id, item.data()))
      .filter(
        (vehicle) =>
          !vehicle.deleted
          && vehicle.status === "approved"
          && (vehicle.sellerStatus === "ACTIVE" || vehicle.sellerStatus === "UNDER_OFFER")
      )
      .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));

    return {
      vehicles,
      source: "firestore" as const
    };
  } catch (error) {
    return {
      vehicles: [] as Vehicle[],
      source: "firestore" as const,
      error: error instanceof Error ? error.message : "Unknown Firestore read error"
    };
  }
}

export async function listSoldVehicles() {
  const result = await getCollection<Vehicle>("vehicles", sampleVehicles, serializeVehicleDoc);
  return {
    vehicles: result.items.filter((vehicle) => vehicle.sellerStatus === "SOLD" && !vehicle.deleted),
    source: result.source,
    error: result.error
  };
}

export async function getPublicSoldVehicles() {
  if (!isFirebaseConfigured) {
    return {
      vehicles: [] as Vehicle[],
      source: "mock" as const
    };
  }

  try {
    const snapshot = await getDocs(
      query(
        collection(db, "vehicles"),
        where("status", "==", "approved"),
        where("sellerStatus", "==", "SOLD")
      )
    );

    const vehicles = snapshot.docs
      .map((item) => serializeVehicleDoc(item.id, item.data()))
      .filter((vehicle) => !vehicle.deleted && vehicle.status === "approved" && vehicle.sellerStatus === "SOLD")
      .sort((left, right) => (right.soldAt ?? right.updatedAt ?? right.createdAt ?? "").localeCompare(left.soldAt ?? left.updatedAt ?? left.createdAt ?? ""));

    return {
      vehicles,
      source: "firestore" as const
    };
  } catch (error) {
    return {
      vehicles: [] as Vehicle[],
      source: "firestore" as const,
      error: error instanceof Error ? error.message : "Unknown Firestore read error"
    };
  }
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

function normalizeSupportEmail(email?: string | null) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

async function findUserByExactEmail(email: string) {
  const normalizedEmail = normalizeSupportEmail(email);
  if (!normalizedEmail) return null;

  if (!isFirebaseConfigured) {
    return (await listUsers()).find((user) => normalizeSupportEmail(user.email) === normalizedEmail) ?? null;
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
  const email = normalizeSupportEmail(user.email);
  const baseMetrics = {
    totalListings: ownedVehicles.length,
    liveListings: ownedVehicles.filter((vehicle) => vehicle.status === "approved" && (vehicle.sellerStatus === "ACTIVE" || vehicle.sellerStatus === "UNDER_OFFER")).length,
    soldListings: ownedVehicles.filter((vehicle) => vehicle.sellerStatus === "SOLD").length,
    pendingListings: ownedVehicles.filter((vehicle) => vehicle.status === "pending").length
  } satisfies Pick<UserSupportAccountMetrics, "totalListings" | "liveListings" | "soldListings" | "pendingListings">;

  if (!isFirebaseConfigured) {
    const allOffers = (await getOffersData()).items;
    const allInspections = (await getInspectionRequestsData()).items;
    const allMessages = (await getContactMessagesData()).items;

    return {
      ...baseMetrics,
      totalOffers: allOffers.filter((offer) => offer.listingOwnerUid === user.id).length,
      totalEnquiries: allMessages.filter((message) => normalizeSupportEmail(message.email) === email).length,
      totalInspections: allInspections.filter((request) => request.sellerOwnerUid === user.id).length
    } satisfies UserSupportAccountMetrics;
  }

  try {
    const [offersSnapshot, enquiriesSnapshot, inspectionsSnapshot] = await Promise.all([
      getDocs(query(collection(db, "offers"), where("listingOwnerUid", "==", user.id))),
      email
        ? getDocs(query(collection(db, "contact_messages"), where("email", "==", email)))
        : Promise.resolve(null),
      getDocs(query(collection(db, "inspectionRequests"), where("sellerOwnerUid", "==", user.id)))
    ]);

    return {
      ...baseMetrics,
      totalOffers: offersSnapshot.size,
      totalEnquiries: enquiriesSnapshot?.size ?? 0,
      totalInspections: inspectionsSnapshot.size
    } satisfies UserSupportAccountMetrics;
  } catch {
    return {
      ...baseMetrics,
      totalOffers: 0,
      totalEnquiries: 0,
      totalInspections: 0
    } satisfies UserSupportAccountMetrics;
  }
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
      .filter((user) => normalizeSupportEmail(user.email).startsWith(normalizedQuery))
      .slice(0, userLimit)
      .map((user) => ({
        type: "user" as const,
        queryValue: user.email || user.id,
        email: user.email || "",
        name: user.displayName || user.name || user.email || "Unknown user",
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
      queryValue: user.email || user.id,
      email: user.email || "",
      name: user.displayName || user.name || user.email || "Unknown user",
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

function getVehicleActivityActorLabel(actor?: Pick<VehicleActor, "displayName" | "name" | "email" | "id">) {
  if (!actor) return "CarNest";
  return actor.displayName?.trim() || actor.name?.trim() || actor.email?.trim() || actor.id || "CarNest";
}

async function writeVehicleActivityEvent(
  vehicleId: string,
  type: VehicleActivityEvent["type"],
  message: string,
  actor?: Pick<VehicleActor, "id" | "displayName" | "name" | "email">,
  visibility: VehicleActivityEvent["visibility"] = "admin"
) {
  const payloadBase = {
    vehicleId,
    type,
    message: message.trim(),
    createdBy: getVehicleActivityActorLabel(actor),
    ...(actor?.id ? { createdByUid: actor.id, actorUid: actor.id } : {}),
    visibility
  };

  if (!payloadBase.message) {
    return null;
  }

  if (!isFirebaseConfigured) {
    return {
      id: `mock-vehicle-activity-${Date.now()}`,
      ...payloadBase,
      createdAt: new Date().toISOString()
    } satisfies VehicleActivityEvent;
  }

  const ref = await addDoc(collection(db, "vehicleActivityEvents"), {
    ...payloadBase,
    createdAt: serverTimestamp()
  });

  return {
    id: ref.id,
    ...payloadBase,
    createdAt: new Date().toISOString()
  } satisfies VehicleActivityEvent;
}

export async function getVehicleActivityLog(vehicleId: string) {
  if (!vehicleId) {
    return {
      items: [] as VehicleActivityEvent[],
      source: "mock" as const
    };
  }

  if (!isFirebaseConfigured) {
    return {
      items: [] as VehicleActivityEvent[],
      source: "mock" as const
    };
  }

  try {
    const snapshot = await getDocs(query(collection(db, "vehicleActivityEvents"), where("vehicleId", "==", vehicleId)));
    const items = snapshot.docs
      .map((item) => serializeVehicleActivityEventDoc(item.id, item.data()))
      .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));

    return {
      items,
      source: "firestore" as const
    };
  } catch (error) {
    return {
      items: [] as VehicleActivityEvent[],
      source: "firestore" as const,
      error: error instanceof Error ? error.message : "Unknown Firestore read error"
    };
  }
}

export async function addVehicleActivityNote(
  vehicleId: string,
  message: string,
  actor: VehicleActor,
  options?: {
    visibility?: VehicleActivityEvent["visibility"];
    type?: Extract<VehicleActivityEvent["type"], "admin_note_added" | "warehouse_activity_added">;
    sendEmail?: boolean;
    recipientEmail?: string;
    vehicleTitle?: string;
    referenceId?: string;
  }
) {
  assertAdminPermissionForActor(actor, "manageVehicles", "Only authorized admins can add manual vehicle activity notes.");

  const note = sanitizeMultilineText(message);
  if (!note) {
    throw new Error("Enter a note before saving to the vehicle activity log.");
  }

  const normalizedRecipientEmail = options?.recipientEmail ? normalizeCustomerEmailList(options.recipientEmail) : "";

  const event = await writeVehicleActivityEvent(
    vehicleId,
    options?.type ?? "admin_note_added",
    note,
    actor,
    options?.visibility ?? "admin"
  );

  let emailStatus:
    | { attempted: false; sent: false; reason?: "not_requested" | "no_email" }
    | { attempted: true; sent: true }
    | { attempted: true; sent: false; reason: "send_failed" | "missing_env"; errorMessage?: string } = {
      attempted: false,
      sent: false,
      reason: "not_requested"
    };

  if (options?.visibility === "customer" && options.sendEmail) {
    if (!normalizedRecipientEmail) {
      emailStatus = {
        attempted: false,
        sent: false,
        reason: "no_email"
      };
    } else {
      try {
        const endpoint =
          typeof window !== "undefined"
            ? "/api/vehicle-activity-notifications"
            : buildAbsoluteUrl("/api/vehicle-activity-notifications");

        console.log("[vehicle-activity-email] Calling POST /api/vehicle-activity-notifications", {
          vehicleId,
          selectedCustomerEmail: normalizedRecipientEmail,
          noteContent: note
        });

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            vehicleId,
            customerEmail: normalizedRecipientEmail,
            vehicleTitle: options.vehicleTitle ?? "Vehicle listing",
            referenceId: options.referenceId ?? vehicleId,
            message: note
          }),
          keepalive: true,
          cache: "no-store"
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          console.error("[vehicle-activity-email] Failed to trigger customer activity email", {
            vehicleId,
            recipientEmail: normalizedRecipientEmail,
            status: response.status,
            body: payload
          });
          emailStatus = {
            attempted: true,
            sent: false,
            reason: "send_failed",
            errorMessage: payload?.error || "Vehicle activity email send failed."
          };
        } else {
          const payload = await response.json().catch(() => null);
          console.log("[vehicle-activity-email] Customer activity email API response", {
            vehicleId,
            selectedCustomerEmail: normalizedRecipientEmail,
            response: payload
          });
          emailStatus =
            payload?.sent === false && payload?.reason === "missing_env"
              ? {
                  attempted: true,
                  sent: false,
                  reason: "missing_env"
                }
              : payload?.sent === false && payload?.reason === "no_customer_email_set"
                ? {
                    attempted: false,
                    sent: false,
                    reason: "no_email"
                  }
                : payload?.success === false
                  ? {
                      attempted: true,
                      sent: false,
                      reason: "send_failed",
                      errorMessage: payload?.error || "Vehicle activity email send failed."
                    }
                  : payload?.sent === true
                    ? {
                        attempted: true,
                        sent: true
                      }
                    : {
                        attempted: true,
                        sent: false,
                        reason: "send_failed",
                        errorMessage: payload?.error || "Vehicle activity email send failed."
                      };
        }
      } catch (error) {
        console.error("[vehicle-activity-email] Failed to reach customer activity email endpoint", {
          vehicleId,
          recipientEmail: normalizedRecipientEmail,
          reason: error instanceof Error ? error.message : String(error)
        });
        emailStatus = {
          attempted: true,
          sent: false,
          reason: "send_failed"
        };
      }
    }
  }

  return {
    event,
    source: isFirebaseConfigured ? ("firestore" as const) : ("mock" as const),
    writeSucceeded: isFirebaseConfigured,
    emailStatus
  };
}

export async function updateVehicleActivityImageUrls(
  activityId: string,
  imageUrls: string[],
  actor: VehicleActor
) {
  assertAdminPermissionForActor(actor, "manageVehicles", "Only authorized admins can update vehicle activity attachments.");

  const normalizedImageUrls = Array.from(
    new Set(imageUrls.filter((imageUrl) => typeof imageUrl === "string" && imageUrl.trim().length > 0).map((imageUrl) => imageUrl.trim()))
  );

  if (!activityId) {
    throw new Error("Vehicle activity event ID is required.");
  }

  if (!isFirebaseConfigured) {
    return {
      activityId,
      imageUrls: normalizedImageUrls,
      source: "mock" as const,
      writeSucceeded: false
    };
  }

  await updateDoc(doc(db, "vehicleActivityEvents", activityId), {
    imageUrls: normalizedImageUrls,
    updatedAt: serverTimestamp()
  });

  return {
    activityId,
    imageUrls: normalizedImageUrls,
    source: "firestore" as const,
    writeSucceeded: true
  };
}

export async function getWarehouseIntakesData() {
  if (!isFirebaseConfigured) {
    return {
      items: [] as WarehouseIntakeRecord[],
      source: "mock" as const
    };
  }

  try {
    const snapshot = await readFirestoreWithAuthRetry(() => getDocs(collection(db, "warehouseIntakes")));
    const items = snapshot.docs
      .map((item) => serializeWarehouseIntakeDoc(item.id, item.data()))
      .sort((left, right) => (right.updatedAt ?? right.createdAt ?? "").localeCompare(left.updatedAt ?? left.createdAt ?? ""));

    return {
      items,
      source: "firestore" as const
    };
  } catch (error) {
    return {
      items: [] as WarehouseIntakeRecord[],
      source: "firestore" as const,
      error: error instanceof Error ? error.message : "Unknown Firestore read error"
    };
  }
}

export async function getWarehouseIntakeById(id: string) {
  if (!id) return null;
  if (!isFirebaseConfigured) return null;

  const snapshot = await readFirestoreWithAuthRetry(() => getDoc(doc(db, "warehouseIntakes", id)));
  if (!snapshot.exists()) return null;
  return serializeWarehouseIntakeDoc(snapshot.id, snapshot.data());
}

export async function getWarehouseIntakeByVehicleId(vehicleId: string) {
  if (!vehicleId) {
    return {
      items: [] as WarehouseIntakeRecord[],
      source: "mock" as const
    };
  }

  if (!isFirebaseConfigured) {
    return {
      items: [] as WarehouseIntakeRecord[],
      source: "mock" as const
    };
  }

  try {
    const snapshot = await readFirestoreWithAuthRetry(() => getDocs(query(collection(db, "warehouseIntakes"), where("vehicleId", "==", vehicleId))));
    const items = snapshot.docs
      .map((item) => serializeWarehouseIntakeDoc(item.id, item.data()))
      .sort((left, right) => (right.updatedAt ?? right.createdAt ?? "").localeCompare(left.updatedAt ?? left.createdAt ?? ""));

    return {
      items,
      source: "firestore" as const
    };
  } catch (error) {
    return {
      items: [] as WarehouseIntakeRecord[],
      source: "firestore" as const,
      error: error instanceof Error ? error.message : "Unknown Firestore read error"
    };
  }
}

export async function getCustomerProfileById(id: string) {
  if (!id) return null;
  if (!isFirebaseConfigured) return null;

  const snapshot = await readFirestoreWithAuthRetry(() => getDoc(doc(db, "customerProfiles", id)));
  if (!snapshot.exists()) return null;
  return serializeCustomerProfileDoc(snapshot.id, snapshot.data());
}

export async function getVehicleRecordById(id: string) {
  if (!id) return null;
  if (!isFirebaseConfigured) return null;

  const snapshot = await readFirestoreWithAuthRetry(() => getDoc(doc(db, "vehicleRecords", id)));
  if (!snapshot.exists()) return null;
  return serializeVehicleRecordDoc(snapshot.id, snapshot.data());
}

export async function getCustomerProfilesData() {
  return await getCollection<CustomerProfile>("customerProfiles", [], serializeCustomerProfileDoc);
}

export async function getVehicleRecordsData() {
  return await getCollection<VehicleRecord>("vehicleRecords", [], serializeVehicleRecordDoc);
}

export async function archiveVehicleRecord(
  vehicleRecordId: string,
  actor: VehicleActor
): Promise<{ success: boolean; source: VehicleDataSource }> {
  assertAdminPermissionForActor(actor, "manageVehicles", "Only authorized admins can archive vehicle records.");

  if (!vehicleRecordId.trim()) {
    throw new Error("Vehicle record ID is required.");
  }

  if (!isFirebaseConfigured) {
    return {
      success: true,
      source: "mock" as const
    };
  }

  const vehicleRecord = await getVehicleRecordById(vehicleRecordId);
  if (!vehicleRecord) {
    throw new Error("Vehicle record not found.");
  }

  await updateDoc(doc(db, "vehicleRecords", vehicleRecordId), {
    status: "archived",
    updatedAt: serverTimestamp()
  });

  if (vehicleRecord.customerProfileId?.trim()) {
    await updateDoc(doc(db, "customerProfiles", vehicleRecord.customerProfileId.trim()), {
      linkedVehicleRecordIds: arrayRemove(vehicleRecordId),
      updatedAt: serverTimestamp()
    }).catch(() => undefined);
  }

  return {
    success: true,
    source: "firestore" as const
  };
}

export async function getWarehouseRelationshipTreeByVehicleId(vehicleId: string): Promise<WarehouseRelationshipTree> {
  const listing = vehicleId ? await getVehicleById(vehicleId) : null;
  const intakeResult = vehicleId ? await getWarehouseIntakeByVehicleId(vehicleId) : { items: [] as WarehouseIntakeRecord[] };
  const latestIntake = intakeResult.items[0] ?? null;
  const customerProfile = latestIntake?.customerProfileId ? await getCustomerProfileById(latestIntake.customerProfileId) : null;
  const vehicleRecord = latestIntake?.vehicleRecordId ? await getVehicleRecordById(latestIntake.vehicleRecordId) : null;

  return {
    customerProfile,
    vehicleRecord,
    listing,
    intakeRecords: intakeResult.items
  };
}

async function resolveCustomerProfileId(
  intake: Omit<WarehouseIntakeRecord, "id" | "updatedAt" | "photoCount">,
  existingCustomerProfileId?: string
) {
  if (existingCustomerProfileId?.trim()) return existingCustomerProfileId.trim();
  if (!isFirebaseConfigured) return "";

  const normalizedEmail = normalizeCustomerProfileEmail(intake.ownerDetails?.email);
  if (normalizedEmail) {
    const snapshot = await getDocs(query(collection(db, "customerProfiles"), where("normalizedEmail", "==", normalizedEmail), limit(1)));
    if (!snapshot.empty) return snapshot.docs[0].id;
  }

  const normalizedPhone = normalizeCustomerProfilePhone(intake.ownerDetails?.phone);
  if (normalizedPhone) {
    const snapshot = await getDocs(query(collection(db, "customerProfiles"), where("normalizedPhone", "==", normalizedPhone), limit(1)));
    if (!snapshot.empty) return snapshot.docs[0].id;
  }

  return "";
}

async function resolveVehicleRecordId(
  intake: Omit<WarehouseIntakeRecord, "id" | "updatedAt" | "photoCount">,
  existingVehicleRecordId?: string
) {
  if (existingVehicleRecordId?.trim()) return existingVehicleRecordId.trim();
  if (!isFirebaseConfigured) return "";

  const vin = sanitizeSingleLineText(intake.vehicleDetails?.vin ?? "");
  if (vin) {
    const snapshot = await getDocs(query(collection(db, "vehicleRecords"), where("vin", "==", vin), limit(1)));
    if (!snapshot.empty) return snapshot.docs[0].id;
  }

  const registrationPlate = sanitizeSingleLineText(intake.vehicleDetails?.registrationPlate ?? "");
  if (registrationPlate) {
    const snapshot = await getDocs(query(collection(db, "vehicleRecords"), where("registrationPlate", "==", registrationPlate), limit(1)));
    if (!snapshot.empty) return snapshot.docs[0].id;
  }

  if (intake.vehicleId?.trim()) {
    const snapshot = await getDocs(query(collection(db, "vehicleRecords"), where("publicListingId", "==", intake.vehicleId.trim()), limit(1)));
    if (!snapshot.empty) return snapshot.docs[0].id;
  }

  const customerProfileId = intake.customerProfileId?.trim();
  const make = sanitizeSingleLineText(intake.vehicleDetails?.make ?? "");
  const model = sanitizeSingleLineText(intake.vehicleDetails?.model ?? "");
  const year = sanitizeSingleLineText(intake.vehicleDetails?.year ?? "");
  if (!vin && !registrationPlate && !intake.vehicleId?.trim() && customerProfileId && make && model && year) {
    const snapshot = await getDocs(
      query(
        collection(db, "vehicleRecords"),
        where("customerProfileId", "==", customerProfileId),
        where("make", "==", make),
        where("model", "==", model),
        where("year", "==", year),
        limit(2)
      )
    );
    if (snapshot.size === 1) {
      return snapshot.docs[0].id;
    }
  }

  return "";
}

async function resolveVehicleRecordIdForCoreRecord(
  input: Omit<VehicleRecord, "id" | "createdAt" | "updatedAt">,
  existingVehicleRecordId?: string
) {
  if (existingVehicleRecordId?.trim()) return existingVehicleRecordId.trim();
  if (!isFirebaseConfigured) return "";

  const vin = sanitizeSingleLineText(input.vin ?? "");
  if (vin) {
    const snapshot = await getDocs(query(collection(db, "vehicleRecords"), where("vin", "==", vin), limit(1)));
    if (!snapshot.empty) return snapshot.docs[0].id;
  }

  const registrationPlate = sanitizeSingleLineText(input.registrationPlate ?? "");
  if (registrationPlate) {
    const snapshot = await getDocs(query(collection(db, "vehicleRecords"), where("registrationPlate", "==", registrationPlate), limit(1)));
    if (!snapshot.empty) return snapshot.docs[0].id;
  }

  const publicListingId = input.publicListingId?.trim();
  if (publicListingId) {
    const snapshot = await getDocs(query(collection(db, "vehicleRecords"), where("publicListingId", "==", publicListingId), limit(1)));
    if (!snapshot.empty) return snapshot.docs[0].id;
  }

  const customerProfileId = input.customerProfileId?.trim();
  const make = sanitizeSingleLineText(input.make ?? "");
  const model = sanitizeSingleLineText(input.model ?? "");
  const year = sanitizeSingleLineText(input.year ?? "");
  if (!vin && !registrationPlate && !publicListingId && customerProfileId && make && model && year) {
    const snapshot = await getDocs(
      query(
        collection(db, "vehicleRecords"),
        where("customerProfileId", "==", customerProfileId),
        where("make", "==", make),
        where("model", "==", model),
        where("year", "==", year),
        limit(2)
      )
    );
    if (snapshot.size === 1) return snapshot.docs[0].id;
  }

  return "";
}

function buildCustomerProfileWritePayload(
  input: Omit<WarehouseIntakeRecord, "id" | "updatedAt" | "photoCount">,
  actor: VehicleActor,
  linkedVehicleRecordId: string,
  intakeId: string
) {
  const normalizedEmail = normalizeCustomerProfileEmail(input.ownerDetails?.email);
  const normalizedPhone = normalizeCustomerProfilePhone(input.ownerDetails?.phone);

  return {
    fullName: sanitizeSingleLineText(input.ownerDetails?.fullName ?? ""),
    email: normalizedEmail,
    normalizedEmail,
    phone: sanitizeSingleLineText(input.ownerDetails?.phone ?? ""),
    normalizedPhone,
    address: sanitizeMultilineText(input.ownerDetails?.address ?? ""),
    dateOfBirth: sanitizeSingleLineText(input.ownerDetails?.dateOfBirth ?? ""),
    preferredContactMethod: normalizeWarehousePreferredContactMethod(input.ownerDetails?.preferredContactMethod),
    customerVerificationNotes: sanitizeMultilineText(input.ownerDetails?.customerVerificationNotes ?? ""),
    identificationDocumentType: normalizeWarehouseIdentificationDocumentType(input.ownerDetails?.identificationDocumentType),
    identificationDocumentNumber: sanitizeSingleLineText(input.ownerDetails?.identificationDocumentNumber ?? ""),
    companyOwned: input.ownerDetails?.companyOwned === true,
    companyName: sanitizeSingleLineText(input.ownerDetails?.companyName ?? ""),
    abn: sanitizeSingleLineText(input.ownerDetails?.abn ?? ""),
    acn: sanitizeSingleLineText(input.ownerDetails?.acn ?? ""),
    identificationDocument: input.ownerDetails?.identificationDocument ?? null,
    isLegalOwnerConfirmed: input.ownerDetails?.isLegalOwnerConfirmed === true,
    latestIntakeId: intakeId,
    latestVehicleRecordId: linkedVehicleRecordId,
    linkedVehicleRecordIds: linkedVehicleRecordId ? [linkedVehicleRecordId] : [],
    linkedListingIds: input.vehicleId ? [input.vehicleId] : [],
    status: "active" as CustomerProfileStatus,
    lastEditedByUid: actor.id,
    lastEditedByName: getActorDisplayName(actor),
    lastEditedAt: serverTimestamp(),
    createdByUid: actor.id
  };
}

function deriveWarehouseVehicleTitle(input: Omit<WarehouseIntakeRecord, "id" | "updatedAt" | "photoCount">) {
  return input.vehicleTitle
    || [input.vehicleDetails?.year, input.vehicleDetails?.make, input.vehicleDetails?.model, input.vehicleDetails?.variant]
      .filter(Boolean)
      .join(" ")
      .trim();
}

function calculateWarehouseServiceFeeTotals(items: WarehouseServiceFeeItem[]) {
  const serviceFeeSubtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const gstInclusiveServiceFeeTotal = items.reduce(
    (sum, item) => sum + (item.gstIncluded ? item.amount : item.amount * 1.1),
    0
  );
  const gstAmount = Math.max(gstInclusiveServiceFeeTotal - serviceFeeSubtotal, 0);
  return {
    serviceFeeSubtotal,
    gstInclusiveServiceFeeTotal,
    gstAmount
  };
}

function buildVehicleRecordWritePayload(
  input: Omit<WarehouseIntakeRecord, "id" | "updatedAt" | "photoCount">,
  actor: VehicleActor,
  customerProfileId: string,
  intakeId: string
) {
  const base = createEmptyVehicleRecord();
  const listingHistory: VehicleListingHistoryEntry[] = Array.isArray((input as { listingHistory?: VehicleListingHistoryEntry[] }).listingHistory)
    ? (input as { listingHistory?: VehicleListingHistoryEntry[] }).listingHistory ?? []
    : [];
  const projectedRevenueSnapshot = Math.max(
    parseCurrencyNumber(input.vehicleDetails?.askingPrice),
    parseCurrencyNumber(input.vehicleDetails?.reservePrice)
  ) + calculateWarehouseServiceFeeTotals(input.serviceItems ?? []).gstInclusiveServiceFeeTotal;
  const linkedStatus =
    input.vehicleId?.trim()
      ? ("listed" as VehicleRecordStatus)
      : input.status === "signed"
        ? ("warehouse_managed" as VehicleRecordStatus)
        : ("draft" as VehicleRecordStatus);
  return {
    ...base,
    customerProfileId,
    publicListingId: input.vehicleId || "",
    displayReference: input.vehicleReference || "",
    title: deriveWarehouseVehicleTitle(input),
    make: sanitizeSingleLineText(input.vehicleDetails?.make ?? ""),
    model: sanitizeSingleLineText(input.vehicleDetails?.model ?? ""),
    variant: sanitizeSingleLineText(input.vehicleDetails?.variant ?? ""),
    year: sanitizeSingleLineText(input.vehicleDetails?.year ?? ""),
    registrationPlate: sanitizeSingleLineText(input.vehicleDetails?.registrationPlate ?? ""),
    vin: sanitizeSingleLineText(input.vehicleDetails?.vin ?? ""),
    colour: sanitizeSingleLineText(input.vehicleDetails?.colour ?? ""),
    odometer: sanitizeSingleLineText(input.vehicleDetails?.odometer ?? ""),
    registrationExpiry: sanitizeSingleLineText(input.vehicleDetails?.registrationExpiry ?? ""),
    numberOfKeys: sanitizeSingleLineText(input.vehicleDetails?.numberOfKeys ?? ""),
    fuelType: sanitizeSingleLineText(input.vehicleDetails?.fuelType ?? ""),
    transmission: sanitizeSingleLineText(input.vehicleDetails?.transmission ?? ""),
    askingPrice: sanitizeSingleLineText(input.vehicleDetails?.askingPrice ?? ""),
    reservePrice: sanitizeSingleLineText(input.vehicleDetails?.reservePrice ?? ""),
    serviceHistory: sanitizeMultilineText(input.vehicleDetails?.serviceHistory ?? ""),
    accidentHistory: sanitizeMultilineText(input.vehicleDetails?.accidentHistory ?? ""),
    ownershipProof: input.vehicleDetails?.ownershipProof ?? null,
    declarations: {
      ...base.declarations,
      ...input.declarations
    },
    notes: sanitizeMultilineText(input.vehicleDetails?.notes ?? ""),
    linkedIntakeIds: intakeId ? [intakeId] : [],
    latestIntakeId: intakeId,
    status: linkedStatus,
    listingHistory,
    estimatedTotalIncome: projectedRevenueSnapshot,
    lastEditedByUid: actor.id,
    lastEditedByName: getActorDisplayName(actor),
    lastEditedAt: serverTimestamp(),
    activeIntakeEditorUid: actor.id,
    activeIntakeEditorName: getActorDisplayName(actor),
    activeIntakeEditedAt: serverTimestamp(),
    createdByUid: actor.id
  };
}

async function upsertCustomerProfileFromIntake(
  intake: Omit<WarehouseIntakeRecord, "id" | "updatedAt" | "photoCount">,
  actor: VehicleActor,
  linkedVehicleRecordId: string,
  intakeId: string
) {
  const existingId = await resolveCustomerProfileId(intake, intake.customerProfileId);

  if (!isFirebaseConfigured) {
    return existingId || `mock-customer-profile-${Date.now()}`;
  }

  const ref = existingId ? doc(db, "customerProfiles", existingId) : doc(collection(db, "customerProfiles"));
  const payload = buildCustomerProfileWritePayload(intake, actor, linkedVehicleRecordId, intakeId);
  const linkedVehicleRecordIds = payload.linkedVehicleRecordIds.filter(Boolean);
  const linkedListingIds = payload.linkedListingIds.filter(Boolean);

  await setDoc(
    ref,
    sanitizeFirestoreWriteData({
      ...payload,
      ...(linkedVehicleRecordIds.length ? { linkedVehicleRecordIds: arrayUnion(...linkedVehicleRecordIds) } : {}),
      ...(linkedListingIds.length ? { linkedListingIds: arrayUnion(...linkedListingIds) } : {}),
      ...(existingId ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp()
    }),
    { merge: true }
  );

  return ref.id;
}

async function upsertVehicleRecordFromIntake(
  intake: Omit<WarehouseIntakeRecord, "id" | "updatedAt" | "photoCount">,
  actor: VehicleActor,
  customerProfileId: string,
  intakeId: string
) {
  const existingId = await resolveVehicleRecordId(intake, intake.vehicleRecordId);
  const existingRecord = existingId && isFirebaseConfigured ? await getVehicleRecordById(existingId).catch(() => null) : null;

  if (!isFirebaseConfigured) {
    return existingId || `mock-vehicle-record-${Date.now()}`;
  }

  const ref = existingId ? doc(db, "vehicleRecords", existingId) : doc(collection(db, "vehicleRecords"));
  const payload = buildVehicleRecordWritePayload(
    {
      ...intake,
      listingHistory: existingRecord?.listingHistory ?? []
    } as Omit<WarehouseIntakeRecord, "id" | "updatedAt" | "photoCount"> & { listingHistory?: VehicleListingHistoryEntry[] },
    actor,
    customerProfileId,
    intakeId
  );
  const linkedIntakeIds = payload.linkedIntakeIds.filter(Boolean);

  await setDoc(
    ref,
    sanitizeFirestoreWriteData({
      ...payload,
      ...(linkedIntakeIds.length ? { linkedIntakeIds: arrayUnion(...linkedIntakeIds) } : {}),
      ...(existingId ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp()
    }),
    { merge: true }
  );

  return ref.id;
}

async function syncVehicleRecordReportingSnapshot(vehicleRecordId: string) {
  if (!vehicleRecordId || !isFirebaseConfigured) return;

  const [vehicleRecord, intakesResult] = await Promise.all([
    getVehicleRecordById(vehicleRecordId),
    (async () => {
      const snapshot = await getDocs(query(collection(db, "warehouseIntakes"), where("vehicleRecordId", "==", vehicleRecordId)));
      return snapshot.docs.map((item) => serializeWarehouseIntakeDoc(item.id, item.data()));
    })()
  ]);

  if (!vehicleRecord) return;

  const intakeEventCount = intakesResult.length;
  const serviceFeeSubtotal = intakesResult.reduce((sum, intake) => sum + (intake.serviceFeeSubtotal ?? 0), 0);
  const gstInclusiveServiceFeeTotal = intakesResult.reduce((sum, intake) => sum + (intake.gstInclusiveServiceFeeTotal ?? 0), 0);
  const outstandingIntakeCosts = intakesResult
    .filter((intake) => intake.status !== "signed")
    .reduce((sum, intake) => sum + (intake.gstInclusiveServiceFeeTotal ?? 0), 0);
  const storageRevenue = intakesResult.reduce(
    (sum, intake) => sum + intake.serviceItems
      .filter((item) => item.category === "storage_fee")
      .reduce((subtotal, item) => subtotal + (item.gstIncluded ? item.amount : item.amount * 1.1), 0),
    0
  );
  const soldGrossTotal = (vehicleRecord.listingHistory ?? []).reduce((sum, entry) => {
    if (!entry.soldAt) return sum;
    const lastAskingPrice = entry.askingPriceHistory[entry.askingPriceHistory.length - 1]?.amount ?? 0;
    return sum + lastAskingPrice;
  }, 0);
  const estimatedTotalIncome = Math.max(parseCurrencyNumber(vehicleRecord.askingPrice), parseCurrencyNumber(vehicleRecord.reservePrice)) + gstInclusiveServiceFeeTotal;
  const realisedRevenue = soldGrossTotal + gstInclusiveServiceFeeTotal;

  await updateDoc(doc(db, "vehicleRecords", vehicleRecordId), {
    serviceFeeSubtotal,
    gstInclusiveServiceFeeTotal,
    estimatedTotalIncome,
    realisedRevenue,
    outstandingIntakeCosts,
    storageRevenue,
    soldGrossTotal,
    intakeEventCount,
    lastCalculatedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function saveCustomerProfile(
  input: Omit<CustomerProfile, "id" | "createdAt" | "updatedAt">,
  actor: VehicleActor,
  existingId?: string
) {
  assertAdminPermissionForActor(actor, "manageVehicles", "Only authorized admins can manage customer profiles.");

  if (!isFirebaseConfigured) {
    const id = existingId || `mock-customer-profile-${Date.now()}`;
    return {
      profile: {
        id,
        ...createEmptyCustomerProfile(),
        ...input,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } satisfies CustomerProfile,
      source: "mock" as const,
      writeSucceeded: false
    };
  }

  const ref = existingId ? doc(db, "customerProfiles", existingId) : doc(collection(db, "customerProfiles"));
  const now = new Date().toISOString();
  const payload = sanitizeFirestoreWriteData({
    ...createEmptyCustomerProfile(),
    ...input,
    fullName: sanitizeSingleLineText(input.fullName),
    email: normalizeCustomerProfileEmail(input.email),
    normalizedEmail: normalizeCustomerProfileEmail(input.email),
    phone: sanitizeSingleLineText(input.phone),
    normalizedPhone: normalizeCustomerProfilePhone(input.phone),
    address: sanitizeMultilineText(input.address),
    dateOfBirth: sanitizeSingleLineText(input.dateOfBirth),
    customerVerificationNotes: sanitizeMultilineText(input.customerVerificationNotes),
    identificationDocumentNumber: sanitizeSingleLineText(input.identificationDocumentNumber),
    companyName: sanitizeSingleLineText(input.companyName),
    abn: sanitizeSingleLineText(input.abn),
    acn: sanitizeSingleLineText(input.acn),
    preferredContactMethod: normalizeWarehousePreferredContactMethod(input.preferredContactMethod),
    identificationDocumentType: normalizeWarehouseIdentificationDocumentType(input.identificationDocumentType),
    linkedVehicleRecordIds: Array.from(new Set((input.linkedVehicleRecordIds ?? []).filter(Boolean))),
    linkedListingIds: Array.from(new Set((input.linkedListingIds ?? []).filter(Boolean))),
    lastEditedByUid: actor.id,
    lastEditedByName: getActorDisplayName(actor),
    lastEditedAt: serverTimestamp(),
    ...(existingId ? {} : { createdAt: serverTimestamp() }),
    updatedAt: serverTimestamp()
  });

  await setDoc(ref, payload, { merge: true });
  await writeAdminOperationalEvent({
    actor,
    recordType: "customer_profile",
    actionType: existingId ? "updated" : "created",
    affectedRecordId: ref.id,
    customerProfileId: ref.id,
    summary: `${sanitizeSingleLineText(input.fullName) || "Customer profile"} ${existingId ? "updated" : "created"}.`
  }).catch(() => undefined);

  return {
    profile: {
      id: ref.id,
      ...createEmptyCustomerProfile(),
      ...input,
      email: normalizeCustomerProfileEmail(input.email),
      normalizedEmail: normalizeCustomerProfileEmail(input.email),
      phone: sanitizeSingleLineText(input.phone),
      normalizedPhone: normalizeCustomerProfilePhone(input.phone),
      lastEditedByUid: actor.id,
      lastEditedByName: getActorDisplayName(actor),
      lastEditedAt: now,
      createdAt: existingId ? undefined : now,
      updatedAt: now
    } satisfies CustomerProfile,
    source: "firestore" as const,
    writeSucceeded: true
  };
}

export async function saveVehicleRecord(
  input: Omit<VehicleRecord, "id" | "createdAt" | "updatedAt">,
  actor: VehicleActor,
  existingId?: string
) {
  assertAdminPermissionForActor(actor, "manageVehicles", "Only authorized admins can manage vehicle records.");

  if (!isFirebaseConfigured) {
    const id = existingId || `mock-vehicle-record-${Date.now()}`;
    return {
      vehicleRecord: {
        id,
        ...createEmptyVehicleRecord(),
        ...input,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } satisfies VehicleRecord,
      source: "mock" as const,
      writeSucceeded: false
    };
  }

  const resolvedId = await resolveVehicleRecordIdForCoreRecord(input, existingId);
  const ref = resolvedId ? doc(db, "vehicleRecords", resolvedId) : doc(collection(db, "vehicleRecords"));
  const now = new Date().toISOString();
  const payload = sanitizeFirestoreWriteData({
    ...createEmptyVehicleRecord(),
    ...input,
    title: sanitizeSingleLineText(input.title ?? ""),
    make: sanitizeSingleLineText(input.make ?? ""),
    model: sanitizeSingleLineText(input.model ?? ""),
    variant: sanitizeSingleLineText(input.variant ?? ""),
    year: sanitizeSingleLineText(input.year ?? ""),
    registrationPlate: sanitizeSingleLineText(input.registrationPlate ?? ""),
    vin: sanitizeSingleLineText(input.vin ?? ""),
    colour: sanitizeSingleLineText(input.colour ?? ""),
    odometer: sanitizeSingleLineText(input.odometer ?? ""),
    registrationExpiry: sanitizeSingleLineText(input.registrationExpiry ?? ""),
    numberOfKeys: sanitizeSingleLineText(input.numberOfKeys ?? ""),
    fuelType: sanitizeSingleLineText(input.fuelType ?? ""),
    transmission: sanitizeSingleLineText(input.transmission ?? ""),
    askingPrice: sanitizeSingleLineText(input.askingPrice ?? ""),
    reservePrice: sanitizeSingleLineText(input.reservePrice ?? ""),
    serviceHistory: sanitizeMultilineText(input.serviceHistory ?? ""),
    accidentHistory: sanitizeMultilineText(input.accidentHistory ?? ""),
    notes: sanitizeMultilineText(input.notes ?? ""),
    linkedIntakeIds: Array.from(new Set((input.linkedIntakeIds ?? []).filter(Boolean))),
    listingHistory: serializeVehicleListingHistory(input.listingHistory),
    lastEditedByUid: actor.id,
    lastEditedByName: getActorDisplayName(actor),
    lastEditedAt: serverTimestamp(),
    ...(resolvedId ? {} : { createdAt: serverTimestamp() }),
    updatedAt: serverTimestamp()
  });

  await setDoc(ref, payload, { merge: true });
  await syncVehicleRecordReportingSnapshot(ref.id).catch(() => undefined);
  if (input.publicListingId) {
    const linkedListing = await getVehicleById(input.publicListingId).catch(() => null);
    if (linkedListing) {
      await syncVehicleRecordFromPublicListing(linkedListing, actor, "linked_listing_synced").catch(() => undefined);
    }
  }
  await writeAdminOperationalEvent({
    actor,
    recordType: "vehicle_record",
    actionType: resolvedId ? "updated" : "created",
    affectedRecordId: ref.id,
    customerProfileId: input.customerProfileId || "",
    vehicleRecordId: ref.id,
    publicListingId: input.publicListingId || "",
    summary: `${sanitizeSingleLineText(input.title || `${input.year} ${input.make} ${input.model}`) || "Vehicle record"} ${resolvedId ? "updated" : "created"}.`
  }).catch(() => undefined);

  return {
    vehicleRecord: {
      id: ref.id,
      ...createEmptyVehicleRecord(),
      ...input,
      listingHistory: serializeVehicleListingHistory(input.listingHistory),
      lastEditedByUid: actor.id,
      lastEditedByName: getActorDisplayName(actor),
      lastEditedAt: now,
      createdAt: resolvedId ? undefined : now,
      updatedAt: now
    } satisfies VehicleRecord,
    source: "firestore" as const,
    writeSucceeded: true
  };
}

function buildWarehouseIntakeWritePayload(
  input: Omit<WarehouseIntakeRecord, "id" | "updatedAt" | "photoCount">,
  actor: VehicleActor
) {
  const base = createEmptyWarehouseIntakeRecord();
  const photos = Array.from(
    new Map(
      (input.photos ?? [])
        .filter((photo) => typeof photo.storagePath === "string" && photo.storagePath.trim().length > 0)
        .map((photo, index) => [
          photo.id || `${Date.now()}-${index}`,
          {
            id: photo.id || `${Date.now()}-${index}`,
            category: photo.category || "extraPhotos",
            label: photo.label || "Vehicle photo",
            storagePath: photo.storagePath.trim(),
            name: photo.name || "",
            uploadedAt: photo.uploadedAt || new Date().toISOString(),
            contentType: photo.contentType || ""
          } satisfies WarehouseIntakePhotoRecord
        ])
    ).values()
  );
  const agreement = {
    ...base.agreement,
    ...input.agreement
  };
  const serviceItems = Array.from(
    new Map(
      (input.serviceItems ?? [])
        .map((item) =>
          createEmptyWarehouseServiceFeeItem({
            id: item.id,
            serviceName: sanitizeSingleLineText(item.serviceName ?? ""),
            category: item.category,
            amount: Number.isFinite(Number(item.amount)) ? Number(item.amount) : 0,
            gstIncluded: item.gstIncluded !== false,
            customerVisible: item.customerVisible !== false,
            internalNote: sanitizeMultilineText(item.internalNote ?? "")
          })
        )
        .filter((item) => item.serviceName || item.amount > 0 || item.internalNote)
        .map((item) => [item.id, item] as const)
    ).values()
  );
  const serviceTotals = calculateWarehouseServiceFeeTotals(serviceItems);
  const normalizedSignedAt = typeof input.signature?.signedAt === "string" && input.signature.signedAt.trim()
    ? input.signature.signedAt
    : "";
  const intakeDate = typeof input.intakeDate === "string" && input.intakeDate.trim()
    ? input.intakeDate
    : (typeof input.createdAt === "string" && input.createdAt.trim() ? input.createdAt : new Date().toISOString());
  const storageStartDate = typeof input.storageStartDate === "string" ? input.storageStartDate : "";
  const storageEndDate = typeof input.storageEndDate === "string" ? input.storageEndDate : "";
  const storageDurationDays =
    typeof input.storageDurationDays === "number"
      ? input.storageDurationDays
      : storageStartDate && storageEndDate
        ? Math.max(Math.round((new Date(storageEndDate).getTime() - new Date(storageStartDate).getTime()) / (1000 * 60 * 60 * 24)), 0)
        : 0;
  const projectedRevenueSnapshot = Math.max(
    parseCurrencyNumber(input.vehicleDetails?.askingPrice),
    parseCurrencyNumber(input.vehicleDetails?.reservePrice)
  ) + serviceTotals.gstInclusiveServiceFeeTotal;

  return {
    vehicleId: input.vehicleId || "",
    vehicleReference: input.vehicleReference || "",
    vehicleTitle: deriveWarehouseVehicleTitle(input),
    status: (input.status === "signed" || input.status === "review_ready" ? input.status : "draft") as WarehouseIntakeStatus,
    ownerDetails: {
      ...base.ownerDetails,
      ...input.ownerDetails,
      preferredContactMethod: normalizeWarehousePreferredContactMethod(input.ownerDetails?.preferredContactMethod),
      identificationDocumentType: normalizeWarehouseIdentificationDocumentType(input.ownerDetails?.identificationDocumentType),
      identificationDocument: input.ownerDetails?.identificationDocument ?? null
    } satisfies WarehouseIntakeOwnerDetails,
    vehicleDetails: {
      ...base.vehicleDetails,
      ...input.vehicleDetails,
      ownershipProof: input.vehicleDetails?.ownershipProof ?? null
    } satisfies WarehouseIntakeVehicleDetails,
    declarations: {
      ...base.declarations,
      ...input.declarations,
      writtenOffHistory: normalizeWarehouseDeclarationAnswer(input.declarations?.writtenOffHistory),
      repairableWriteOffHistory: normalizeWarehouseDeclarationAnswer(input.declarations?.repairableWriteOffHistory),
      stolenRecoveredHistory: normalizeWarehouseDeclarationAnswer(input.declarations?.stolenRecoveredHistory),
      hailDamageHistory: normalizeWarehouseDeclarationAnswer(input.declarations?.hailDamageHistory),
      floodDamageHistory: normalizeWarehouseDeclarationAnswer(input.declarations?.floodDamageHistory),
      engineReplacementHistory: normalizeWarehouseDeclarationAnswer(input.declarations?.engineReplacementHistory),
      odometerDiscrepancyKnown: normalizeWarehouseDeclarationAnswer(input.declarations?.odometerDiscrepancyKnown),
      financeOwing: normalizeWarehouseDeclarationAnswer(input.declarations?.financeOwing)
    } satisfies WarehouseIntakeDeclarations,
    conditionReport: {
      exterior: serializeWarehouseConditionSection(input.conditionReport?.exterior, WAREHOUSE_EXTERIOR_KEYS),
      interior: serializeWarehouseConditionSection(input.conditionReport?.interior, WAREHOUSE_INTERIOR_KEYS),
      mechanical: serializeWarehouseConditionSection(input.conditionReport?.mechanical, WAREHOUSE_MECHANICAL_KEYS)
    } satisfies WarehouseIntakeConditionReport,
    photos,
    serviceItems,
    intakeDate,
    assignedStaffUid: input.assignedStaffUid || actor.id,
    assignedStaffName: input.assignedStaffName || getActorDisplayName(actor),
    intakeNotes: sanitizeMultilineText(input.intakeNotes ?? ""),
    projectedRevenueSnapshot,
    storageStartDate,
    storageEndDate,
    storageDurationDays,
    ...serviceTotals,
    agreement: {
      ...agreement,
      ...(agreement.reviewedAt ? { reviewedAt: agreement.reviewedAt } : {})
    } satisfies WarehouseIntakeAgreement,
    signature: {
      ...base.signature,
      ...input.signature,
      ...(normalizedSignedAt ? { signedAt: normalizedSignedAt } : {}),
      signatureStoragePath: input.signature?.signatureStoragePath || "",
      adminStaffName:
        input.signature?.adminStaffName
        || input.adminStaffName
        || actor.displayName
        || actor.name
        || actor.email
        || "CarNest Admin"
    } satisfies WarehouseIntakeSignature,
    signedPdfStoragePath: input.signedPdfStoragePath || "",
    signedPdfFileName: input.signedPdfFileName || "",
    pdfGeneratedAt: input.pdfGeneratedAt || "",
    completedAt: input.completedAt || "",
    emailSentAt: input.emailSentAt || "",
    photoCount: photos.length,
    adminStaffName: input.adminStaffName || actor.displayName || actor.name || actor.email || "CarNest Admin",
    lastEditedByUid: actor.id,
    lastEditedByName: getActorDisplayName(actor),
    lastEditedAt: new Date().toISOString(),
    activeEditorUid: actor.id,
    activeEditorName: getActorDisplayName(actor),
    activeEditorAt: new Date().toISOString(),
    createdByUid: input.createdByUid || actor.id
  };
}

export async function saveWarehouseIntake(
  input: Omit<WarehouseIntakeRecord, "id" | "updatedAt" | "photoCount">,
  actor: VehicleActor,
  existingId?: string
) {
  assertAdminPermissionForActor(actor, "manageVehicles", "Only authorized admins can manage warehouse intake records.");
  const now = new Date().toISOString();
  const intakeId = existingId || `warehouse-intake-${Date.now()}`;
  const previousIntake = existingId && isFirebaseConfigured ? await getWarehouseIntakeById(existingId).catch(() => null) : null;

  if (!isFirebaseConfigured) {
    const mockCustomerProfileId = input.customerProfileId || `mock-customer-profile-${Date.now()}`;
    const mockVehicleRecordId = input.vehicleRecordId || `mock-vehicle-record-${Date.now()}`;
    const payload = buildWarehouseIntakeWritePayload(
      {
        ...input,
        customerProfileId: mockCustomerProfileId,
        vehicleRecordId: mockVehicleRecordId
      },
      actor
    );
    const id = existingId || `mock-warehouse-intake-${Date.now()}`;
    return {
      intake: {
        id,
        ...payload,
        createdAt: now,
        updatedAt: now
      } satisfies WarehouseIntakeRecord,
      source: "mock" as const,
      writeSucceeded: false
    };
  }

  const generatedVehicleRecordId = input.vehicleRecordId || doc(collection(db, "vehicleRecords")).id;
  const customerProfileId = await upsertCustomerProfileFromIntake(
    {
      ...input,
      vehicleRecordId: generatedVehicleRecordId
    },
    actor,
    generatedVehicleRecordId,
    intakeId
  );
  const vehicleRecordId = await upsertVehicleRecordFromIntake(
    {
      ...input,
      vehicleRecordId: generatedVehicleRecordId,
      customerProfileId
    },
    actor,
    customerProfileId,
    intakeId
  );
  const payload = buildWarehouseIntakeWritePayload(
    {
      ...input,
      customerProfileId,
      vehicleRecordId
    },
    actor
  );

  if (existingId) {
    const ownerDetails = {
      ...payload.ownerDetails,
      identificationDocument: payload.ownerDetails.identificationDocument
        ? {
            ...payload.ownerDetails.identificationDocument,
            url: deleteField()
          }
        : null,
      driverLicenceNumber: deleteField(),
      licencePhoto: deleteField(),
      ownershipVerification: deleteField()
    };

    const vehicleDetails = {
      ...payload.vehicleDetails,
      ownershipProof: payload.vehicleDetails.ownershipProof
        ? {
            ...payload.vehicleDetails.ownershipProof,
            url: deleteField()
          }
        : null
    };

    await setDoc(
      doc(db, "warehouseIntakes", existingId),
      sanitizeFirestoreWriteData({
        ...payload,
        ownerDetails,
        vehicleDetails,
        signature: {
          ...payload.signature,
          signatureImageUrl: deleteField()
        },
        signedPdfUrl: deleteField(),
        updatedAt: serverTimestamp()
      }),
      { merge: true }
    );

    await syncVehicleRecordReportingSnapshot(vehicleRecordId);
    await writeAdminOperationalEvent({
      actor,
      recordType: "warehouse_intake",
      actionType: payload.status === "signed" ? "intake_completed" : "updated",
      affectedRecordId: existingId,
      customerProfileId,
      vehicleRecordId,
      intakeEventId: existingId,
      publicListingId: payload.vehicleId || "",
      summary: `${payload.vehicleTitle || "Warehouse intake"} ${payload.status === "signed" ? "completed" : "updated"}.`
    }).catch(() => undefined);
    if (JSON.stringify(previousIntake?.serviceItems ?? []) !== JSON.stringify(payload.serviceItems)) {
      await writeAdminOperationalEvent({
        actor,
        recordType: "warehouse_intake",
        actionType: "fees_updated",
        affectedRecordId: existingId,
        customerProfileId,
        vehicleRecordId,
        intakeEventId: existingId,
        publicListingId: payload.vehicleId || "",
        summary: `Service fee items updated for ${payload.vehicleTitle || "warehouse intake"}.`
      }).catch(() => undefined);
    }

    return {
      intake: {
        id: existingId,
        ...payload,
        createdAt: input.createdAt || now,
        updatedAt: now
      } satisfies WarehouseIntakeRecord,
      source: "firestore" as const,
      writeSucceeded: true
    };
  }

  const intakeRef = doc(db, "warehouseIntakes", intakeId);
  await setDoc(
    intakeRef,
    sanitizeFirestoreWriteData({
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
  );

  await syncVehicleRecordReportingSnapshot(vehicleRecordId);
  await writeAdminOperationalEvent({
    actor,
    recordType: "warehouse_intake",
    actionType: "created",
    affectedRecordId: intakeRef.id,
    customerProfileId,
    vehicleRecordId,
    intakeEventId: intakeRef.id,
    publicListingId: payload.vehicleId || "",
    summary: `${payload.vehicleTitle || "Warehouse intake"} created.`
  }).catch(() => undefined);

  return {
    intake: {
      id: intakeRef.id,
      ...payload,
      createdAt: now,
      updatedAt: now
    } satisfies WarehouseIntakeRecord,
    source: "firestore" as const,
    writeSucceeded: true
  };
}

export async function markWarehouseIntakeActiveEditor(
  intakeId: string,
  vehicleRecordId: string | undefined,
  actor: VehicleActor
) {
  assertAdminPermissionForActor(actor, "manageVehicles", "Only authorized admins can manage warehouse intake records.");
  if (!intakeId || !isFirebaseConfigured) return;

  await setDoc(
    doc(db, "warehouseIntakes", intakeId),
    sanitizeFirestoreWriteData({
      activeEditorUid: actor.id,
      activeEditorName: getActorDisplayName(actor),
      activeEditorAt: serverTimestamp(),
      assignedStaffUid: actor.id,
      assignedStaffName: getActorDisplayName(actor),
      updatedAt: serverTimestamp()
    }),
    { merge: true }
  );

  if (vehicleRecordId) {
    await setDoc(
      doc(db, "vehicleRecords", vehicleRecordId),
      sanitizeFirestoreWriteData({
        activeIntakeEditorUid: actor.id,
        activeIntakeEditorName: getActorDisplayName(actor),
        activeIntakeEditedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }),
      { merge: true }
    );
  }
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

async function queueDealerApplicationEmail(
  application: DealerApplication,
  status: "info_requested" | "approved" | "rejected",
  note: string
) {
  if (!isFirebaseConfigured) return;

  const recipientEmail = application.contactEmail.trim().toLowerCase();
  if (!recipientEmail || !isValidEmailAddress(recipientEmail)) {
    console.warn("[dealer-email] No valid recipient email resolved for dealer info request.", {
      applicationId: application.id,
      recipientEmail: application.contactEmail
    });
    return;
  }

  const endpoint =
    typeof window !== "undefined"
      ? "/api/dealer-notifications"
      : buildAbsoluteUrl("/api/dealer-notifications");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to: recipientEmail,
        applicationId: application.id,
        businessName: application.legalBusinessName || application.tradingName,
        adminNote: note,
        note,
        status
      }),
      keepalive: true,
      cache: "no-store"
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("[dealer-email] Failed to trigger dealer info request email", {
        applicationId: application.id,
        event: `dealer_${status}`,
        recipientEmail,
        status: response.status,
        body
      });
    }
  } catch (error) {
    console.error("[dealer-email] Failed to reach dealer notification endpoint", {
      applicationId: application.id,
      event: `dealer_${status}`,
      recipientEmail,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function submitDealerApplication(input: DealerApplicationWriteInput, actor: VehicleActor) {
  if (!actor.id) {
    throw new Error("Sign in to apply for a dealer account.");
  }
  if (isAdminLikeRole(actor.role)) {
    throw new Error("Admin accounts do not need a dealer application.");
  }
  if (actor.dealerStatus === "approved" || actor.dealerVerified) {
    throw new Error("This account is already approved as a dealer.");
  }

  const serviceVerification = await verifyDealerLicenceByState(input.licenceState, input.lmctNumber, input.legalBusinessName);
  const existingApplication = await getDealerApplicationByUserId(actor.id);
  if (existingApplication && existingApplication.status !== "info_requested" && isDealerApplicationActive(existingApplication.status)) {
    throw new Error("You already have an active dealer application. Please wait for review or respond to the current information request before submitting again.");
  }

  const cooldownRemaining = existingApplication?.status === "info_requested"
    ? 0
    : getDealerApplicationCooldownRemaining(existingApplication?.lastSubmittedAt);
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
  const referenceId = existingApplication?.referenceId ?? generateDealerReferenceId(lastSubmittedAt);
  const dealerPlan = existingApplication?.dealerPlan ?? existingApplication?.planType ?? "free";
  const shopPublicVisible = existingApplication?.shopPublicVisible ?? existingApplication?.shopVisible ?? false;
  const agreedToDealerTerms = existingApplication?.agreedToDealerTerms ?? existingApplication?.agreedToTerms ?? false;
  const application = {
    id: actor.id,
    userId: actor.id,
    referenceId,
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
    infoRequested: false,
    additionalUploads: [],
    dealerPlan,
    planType: dealerPlan,
    maxListings: existingApplication?.maxListings ?? 3,
    shopPublicVisible,
    shopVisible: shopPublicVisible,
    brandingEnabled: existingApplication?.brandingEnabled ?? false,
    contactDisplayEnabled: existingApplication?.contactDisplayEnabled ?? false,
    agreedToDealerTerms,
    agreedToTerms: agreedToDealerTerms,
    agreedAt: existingApplication?.agreedAt,
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
      referenceId,
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
      infoRequested: false,
      additionalUploads: existingApplication?.additionalUploads ?? [],
      dealerPlan,
      planType: dealerPlan,
      maxListings: existingApplication?.maxListings ?? 3,
      shopPublicVisible,
      shopVisible: shopPublicVisible,
      brandingEnabled: existingApplication?.brandingEnabled ?? false,
      contactDisplayEnabled: existingApplication?.contactDisplayEnabled ?? false,
      ...(existingApplication?.requestedAt ? { requestedAt: Timestamp.fromDate(new Date(existingApplication.requestedAt)) } : { requestedAt: serverTimestamp() }),
      lastSubmittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      reviewedAt: deleteField(),
      reviewedByUid: deleteField(),
      reviewedBy: deleteField(),
      rejectReason: deleteField(),
      infoRequestNote: deleteField()
    },
    { merge: true }
  );

  await setDoc(
    doc(db, "users", actor.id),
    {
      dealerStatus: "pending",
      dealerVerified: false,
      dealerApplicationId: actor.id,
      dealerPlan,
      planType: dealerPlan,
      maxListings: existingApplication?.maxListings ?? 3,
      shopPublicVisible,
      shopVisible: shopPublicVisible,
      brandingEnabled: existingApplication?.brandingEnabled ?? false,
      contactDisplayEnabled: existingApplication?.contactDisplayEnabled ?? false,
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

export async function submitDealerAdditionalInformation(
  applicationId: string,
  input: DealerAdditionalInformationInput,
  actor: VehicleActor
) {
  if (!actor.id) {
    throw new Error("Sign in to update your dealer application.");
  }

  if (actor.id !== applicationId && !isAdminLikeRole(actor.role)) {
    throw new Error("You can only update your own dealer application.");
  }

  const application = await getDealerApplicationByUserId(applicationId);
  if (!application) {
    throw new Error("Dealer application not found.");
  }

  if (application.userId !== actor.id && !isAdminLikeRole(actor.role)) {
    throw new Error("You can only update your own dealer application.");
  }

  if (application.status !== "info_requested") {
    throw new Error("Additional information is only available when CarNest has requested more details.");
  }

  const dealerResponseNote = sanitizeMultilineText(input.dealerResponseNote ?? "");
  const additionalUploads = input.additionalUploads
    .filter((file) => file.url)
    .map((file) => ({
      url: sanitizeSingleLineText(file.url),
      name: file.name ? sanitizeSingleLineText(file.name) : undefined,
      contentType: file.contentType ? sanitizeSingleLineText(file.contentType).toLowerCase() : undefined
    }));

  if (!dealerResponseNote && !additionalUploads.length) {
    throw new Error("Add a response note or upload at least one additional document.");
  }

  const nextAdditionalUploads = [...application.additionalUploads, ...additionalUploads];
  const now = new Date().toISOString();
  const nextApplication = {
    ...application,
    status: "pending_review" as const,
    dealerStatus: "pending" as const,
    infoRequested: false,
    dealerResponseNote: dealerResponseNote || application.dealerResponseNote,
    additionalUploads: nextAdditionalUploads,
    updatedAt: now
  } satisfies DealerApplication;

  if (!isFirebaseConfigured) {
    return {
      application: nextApplication,
      source: "mock" as const,
      writeSucceeded: false
    } satisfies DealerApplicationWriteResult;
  }

  await setDoc(
    doc(db, "dealerApplications", applicationId),
    {
      status: "pending_review",
      dealerStatus: "pending",
      infoRequested: false,
      dealerResponseNote: dealerResponseNote || deleteField(),
      additionalUploads: nextAdditionalUploads,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  await setDoc(
    doc(db, "users", application.userId),
    {
      dealerStatus: "pending",
      dealerVerified: false,
      dealerApplicationId: applicationId,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return {
    application: nextApplication,
    source: "firestore" as const,
    writeSucceeded: true
  } satisfies DealerApplicationWriteResult;
}

export async function acceptDealerTerms(actor: VehicleActor): Promise<DealerTermsAcceptanceResult> {
  if (!actor.id) {
    throw new Error("Sign in to accept dealer terms.");
  }

  if (actor.role !== "dealer" || actor.dealerStatus !== "approved") {
    throw new Error("Dealer terms can only be accepted by approved dealer accounts.");
  }

  const agreedAt = new Date().toISOString();

  if (!isFirebaseConfigured) {
    return {
      agreedToDealerTerms: true,
      agreedToTerms: true,
      agreedAt
    };
  }

  await Promise.all([
    setDoc(
      doc(db, "users", actor.id),
      {
        agreedToDealerTerms: true,
        agreedToTerms: true,
        agreedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    ),
    setDoc(
      doc(db, "dealerApplications", actor.id),
      {
        agreedToDealerTerms: true,
        agreedToTerms: true,
        agreedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    ).catch(() => undefined)
  ]);

  return {
    agreedToDealerTerms: true,
    agreedToTerms: true,
    agreedAt
  };
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
        adminNote: action === "request_info" ? infoRequestNote : application.adminNote,
        infoRequested: action === "request_info" ? true : action === "approve" || action === "reject" ? false : application.infoRequested,
        infoRequestedAt: action === "request_info" ? new Date().toISOString() : application.infoRequestedAt,
        dealerResponseNote: action === "request_info" ? undefined : application.dealerResponseNote,
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
      ...(action === "reject" ? { rejectReason, infoRequested: false, infoRequestNote: deleteField() } : {}),
      ...(action === "request_info" ? {
        adminNote: infoRequestNote,
        infoRequestNote,
        infoRequested: true,
        infoRequestedAt: serverTimestamp(),
        dealerResponseNote: deleteField(),
        rejectReason: deleteField()
      } : {}),
      ...(action === "approve" ? {
        infoRequested: false,
        rejectReason: deleteField(),
        infoRequestNote: deleteField()
      } : {}),
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
            dealerPlan: application.dealerPlan ?? application.planType ?? "free",
            planType: application.dealerPlan ?? application.planType ?? "free",
            maxListings: application.maxListings ?? 3,
            shopPublicVisible: application.shopPublicVisible ?? application.shopVisible ?? false,
            shopVisible: application.shopPublicVisible ?? application.shopVisible ?? false,
            brandingEnabled: application.brandingEnabled ?? false,
            contactDisplayEnabled: application.contactDisplayEnabled ?? false,
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

  if (action === "request_info") {
    await queueDealerApplicationEmail(application, "info_requested", infoRequestNote);
  }

  if (action === "approve") {
    await queueDealerApplicationEmail(application, "approved", "Your application has been approved. Please log in to continue.");
  }

  if (action === "reject") {
    await queueDealerApplicationEmail(application, "rejected", rejectReason);
  }

  return {
      application: {
        ...application,
        dealerStatus,
        status,
        rejectionHistoryCount: action === "reject" ? (application.rejectionHistoryCount ?? 0) + 1 : application.rejectionHistoryCount,
        reviewedBy,
        reviewedByUid: actor.id,
        adminNote: action === "request_info" ? infoRequestNote : application.adminNote,
        infoRequested: action === "request_info" ? true : action === "approve" ? false : application.infoRequested,
        infoRequestedAt: action === "request_info" ? new Date().toISOString() : application.infoRequestedAt,
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

  await writeVehicleActivityEvent(
    id,
    "deleted",
    deleteReason?.trim() ? `Listing deleted. Reason: ${deleteReason.trim()}` : "Listing deleted by admin.",
    actor,
    "admin"
  ).catch(() => null);

  return {
    vehicle: nextVehicle,
    source: "firestore" as const,
    writeSucceeded: true
  };
}

export async function restoreSoftDeletedVehicle(
  id: string,
  actor: VehicleActor,
  existingVehicle?: Vehicle
) {
  assertAdminPermissionForActor(actor, "deleteListings", "You do not have access to restore listings.");

  const targetVehicle = existingVehicle ?? (await getVehicleById(id));
  if (!targetVehicle) {
    throw new Error("Vehicle not found.");
  }

  const restoredVehicle = {
    ...targetVehicle,
    deleted: false,
    deletedAt: "",
    deletedBy: "",
    deleteReason: "",
    updatedAt: new Date().toISOString()
  } satisfies Vehicle;

  if (!isFirebaseConfigured) {
    return {
      vehicle: restoredVehicle,
      source: "mock" as const,
      writeSucceeded: false
    };
  }

  await setDoc(
    doc(db, "vehicles", id),
    {
      deleted: false,
      deletedAt: deleteField(),
      deletedBy: deleteField(),
      deleteReason: deleteField(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  await writeVehicleActivityEvent(id, "restored", "Listing restored and made available for moderation again.", actor, "admin").catch(
    () => null
  );

  return {
    vehicle: restoredVehicle,
    source: "firestore" as const,
    writeSucceeded: true
  };
}

async function deleteDocumentsByVehicleId(collectionName: string, vehicleId: string) {
  let deletedCount = 0;

  while (true) {
    const snapshot = await getDocs(query(collection(db, collectionName), where("vehicleId", "==", vehicleId), limit(200)));
    if (snapshot.empty) break;

    const batch = writeBatch(db);
    snapshot.docs.forEach((item) => batch.delete(item.ref));
    deletedCount += snapshot.size;
    await batch.commit();
  }

  return deletedCount;
}

export async function permanentlyDeleteVehicle(
  id: string,
  actor: VehicleActor,
  existingVehicle?: Vehicle
) {
  assertAdminPermissionForActor(actor, "deleteListings", "You do not have access to permanently delete listings.");

  const targetVehicle = existingVehicle ?? (await getVehicleById(id));
  if (!targetVehicle) {
    throw new Error("Vehicle not found.");
  }

  if (!isFirebaseConfigured) {
    return {
      deletedVehicleId: id,
      source: "mock" as const,
      writeSucceeded: false
    };
  }

  await Promise.all([
    deleteDocumentsByVehicleId("vehicleActivityEvents", id),
    deleteDocumentsByVehicleId("vehicleViewEvents", id),
    deleteDocumentsByVehicleId("vehicleViewVisitors", id),
    deleteDocumentsByVehicleId("offers", id),
    deleteDocumentsByVehicleId("inspectionRequests", id),
    deleteDocumentsByVehicleId("savedVehicles", id)
  ]);

  const cleanupBatch = writeBatch(db);
  cleanupBatch.delete(doc(db, "vehicles", id));
  cleanupBatch.delete(doc(db, "vehicleAnalytics", id));
  cleanupBatch.delete(doc(db, "vehicle_private", id));
  await cleanupBatch.commit();

  return {
    deletedVehicleId: id,
    source: "firestore" as const,
    writeSucceeded: true
  };
}

export async function updateVehicleCustomerEmail(
  id: string,
  customerEmail: string,
  actor: VehicleActor,
  existingVehicle?: Vehicle
) {
  assertAdminPermissionForActor(actor, "manageVehicles", "Only authorized admins can update the customer email.");

  const baseVehicle = existingVehicle ?? (await getVehicleById(id));
  if (!baseVehicle) {
    throw new Error("Vehicle not found.");
  }

  const normalizedCustomerEmail = normalizeCustomerEmailList(customerEmail);

  const nextVehicle = {
    ...baseVehicle,
    customerEmail: normalizedCustomerEmail,
    updatedAt: new Date().toISOString()
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
      customerEmail: normalizedCustomerEmail,
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
    customerEmail: normalizeCustomerEmailList(input.customerEmail ?? ""),
    customerName: sanitizeSingleLineText(input.customerName ?? ""),
    description: sanitizeMultilineText(input.description),
    imageAssets: Array.isArray(input.imageAssets)
      ? input.imageAssets.filter((item) => Boolean(item?.thumbnailUrl) && Boolean(item?.fullUrl))
      : [],
    serviceQuoteNotes: sanitizeMultilineText(input.serviceQuoteNotes ?? "")
  };
}

function buildVehiclePayload(input: VehicleFormInput, actor: VehicleActor, existingVehicle?: Vehicle) {
  const normalizedInput = normalizeVehicleInput(input);
  const ownerUid = existingVehicle?.ownerUid ?? actor.id;
  const ownerRole = existingVehicle?.ownerRole ?? (isAdminLikeRole(actor.role) ? "admin" : "seller");
  const imageAssets = normalizedInput.imageAssets ?? [];
  const galleryImages = imageAssets.length
    ? imageAssets.map((item) => item.fullUrl)
    : normalizedInput.imageUrls.length
      ? normalizedInput.imageUrls
      : normalizedInput.images;
  const coverThumbnail = imageAssets[0]?.thumbnailUrl || normalizedInput.coverImage || normalizedInput.coverImageUrl || galleryImages[0] || "";
  const coverFull = imageAssets[0]?.fullUrl || normalizedInput.coverImageUrl || normalizedInput.coverImage || galleryImages[0] || "";
  const coverImage =
    coverThumbnail;

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
    customerEmail:
      normalizedInput.listingType === "warehouse"
        ? normalizedInput.customerEmail ?? ""
        : existingVehicle?.customerEmail ?? "",
    customerName:
      normalizedInput.listingType === "warehouse"
        ? normalizedInput.customerName || null
        : existingVehicle?.customerName ?? null,
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
    coverImageUrl: coverFull,
    imageAssets,
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

function removeVehicleImageAsset(imageAssets: VehicleImageAsset[], imageUrl: string) {
  const imageIndex = imageAssets.findIndex((item) => item.fullUrl === imageUrl || item.thumbnailUrl === imageUrl);
  if (imageIndex < 0) return imageAssets;

  return [...imageAssets.slice(0, imageIndex), ...imageAssets.slice(imageIndex + 1)];
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
  validateCustomerContactEmail(normalizeVehicleInput(input), actor);

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

  await writeVehicleActivityEvent(
    ref.id,
    "vehicle_submitted",
    isAdminLikeRole(actor.role)
      ? "Vehicle listing created in the admin workspace."
      : "Vehicle submitted for review.",
    actor,
    "admin"
  ).catch(() => null);

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

  await syncVehicleRecordFromPublicListing(vehicle, actor, "created").catch(() => undefined);

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
  validateCustomerContactEmail(normalizedInput, actor);
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

  await writeVehicleActivityEvent(
    id,
    "edited",
    isAdminLikeRole(actor.role)
      ? "Vehicle details were updated in the admin workspace."
      : "Vehicle details were updated by the seller.",
    actor,
    "admin"
  ).catch(() => null);

  const vehicle = {
    id,
    ...moderatedPayload,
    pendingDescription: adminDescriptionChanged ? "" : pendingDescription,
    createdAt: baseVehicle.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString()
  } satisfies Vehicle;

  await syncVehicleRecordFromPublicListing(vehicle, actor, "updated").catch(() => undefined);

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

  const existingImageAssets = baseVehicle.imageAssets ?? [];
  const existingImageUrls = baseVehicle.imageUrls?.length ? baseVehicle.imageUrls : baseVehicle.images ?? [];
  if (!existingImageUrls.includes(imageUrl)) {
    throw new Error("Image not found on this vehicle.");
  }

  if (existingImageUrls.length <= 1) {
    throw new Error("Upload a replacement before removing the final saved image.");
  }

  const nextImageUrls = removeVehicleImageUrl(existingImageUrls, imageUrl);
  const nextImageAssets = removeVehicleImageAsset(existingImageAssets, imageUrl);
  const nextCoverImage = nextImageAssets[0]?.thumbnailUrl ?? nextImageUrls[0] ?? "";
  const nextCoverImageUrl = nextImageAssets[0]?.fullUrl ?? nextImageUrls[0] ?? "";
  const removedAsset = existingImageAssets.find((item) => item.fullUrl === imageUrl || item.thumbnailUrl === imageUrl);

  if (!isFirebaseConfigured) {
    const vehicle = {
      ...baseVehicle,
      coverImage: nextCoverImage,
      coverImageUrl: nextCoverImageUrl,
      imageAssets: nextImageAssets,
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
    coverImageUrl: nextCoverImageUrl,
    imageAssets: nextImageAssets,
    imageUrls: nextImageUrls,
    images: nextImageUrls,
    updatedAt: serverTimestamp()
  });

  const storageDeleteSucceeded = await deleteVehicleImageFiles(
    removedAsset ? [removedAsset.fullUrl, removedAsset.thumbnailUrl] : [imageUrl]
  );

  const vehicle = {
    ...baseVehicle,
    coverImage: nextCoverImage,
    coverImageUrl: nextCoverImageUrl,
    imageAssets: nextImageAssets,
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
  await writeVehicleActivityEvent(
    id,
    status === "approved" ? "approved" : "rejected",
    status === "approved" ? "Listing approved for public visibility." : "Listing rejected during moderation.",
    actor,
    "admin"
  ).catch(() => null);

  const approvedAt = status === "approved" ? baseVehicle.approvedAt || new Date().toISOString() : "";
  const vehicle = {
    ...baseVehicle,
    status,
    approvedAt,
    updatedAt: new Date().toISOString()
  } satisfies Vehicle;

  await syncVehicleRecordFromPublicListing(vehicle, actor, "listing_status_changed").catch(() => undefined);
  await writeAdminOperationalEvent({
    actor,
    recordType: "public_listing",
    actionType: "listing_status_changed",
    affectedRecordId: id,
    publicListingId: id,
    summary: `${getVehicleDisplayReference(vehicle)} moderation status changed to ${status}.`
  }).catch(() => undefined);

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
  await writeVehicleActivityEvent(
    id,
    sellerStatus === "SOLD" ? "marked_as_sold" : "undo_sold",
    sellerStatus === "SOLD" ? "Listing marked as sold." : "Sold status removed and listing returned to available.",
    actor,
    "admin"
  ).catch(() => null);

  const vehicle = {
    ...baseVehicle,
    sellerStatus,
    underOfferBuyerUid: sellerStatus === "UNDER_OFFER" ? baseVehicle.underOfferBuyerUid ?? "" : "",
    soldAt,
    updatedAt: new Date().toISOString()
  } satisfies Vehicle;

  await syncVehicleRecordFromPublicListing(vehicle, actor, "listing_status_changed").catch(() => undefined);
  await writeAdminOperationalEvent({
    actor,
    recordType: "public_listing",
    actionType: "listing_status_changed",
    affectedRecordId: id,
    publicListingId: id,
    summary: `${getVehicleDisplayReference(vehicle)} seller status changed to ${sellerStatus.toLowerCase().replace(/_/g, " ")}.`
  }).catch(() => undefined);

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
    await writeVehicleActivityEvent(
      input.vehicleId,
      "offer_created",
      "Activity update: a new offer has been made on a vehicle you saved.",
      {
        id: input.userId,
        email: buyerEmail,
        name: buyerName
      },
      "customer"
    );
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
