export type UserRole = "buyer" | "seller" | "dealer" | "admin" | "super_admin";
export type ComplianceStatus = "clear" | "possible_unlicensed_trader" | "verified_dealer";
export type DealerStatus = "none" | "pending" | "info_requested" | "approved" | "rejected";
export type AdminPermissionKey =
  | "manageVehicles"
  | "manageOffers"
  | "manageEnquiries"
  | "manageInspections"
  | "managePricing"
  | "manageQuotes"
  | "manageUsers"
  | "manageAdmins";
export type AdminPermissions = Record<AdminPermissionKey, boolean>;
export type ListingType = "warehouse" | "private";
export type VehicleStatus = "pending" | "approved" | "rejected";
export type SellerVehicleStatus = "ACTIVE" | "UNDER_OFFER" | "PAUSED" | "WITHDRAWN" | "SOLD";
export type OfferMessageSender = "buyer" | "seller";
export type OfferThreadEntryType = "message" | "offer_update";
export type OfferContactUnlockSource = "buyer_confirm" | "seller_manual";
export type OfferStatus =
  | "pending"
  | "accepted_pending_buyer_confirmation"
  | "buyer_confirmed"
  | "buyer_declined"
  | "rejected";
export type InspectionRequestStatus = "NEW" | "CONTACTED" | "BOOKED" | "CLOSED";
export type QuoteStatus = "NEW" | "CONTACTED" | "QUOTED" | "CLOSED";
export type QuoteType = "SERVICE_SUPPORT" | "WAREHOUSE_UPGRADE";
export type QuoteSource = "sell_flow" | "seller_edit";
export type ContactMessageCategory = "SELLING MY CAR" | "BUYING A CAR" | "SECURE WAREHOUSE STORAGE" | "GENERAL ENQUIRY";
export type ContactMessageStatus = "NEW" | "CONTACTED" | "CLOSED";
export type PricingRequestTimeline = "ASAP (within 2 weeks)" | "2–4 weeks" | "1–2 months" | "Just exploring";
export type PricingRequestStatus = "NEW" | "REPLIED" | "CLOSED";
export type PricingLeadRating = "HOT" | "WARM" | "COLD";
export type PricingNextAction = "Recommend warehouse" | "Follow up later" | "Not suitable";
export type VehicleViewRole = "guest" | UserRole;
export type VehicleDeviceType = "mobile" | "tablet" | "desktop";

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  name?: string;
  phone?: string;
  accountReference?: string;
  role: UserRole;
  adminPermissions?: AdminPermissions;
  complianceStatus?: ComplianceStatus;
  complianceFlaggedAt?: string;
  dealerStatus?: DealerStatus;
  dealerVerified?: boolean;
  dealerApplicationId?: string;
  listingRestricted?: boolean;
  createdAt?: string;
}

export interface Vehicle {
  id: string;
  sellerId: string;
  ownerUid: string;
  ownerRole: "seller" | "admin";
  listingType: ListingType;
  status: VehicleStatus;
  sellerStatus: SellerVehicleStatus;
  ownershipVerified: boolean;
  publishAuthorized: boolean;
  approvedAt?: string;
  storedInWarehouse: boolean;
  warehouseAddress?: string;
  sellerLocationSuburb?: string;
  sellerLocationPostcode?: string;
  sellerLocationState?: string;
  make: string;
  model: string;
  variant: string;
  year: number;
  price: number;
  mileage: number;
  transmission: string;
  fuelType: string;
  drivetrain: string;
  bodyType: string;
  colour: string;
  vin: string;
  rego: string;
  regoExpiry?: string;
  description: string;
  pendingDescription?: string;
  manualReviewReason?: "possible_unlicensed_trader";
  features: string[];
  conditionNotes: string;
  serviceHistory: string;
  keyCount: string;
  displayReference?: string;
  coverImage?: string;
  coverImageUrl?: string;
  imageUrls: string[];
  images: string[];
  submissionPreference?: "basic" | "service_quote";
  serviceQuoteNotes?: string;
  underOfferBuyerUid?: string;
  soldAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VehicleFormInput {
  listingType: ListingType;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  transmission: string;
  fuelType: string;
  drivetrain: string;
  bodyType: string;
  colour: string;
  regoExpiry?: string;
  serviceHistory: string;
  keyCount: string;
  sellerLocationSuburb?: string;
  sellerLocationPostcode?: string;
  sellerLocationState?: string;
  description: string;
  coverImage?: string;
  coverImageUrl?: string;
  imageUrls: string[];
  images: string[];
  submissionPreference?: "basic" | "service_quote";
  serviceQuoteNotes?: string;
}

export interface VehicleFormFieldsValue {
  year: string;
  make: string;
  model: string;
  price: string;
  mileage: string;
  transmission: string;
  fuelType: string;
  drivetrain: string;
  bodyType: string;
  colour: string;
  regoExpiry: string;
  serviceHistory: string;
  keyCount: string;
  sellerLocationSuburb: string;
  sellerLocationPostcode: string;
  sellerLocationState: string;
  description: string;
}

export interface VehicleActor {
  id: string;
  role: UserRole;
  email?: string;
  adminPermissions?: AdminPermissions;
  dealerVerified?: boolean;
  listingRestricted?: boolean;
  possibleUnlicensedTrader?: boolean;
  dealerStatus?: DealerStatus;
}

export interface Enquiry {
  id: string;
  vehicleId: string;
  buyerId: string;
  sellerId: string;
  message: string;
  createdAt?: string;
}

export interface OfferThreadEntry {
  type: OfferThreadEntryType;
  sender: OfferMessageSender;
  text?: string;
  amount?: number;
  createdAt?: string;
}

export interface Offer {
  id: string;
  buyerUid: string;
  listingOwnerUid: string;
  vehicleId: string;
  vehicleTitle: string;
  vehiclePrice: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  amount: number;
  message: string;
  messages: OfferThreadEntry[];
  buyerViewed: boolean;
  sellerViewed: boolean;
  contactUnlocked: boolean;
  contactUnlockedAt?: string | null;
  contactUnlockedBy?: OfferContactUnlockSource | null;
  lastUpdatedBy?: OfferMessageSender;
  submittedByUid?: string;
  status: OfferStatus;
  createdAt?: string;
  updatedAt?: string;
  respondedAt?: string | null;
  userId?: string;
  offerAmount?: number;
  sellerOwnerUid?: string;
}

export interface InspectionRequest {
  id: string;
  vehicleId: string;
  vehicleTitle: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  preferredTime: string;
  message: string;
  status: InspectionRequestStatus;
  listingType: ListingType;
  sellerOwnerUid: string;
  submittedByUid?: string;
  createdAt?: string;
}

export interface SavedVehicle {
  id: string;
  userId: string;
  vehicleId: string;
  createdAt?: string;
  lastViewedActivityAt?: string;
}

export interface VehicleActivityEvent {
  id: string;
  vehicleId: string;
  type: "offer_created";
  message: string;
  createdAt?: string;
  actorUid?: string;
}

export interface ComplianceVehicleActivity {
  vehicleId: string;
  eventType: "listing_created" | "listing_published" | "listing_sold";
  qualifyingAt: string;
}

export interface ComplianceAlert {
  id: string;
  userId: string;
  alertType: "possible_unlicensed_trader";
  status: "open" | "resolved";
  activityCount: number;
  activities: ComplianceVehicleActivity[];
  triggeredByVehicleId?: string;
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string;
}

export interface UserComplianceAssessment {
  userId: string;
  rolling12MonthCount: number;
  activities: ComplianceVehicleActivity[];
  status: ComplianceStatus;
  thresholdReached: boolean;
}

export interface DealerApplication {
  id: string;
  userId: string;
  legalBusinessName: string;
  tradingName: string;
  acnOrAbn: string;
  lmctNumber: string;
  licenceState: string;
  licenceExpiry: string;
  businessAddress: string;
  phone: string;
  email: string;
  contactPerson: string;
  lmctCertificateUrl: string;
  lmctCertificateName?: string;
  status: Exclude<DealerStatus, "none">;
  requestedAt?: string;
  updatedAt?: string;
  reviewedAt?: string;
  reviewedByUid?: string;
}

export interface VehicleViewEvent {
  id: string;
  vehicleId: string;
  viewedAt?: string;
  sessionId: string;
  userId?: string;
  role: VehicleViewRole;
  source: string;
  referrer: string;
  deviceType: VehicleDeviceType;
  country?: string;
  state?: string;
  city?: string;
  listingType: ListingType;
  sellerOwnerUid: string;
}

export interface VehicleAnalyticsBreakdown {
  label: string;
  count: number;
}

export interface VehicleAnalytics {
  id: string;
  vehicleId: string;
  sellerOwnerUid: string;
  totalViews: number;
  uniqueVisitors: number;
  views7d: number;
  views30d: number;
  saves: number;
  saves7d: number;
  saves30d: number;
  offers: number;
  offers7d: number;
  offers30d: number;
  inspections: number;
  inspections7d: number;
  inspections30d: number;
  topCities: VehicleAnalyticsBreakdown[];
  topStates: VehicleAnalyticsBreakdown[];
  topSources: VehicleAnalyticsBreakdown[];
  updatedAt?: string;
}

export interface SellerTrustInfo {
  sellerType: "Private Seller";
  memberSince?: string;
  vehiclesSoldCount: number;
}

export interface Quote {
  id: string;
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
  status: QuoteStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  category: ContactMessageCategory;
  status: ContactMessageStatus;
  createdAt?: string;
}

export interface PricingRequest {
  id: string;
  userId: string;
  vehicleId?: string;
  currentPrice?: number;
  timeline: PricingRequestTimeline;
  message: string;
  status: PricingRequestStatus;
  leadRating?: PricingLeadRating;
  nextAction?: PricingNextAction;
  createdAt?: string;
  response?: string;
  respondedAt?: string;
}

export interface ViewingRequest {
  id: string;
  vehicleId: string;
  buyerId: string;
  sellerId: string;
  preferredDate: string;
  status: "pending" | "approved" | "declined";
  fulfillmentNote?: string;
  createdAt?: string;
}

export interface ChangeRequest {
  id: string;
  vehicleId: string;
  sellerId: string;
  field: "price" | "vehicleInfo";
  requestedValue: string;
  reason: string;
  status: "pending" | "approved" | "declined";
  createdAt?: string;
}
