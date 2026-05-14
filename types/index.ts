export type UserRole = "buyer" | "seller" | "dealer" | "admin" | "super_admin";
export type AccountType = "private" | "dealer";
export type ComplianceStatus = "clear" | "possible_unlicensed_trader" | "verified_dealer";
export type DealerStatus = "none" | "submitted_unverified" | "pending" | "pending_review" | "info_requested" | "approved" | "rejected";
export type DealerLicenceVerificationStatus = "verified" | "manual_review_required" | "auto_failed";
export type DealerApplicationRiskLevel = "low" | "medium" | "high";
export type DealerPlanType = "free" | "starter" | "growth" | "pro" | "tier1" | "tier2" | "tier3";
export type AdminPermissionKey =
  | "manageVehicles"
  | "deleteListings"
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
export type OfferContactUnlockSource =
  | "buyer_confirm"
  | "seller_manual"
  | "seller_accept"
  | "buyer_counter_accept";
export type OfferContactVisibilityState = "hidden" | "shared_after_accept" | "shared_after_counter_accept";
export type OfferStatus =
  | "pending"
  | "countered"
  | "accepted"
  | "declined"
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
export type VehicleActivityVisibility = "admin" | "customer";
export type WarehouseIntakeStatus = "draft" | "review_ready" | "signed";
export type WarehouseDeclarationAnswer = "yes" | "no" | "unknown";
export type WarehouseConditionStatus = "documented" | "not_checked";
export type CustomerProfileStatus = "active" | "archived";
export type VehicleListingHistoryStatus = "draft" | "published" | "under_offer" | "withdrawn" | "sold" | "warehouse_managed";
export type VehicleRecordStatus =
  | "draft"
  | "active"
  | "archived"
  | "warehouse_managed"
  | "private_seller_managed"
  | "listed"
  | "under_offer"
  | "sold"
  | "withdrawn";
export type WarehousePreferredContactMethod = "phone" | "email" | "sms" | "whatsapp" | "wechat" | "either" | "other";
export type WarehouseIdentificationDocumentType = "" | "driver_licence" | "passport" | "other";
export type AdminAuditRecordType = "customer_profile" | "vehicle_record" | "warehouse_intake" | "public_listing" | "user_access";
export type AdminAuditActionType =
  | "created"
  | "updated"
  | "listing_status_changed"
  | "linked_listing_synced"
  | "intake_completed"
  | "fees_updated"
  | "editor_heartbeat"
  | "role_changed";
export type WarehouseServiceFeeCategory =
  | "car_wash"
  | "light_detailing"
  | "paint_correction"
  | "interior_restoration"
  | "minor_repair"
  | "tyres"
  | "battery"
  | "roadworthy_certificate"
  | "coordination_service_fee"
  | "storage_fee"
  | "sundry"
  | "other";
export type VehicleActivityType =
  | "offer_created"
  | "vehicle_submitted"
  | "approved"
  | "rejected"
  | "edited"
  | "marked_as_sold"
  | "undo_sold"
  | "deleted"
  | "restored"
  | "admin_note_added"
  | "warehouse_activity_added";

export interface VehicleImageAsset {
  thumbnailUrl: string;
  fullUrl: string;
}

export interface PreparedVehicleImageUpload {
  id: string;
  sourceName: string;
  thumbnailFile: File;
  fullFile: File;
  previewUrl: string;
}

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  name?: string;
  photoURL?: string;
  phone?: string;
  emailVerified?: boolean;
  accountBanned?: boolean;
  accountReference?: string;
  role: UserRole;
  accountType?: AccountType;
  adminPermissions?: AdminPermissions;
  complianceStatus?: ComplianceStatus;
  complianceFlaggedAt?: string;
  dealerStatus?: DealerStatus;
  dealerVerified?: boolean;
  dealerApplicationId?: string;
  agreedToDealerTerms?: boolean;
  agreedToTerms?: boolean;
  agreedAt?: string;
  dealerPlan?: DealerPlanType;
  planType?: DealerPlanType;
  maxListings?: number;
  shopPublicVisible?: boolean;
  shopVisible?: boolean;
  brandingEnabled?: boolean;
  contactDisplayEnabled?: boolean;
  listingRestricted?: boolean;
  lastLoginAt?: string;
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
  isManagedByCarnest?: boolean;
  approvedAt?: string;
  storedInWarehouse: boolean;
  warehouseAddress?: string;
  sellerLocationSuburb?: string;
  sellerLocationPostcode?: string;
  sellerLocationState?: string;
  customerEmail?: string;
  customerName?: string | null;
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
  imageAssets?: VehicleImageAsset[];
  imageUrls: string[];
  images: string[];
  submissionPreference?: "basic" | "service_quote";
  serviceQuoteNotes?: string;
  underOfferBuyerUid?: string;
  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deleteReason?: string;
  viewCount?: number;
  uniqueViewCount?: number;
  lastViewedAt?: string;
  soldAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WarehouseIntakeFileRecord {
  storagePath: string;
  name: string;
  uploadedAt?: string;
  contentType?: string;
}

export interface WarehouseConditionItem {
  condition: WarehouseConditionStatus;
  documented: boolean;
  notes: string;
}

export interface WarehouseIntakePhotoRecord {
  id: string;
  category: string;
  label: string;
  storagePath: string;
  name?: string;
  uploadedAt?: string;
  contentType?: string;
}

export interface WarehouseIntakeOwnerDetails {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth: string;
  preferredContactMethod: WarehousePreferredContactMethod;
  customerVerificationNotes: string;
  identificationDocumentType: WarehouseIdentificationDocumentType;
  identificationDocumentNumber: string;
  companyOwned: boolean;
  companyName: string;
  abn: string;
  acn: string;
  identificationDocument?: WarehouseIntakeFileRecord | null;
  isLegalOwnerConfirmed: boolean;
}

export interface WarehouseIntakeVehicleDetails {
  make: string;
  model: string;
  variant: string;
  year: string;
  registrationPlate: string;
  vin: string;
  colour: string;
  odometer: string;
  registrationExpiry: string;
  numberOfKeys: string;
  fuelType: string;
  transmission: string;
  askingPrice: string;
  reservePrice: string;
  serviceHistory: string;
  accidentHistory: string;
  ownershipProof?: WarehouseIntakeFileRecord | null;
  notes: string;
}

export interface WarehouseIntakeDeclarations {
  writtenOffHistory: WarehouseDeclarationAnswer;
  repairableWriteOffHistory: WarehouseDeclarationAnswer;
  stolenRecoveredHistory: WarehouseDeclarationAnswer;
  hailDamageHistory: WarehouseDeclarationAnswer;
  floodDamageHistory: WarehouseDeclarationAnswer;
  engineReplacementHistory: WarehouseDeclarationAnswer;
  odometerDiscrepancyKnown: WarehouseDeclarationAnswer;
  financeOwing: WarehouseDeclarationAnswer;
  financeCompanyName: string;
  isInformationAccurate: boolean;
}

export interface WarehouseIntakeConditionSection {
  [key: string]: WarehouseConditionItem;
}

export interface WarehouseIntakeConditionReport {
  exterior: WarehouseIntakeConditionSection;
  interior: WarehouseIntakeConditionSection;
  mechanical: WarehouseIntakeConditionSection;
}

export interface WarehouseIntakeAgreement {
  informationAccurateConfirmed: boolean;
  storageAssistanceAuthorized: boolean;
  electronicSigningConsented: boolean;
  insuranceMaintainedConfirmed: boolean;
  directSaleResponsibilityConfirmed: boolean;
  conditionDocumentationConfirmed: boolean;
  reviewedAt?: string;
}

export interface WarehouseIntakeSignature {
  signerName: string;
  adminStaffName: string;
  signedAt?: string;
  signatureStoragePath?: string;
}

export interface WarehouseServiceFeeItem {
  id: string;
  serviceName: string;
  category: WarehouseServiceFeeCategory;
  amount: number;
  gstIncluded: boolean;
  customerVisible: boolean;
  internalNote: string;
}

export interface VehicleListingPriceHistoryEntry {
  amount: number;
  capturedAt?: string;
}

export interface VehicleListingStatusTimelineEntry {
  status: VehicleListingHistoryStatus;
  changedAt?: string;
  changedByUid?: string;
  changedByName?: string;
}

export interface VehicleListingHistoryEntry {
  id: string;
  publicListingId: string;
  displayReference: string;
  customerProfileId?: string;
  customerNameSnapshot?: string;
  createdAt?: string;
  publishedAt?: string;
  withdrawnAt?: string;
  soldAt?: string;
  currentStatus: VehicleListingHistoryStatus;
  askingPriceHistory: VehicleListingPriceHistoryEntry[];
  statusTransitions: VehicleListingStatusTimelineEntry[];
}

export interface AdminAuditEvent {
  id: string;
  recordType: AdminAuditRecordType;
  actionType: AdminAuditActionType;
  affectedRecordId: string;
  customerProfileId?: string;
  vehicleRecordId?: string;
  intakeEventId?: string;
  publicListingId?: string;
  staffUid?: string;
  staffName?: string;
  staffEmail?: string;
  targetUid?: string;
  targetEmail?: string;
  previousRole?: UserRole;
  newRole?: UserRole;
  summary: string;
  createdAt?: string;
}

export interface CustomerProfile {
  id: string;
  fullName: string;
  email: string;
  normalizedEmail: string;
  phone: string;
  normalizedPhone: string;
  address: string;
  dateOfBirth: string;
  preferredContactMethod: WarehousePreferredContactMethod;
  customerVerificationNotes: string;
  identificationDocumentType: WarehouseIdentificationDocumentType;
  identificationDocumentNumber: string;
  companyOwned: boolean;
  companyName: string;
  abn: string;
  acn: string;
  identificationDocument?: WarehouseIntakeFileRecord | null;
  isLegalOwnerConfirmed: boolean;
  declarations: WarehouseIntakeDeclarations;
  agreement: WarehouseIntakeAgreement;
  signature: WarehouseIntakeSignature;
  latestIntakeId?: string;
  latestVehicleRecordId?: string;
  linkedVehicleRecordIds: string[];
  linkedListingIds: string[];
  status: CustomerProfileStatus;
  lastEditedByUid?: string;
  lastEditedByName?: string;
  lastEditedAt?: string;
  createdByUid?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VehicleRecord {
  id: string;
  customerProfileId?: string;
  publicListingId?: string;
  displayReference?: string;
  title?: string;
  make: string;
  model: string;
  variant: string;
  year: string;
  registrationPlate: string;
  vin: string;
  colour: string;
  odometer: string;
  registrationExpiry: string;
  numberOfKeys: string;
  fuelType: string;
  transmission: string;
  askingPrice: string;
  reservePrice: string;
  serviceHistory: string;
  accidentHistory: string;
  ownershipProof?: WarehouseIntakeFileRecord | null;
  declarations: WarehouseIntakeDeclarations;
  notes: string;
  linkedIntakeIds: string[];
  latestIntakeId?: string;
  status: VehicleRecordStatus;
  listingHistory: VehicleListingHistoryEntry[];
  realisedRevenue?: number;
  outstandingIntakeCosts?: number;
  storageRevenue?: number;
  soldGrossTotal?: number;
  serviceFeeSubtotal?: number;
  gstInclusiveServiceFeeTotal?: number;
  estimatedTotalIncome?: number;
  intakeEventCount?: number;
  lastEditedByUid?: string;
  lastEditedByName?: string;
  lastEditedAt?: string;
  activeIntakeEditorUid?: string;
  activeIntakeEditorName?: string;
  activeIntakeEditedAt?: string;
  lastCalculatedAt?: string;
  createdByUid?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WarehouseRelationshipTree {
  customerProfile: CustomerProfile | null;
  vehicleRecord: VehicleRecord | null;
  listing: Vehicle | null;
  intakeRecords: WarehouseIntakeRecord[];
}

export interface WarehouseIntakeRecord {
  id: string;
  customerProfileId?: string;
  vehicleRecordId?: string;
  vehicleId?: string;
  vehicleReference?: string;
  vehicleTitle?: string;
  status: WarehouseIntakeStatus;
  ownerDetails: WarehouseIntakeOwnerDetails;
  vehicleDetails: WarehouseIntakeVehicleDetails;
  declarations: WarehouseIntakeDeclarations;
  conditionReport: WarehouseIntakeConditionReport;
  photos: WarehouseIntakePhotoRecord[];
  serviceItems: WarehouseServiceFeeItem[];
  intakeDate?: string;
  assignedStaffUid?: string;
  assignedStaffName?: string;
  intakeNotes?: string;
  projectedRevenueSnapshot?: number;
  storageStartDate?: string;
  storageEndDate?: string;
  storageDurationDays?: number;
  serviceFeeSubtotal?: number;
  gstInclusiveServiceFeeTotal?: number;
  gstAmount?: number;
  agreement: WarehouseIntakeAgreement;
  signature: WarehouseIntakeSignature;
  signedPdfStoragePath?: string;
  signedPdfFileName?: string;
  pdfGeneratedAt?: string;
  completedAt?: string;
  emailSentAt?: string;
  photoCount?: number;
  adminStaffName?: string;
  lastEditedByUid?: string;
  lastEditedByName?: string;
  lastEditedAt?: string;
  activeEditorUid?: string;
  activeEditorName?: string;
  activeEditorAt?: string;
  createdByUid?: string;
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
  customerEmail?: string;
  customerName?: string | null;
  description: string;
  coverImage?: string;
  coverImageUrl?: string;
  imageAssets?: VehicleImageAsset[];
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
  displayName?: string;
  name?: string;
  email?: string;
  emailVerified?: boolean;
  accountBanned?: boolean;
  adminPermissions?: AdminPermissions;
  dealerVerified?: boolean;
  listingRestricted?: boolean;
  possibleUnlicensedTrader?: boolean;
  dealerStatus?: DealerStatus;
  agreedToDealerTerms?: boolean;
  agreedToTerms?: boolean;
  agreedAt?: string;
  dealerPlan?: DealerPlanType;
  planType?: DealerPlanType;
  maxListings?: number;
  shopPublicVisible?: boolean;
  shopVisible?: boolean;
  brandingEnabled?: boolean;
  contactDisplayEnabled?: boolean;
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
  contactVisibilityState?: OfferContactVisibilityState;
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
  type: VehicleActivityType;
  message: string;
  imageUrls?: string[];
  emailSentStatus?: "not_requested" | "no_email" | "sent" | "send_failed" | "missing_env";
  emailErrorMessage?: string;
  createdAt?: string;
  createdBy?: string;
  createdByUid?: string;
  actorUid?: string;
  visibility: VehicleActivityVisibility;
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

export interface DealerApplicationProofFile {
  url: string;
  name?: string;
  contentType?: string;
}

export interface DealerApplication {
  id: string;
  userId: string;
  referenceId: string;
  dealerStatus: Exclude<DealerStatus, "none">;
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
  proofFiles: DealerApplicationProofFile[];
  riskLevel: DealerApplicationRiskLevel;
  spamRiskLevel: DealerApplicationRiskLevel;
  duplicateFlags: {
    hasAny: boolean;
    lmctNumber: boolean;
    abn: boolean;
    acn: boolean;
    contactPhone: boolean;
    contactEmail: boolean;
  };
  duplicateMatchFlags: {
    hasAny: boolean;
    lmctNumber: boolean;
    abn: boolean;
    acn: boolean;
    contactPhone: boolean;
    contactEmail: boolean;
  };
  duplicateMatchedApplicationIds: string[];
  trustIndicators: {
    proofPresent: boolean;
    validAbnOrAcnFormat: boolean;
    lmctNumberPresent: boolean;
    businessLocationConsistent: boolean;
    freeEmailDomain: boolean;
    repeatedRejectedApplications: boolean;
  };
  rejectionHistoryCount: number;
  status: Exclude<DealerStatus, "none">;
  requestedAt?: string;
  lastSubmittedAt?: string;
  updatedAt?: string;
  reviewedAt?: string;
  reviewedByUid?: string;
  reviewedBy?: string;
  agreedToDealerTerms?: boolean;
  agreedToTerms?: boolean;
  agreedAt?: string;
  dealerPlan: DealerPlanType;
  planType: DealerPlanType;
  maxListings: number;
  shopPublicVisible: boolean;
  shopVisible: boolean;
  brandingEnabled: boolean;
  contactDisplayEnabled: boolean;
  adminNote?: string;
  infoRequested?: boolean;
  infoRequestedAt?: string;
  dealerResponseNote?: string;
  additionalUploads: DealerApplicationProofFile[];
  rejectReason?: string;
  infoRequestNote?: string;
}

export interface VehicleViewEvent {
  id: string;
  vehicleId: string;
  viewedAt?: string;
  sessionId: string;
  userId?: string;
  visitorKeyHash?: string;
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

export interface UserSupportAccountMetrics {
  totalListings: number;
  liveListings: number;
  soldListings: number;
  pendingListings: number;
  totalOffers: number;
  totalEnquiries: number;
  totalInspections: number;
}

export interface UserSupportRecord {
  matchedUser: AppUser | null;
  matchedVehicle: Vehicle | null;
  ownedVehicles: Vehicle[];
  metrics: UserSupportAccountMetrics;
}

export interface UserSupportSuggestion {
  type: "user" | "listing";
  queryValue: string;
  email: string;
  name: string;
  id: string;
}

export interface UserSupportHighActivityAccount {
  user: AppUser;
  totalListings: number;
  soldListingsLast12Months: number;
  soldListings: Vehicle[];
}

export interface UserSupportDealerRiskAccount {
  user: AppUser;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  soldListingsLast12Months: number;
  activeListings: number;
  listingsCreatedLast30Days: number;
  riskReasons: string[];
  listings: Vehicle[];
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
