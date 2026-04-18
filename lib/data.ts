import { Timestamp, addDoc, collection, deleteField, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { isValidEmailAddress } from "@/lib/form-safety";
import { sampleVehicles } from "@/lib/constants";
import { createAdminPermissions, createSuperAdminPermissions, hasAdminPermission, isAdminLikeRole, isSuperAdminUser, resolveManagedUserAccess } from "@/lib/permissions";
import { deleteVehicleImageFile } from "@/lib/storage";
import {
  AdminPermissions,
  AppUser,
  ContactMessage,
  ContactMessageCategory,
  ContactMessageStatus,
  InspectionRequest,
  InspectionRequestStatus,
  Offer,
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
  Vehicle,
  VehicleActor,
  VehicleAnalytics,
  VehicleAnalyticsBreakdown,
  VehicleFormInput,
  VehicleStatus,
  VehicleViewEvent,
  VehicleViewRole,
  VehicleDeviceType
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
    storedRole: typeof data.role === "string" ? data.role : "buyer",
    storedPermissions: data.adminPermissions && typeof data.adminPermissions === "object" ? (data.adminPermissions as Record<string, boolean>) : undefined
  });

  return {
    id,
    email,
    displayName: String(data.displayName ?? data.name ?? "CarNest User"),
    name: typeof data.name === "string" ? data.name : String(data.displayName ?? "CarNest User"),
    phone: typeof data.phone === "string" ? data.phone : "",
    accountReference: typeof data.accountReference === "string" ? data.accountReference : undefined,
    role: managedAccess.role,
    adminPermissions: normalizeAdminPermissions(data.adminPermissions, managedAccess.role, email),
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
    coverImage,
    coverImageUrl,
    imageUrls,
    images: imageUrls,
    soldAt: serializeDate(data.soldAt),
    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt)
  } as Vehicle;
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
    || status === "accepted_pending_buyer_confirmation"
    || status === "buyer_confirmed"
    || status === "buyer_declined"
    || status === "rejected"
  ) {
    return status;
  }

  if (status === "accepted") {
    return "buyer_confirmed";
  }

  if (status === "declined" || status === "withdrawn") {
    return "rejected";
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
    const snapshot = await getDocs(query(collection(db, "vehicles"), where("ownerUid", "==", ownerUid)));
    const items = snapshot.docs
      .map((item) => serializeVehicleDoc(item.id, item.data()))
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
      (vehicle) => vehicle.status === "approved" && (vehicle.sellerStatus === "ACTIVE" || vehicle.sellerStatus === "UNDER_OFFER")
    ),
    source: result.source,
    error: result.error
  };
}

export async function listSoldVehicles() {
  const result = await getCollection<Vehicle>("vehicles", sampleVehicles, serializeVehicleDoc);
  return {
    vehicles: result.items.filter((vehicle) => vehicle.sellerStatus === "SOLD"),
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
  const result = await getCollection<AppUser>("users", fallback, serializeUserDoc);
  return result.items;
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
      .map((item) => serializeDoc<SavedVehicle>(item.id, item.data()))
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
      .map((item) => serializeDoc<SavedVehicle>(item.id, item.data()))
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

export async function getSavedVehiclesWithDetails(userId: string) {
  const result = await getSavedVehiclesData(userId);
  const vehicles = (
    await Promise.all(
      result.items.map(async (savedVehicle) => {
        try {
          const vehicle = await getVehicleById(savedVehicle.vehicleId);
          return vehicle ? { savedVehicle, vehicle } : null;
        } catch {
          return null;
        }
      })
    )
  ).filter((item): item is { savedVehicle: SavedVehicle; vehicle: Vehicle } => Boolean(item));

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
  const finalPermissions = finalRole === "buyer" || finalRole === "seller" ? buildManagedPermissions(finalRole, input.adminPermissions) : managedTarget.adminPermissions;

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
  if (!isAdminLikeRole(actor.role) && actor.role !== "seller") {
    throw new Error("Only admins and sellers can manage vehicles.");
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

  if (actor.role === "seller" && existingVehicle.status === "approved") {
    return "pending";
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
    serviceHistory: toUppercaseValue(input.serviceHistory),
    keyCount: toUppercaseValue(input.keyCount),
    sellerLocationSuburb: toUppercaseValue(input.sellerLocationSuburb),
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

function removeVehicleImageUrl(imageUrls: string[], imageUrl: string) {
  const imageIndex = imageUrls.indexOf(imageUrl);
  if (imageIndex < 0) return imageUrls;

  return [...imageUrls.slice(0, imageIndex), ...imageUrls.slice(imageIndex + 1)];
}

export async function createVehicle(input: VehicleFormInput, actor: VehicleActor) {
  assertVehicleManager(actor);
  if (isAdminLikeRole(actor.role)) {
    assertAdminPermissionForActor(actor, "manageVehicles", "You do not have access to manage vehicles.");
  }

  if (actor.role === "seller" && isFirebaseConfigured) {
    const recentVehicles = await findRecentVehiclesForOwner(actor.id);
    const submissionsInDay = recentVehicles.filter((vehicle) => isWithinWindow(vehicle.createdAt, 24 * 60 * 60 * 1000));
    if (submissionsInDay.length >= 3) {
      throw new Error("Too many requests. Please try again later.");
    }
  }

  if (!isFirebaseConfigured) {
    const vehicle = {
      id: `${actor.role}-sample-${Date.now()}`,
      ...buildVehiclePayload(input, actor),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } satisfies Vehicle;

    return {
      vehicle,
      source: "mock" as const,
      writeSucceeded: false
    } satisfies VehicleWriteResult;
  }

  const payload = {
    ...buildVehiclePayload(input, actor),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, "vehicles"), payload);
  const vehicle = {
    id: ref.id,
    ...buildVehiclePayload(input, actor),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  } satisfies Vehicle;

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

    const vehicle = {
      id,
      ...buildVehiclePayload(input, actor, baseVehicle),
      createdAt: baseVehicle.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } satisfies Vehicle;

    return {
      vehicle,
      source: "mock" as const,
      writeSucceeded: false
    } satisfies VehicleWriteResult;
  }

  const baseVehicle = existingVehicle ?? (await getVehicleById(id));
  if (!baseVehicle) {
    throw new Error("Vehicle not found.");
  }
  assertVehicleOwnership(actor, baseVehicle);

  await updateDoc(doc(db, "vehicles", id), {
    ...buildVehiclePayload(input, actor, baseVehicle),
    updatedAt: serverTimestamp()
  });

  const vehicle = {
    id,
    ...buildVehiclePayload(input, actor, baseVehicle),
    createdAt: baseVehicle.createdAt ?? new Date().toISOString(),
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
    const vehicle = {
      ...baseVehicle,
      status,
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
    updatedAt: serverTimestamp()
  });

  const vehicle = {
    ...baseVehicle,
    status,
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
  if (actor.role !== "seller" && !isAdminLikeRole(actor.role)) {
    throw new Error("Only sellers and admins can update seller listing status.");
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
  if (!isAdminLikeRole(actor.role) && actor.role !== "seller") {
    throw new Error("Only admins and sellers can update inspection requests.");
  }
  if (isAdminLikeRole(actor.role)) {
    assertAdminPermissionForActor(actor, "manageInspections", "You do not have access to manage inspection requests.");
  }

  const inspectionRequest = existingInspectionRequest ?? (await getInspectionRequestById(id));
  if (!inspectionRequest) {
    throw new Error("Inspection request not found.");
  }

  if (actor.role === "seller" && inspectionRequest.sellerOwnerUid !== actor.id) {
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

  if (sender === "buyer" && offer.status !== "pending") {
    throw new Error("Buyer replies are only available while the offer is still pending.");
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

  if (offer.status !== "pending") {
    throw new Error("Price updates are only available while the offer is still pending.");
  }

  const isOfferSeller = offer.listingOwnerUid === actor.id;
  const isOfferBuyer = offer.buyerUid === actor.id;

  if (sender === "seller" && !isOfferSeller && !isAdminLikeRole(actor.role)) {
    throw new Error("You can only counter offers for your own listings.");
  }

  if (sender === "buyer" && !isOfferBuyer && !isAdminLikeRole(actor.role)) {
    throw new Error("You can only revise your own offers.");
  }

  const minimumOffer = Math.max(1000, Math.round(offer.vehiclePrice * 0.5));
  if (nextAmount < minimumOffer) {
    throw new Error("Please enter a realistic offer amount.");
  }

  const nextEntry = buildOfferUpdateForReturn(sender, nextAmount);
  const nextMessages = [...offer.messages, nextEntry];
  const nextBuyerViewed = sender === "seller" ? false : true;
  const nextSellerViewed = sender === "seller" ? true : false;

  if (!isFirebaseConfigured) {
    return {
      offer: {
        ...offer,
        amount: nextAmount,
        offerAmount: nextAmount,
        messages: nextMessages,
        buyerViewed: nextBuyerViewed,
        sellerViewed: nextSellerViewed,
        lastUpdatedBy: sender,
        updatedAt: new Date().toISOString()
      },
      source: "mock" as const,
      writeSucceeded: false
    } satisfies OfferWriteResult;
  }

  await updateDoc(doc(db, "offers", id), {
    amount: nextAmount,
    offerAmount: nextAmount,
    messages: [...offer.messages.map(toStoredOfferThreadEntry), buildOfferThreadEntryForWrite(nextEntry)],
    buyerViewed: nextBuyerViewed,
    sellerViewed: nextSellerViewed,
    lastUpdatedBy: sender,
    updatedAt: serverTimestamp()
  });

  return {
    offer: {
      ...offer,
      amount: nextAmount,
      offerAmount: nextAmount,
      messages: nextMessages,
      buyerViewed: nextBuyerViewed,
      sellerViewed: nextSellerViewed,
      lastUpdatedBy: sender,
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
  const pendingUpdates = offers.filter((offer) => offer.status === "pending" && !offer.sellerViewed);

  await Promise.all(
    pendingUpdates.map((offer) =>
      updateDoc(doc(db, "offers", offer.id), {
        sellerViewed: true,
        updatedAt: serverTimestamp()
      })
    )
  );
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

  const nextRespondedAt =
    status === "accepted_pending_buyer_confirmation" || status === "rejected"
      ? new Date().toISOString()
      : offer.respondedAt ?? null;

  const nextBuyerViewed =
    status === "accepted_pending_buyer_confirmation" || status === "rejected"
      ? false
      : status === "buyer_confirmed" || status === "buyer_declined"
        ? true
        : offer.buyerViewed;

  const nextSellerViewed =
    status === "accepted_pending_buyer_confirmation" || status === "rejected"
      ? true
      : status === "buyer_confirmed" || status === "buyer_declined"
        ? true
        : offer.sellerViewed;

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

  const nextVehiclePatch =
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

  if (!isFirebaseConfigured) {
    return {
      offer: {
        ...offer,
        status,
        buyerViewed: nextBuyerViewed,
        sellerViewed: nextSellerViewed,
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
    respondedAt:
      status === "accepted_pending_buyer_confirmation" || status === "rejected"
        ? serverTimestamp()
        : nextRespondedAt,
    updatedAt: serverTimestamp()
  });

  await batch.commit();

  return {
    offer: {
      ...offer,
      status,
      buyerViewed: nextBuyerViewed,
      sellerViewed: nextSellerViewed,
      respondedAt: nextRespondedAt,
      updatedAt: new Date().toISOString()
    },
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
