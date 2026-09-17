import type { AdminPermissions, PricingLeadRating, PricingNextAction, PricingRequest, PricingRequestStatus, PricingRequestTimeline } from "@/types";

type PricingDocumentData = Record<string, unknown>;

export interface AdminPricingCookieState {
  session?: string;
  role?: string;
  permissions?: Partial<Record<keyof AdminPermissions, boolean>>;
}

export interface AdminPricingDocumentSnapshotLike {
  id: string;
  data(): PricingDocumentData;
}

export interface AdminPricingCollectionResult {
  items: PricingRequest[];
  source: "firestore" | "mock";
  error?: string;
}

const PRICING_STATUSES = ["NEW", "REPLIED", "CLOSED"] as const satisfies readonly PricingRequestStatus[];
const PRICING_TIMELINES = ["ASAP (within 2 weeks)", "2–4 weeks", "1–2 months", "Just exploring"] as const satisfies readonly PricingRequestTimeline[];
const PRICING_LEAD_RATINGS = ["HOT", "WARM", "COLD"] as const satisfies readonly PricingLeadRating[];
const PRICING_NEXT_ACTIONS = ["Recommend warehouse", "Follow up later", "Not suitable"] as const satisfies readonly PricingNextAction[];

export function parseAdminPricingPermissionsCookie(value?: string) {
  if (!value) return {} as Partial<Record<keyof AdminPermissions, boolean>>;

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).map(([key, entry]) => [key, Boolean(entry)])) as Partial<
      Record<keyof AdminPermissions, boolean>
    >;
  } catch {
    return {} as Partial<Record<keyof AdminPermissions, boolean>>;
  }
}

export function hasAdminPricingSessionAccess(state: AdminPricingCookieState) {
  if (!state.session) return false;
  if (state.role === "super_admin") return true;
  if (state.role !== "admin") return false;
  return state.permissions?.managePricing === true;
}

function serializeAdminPricingDate(value: unknown) {
  try {
    if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
      const date = value.toDate();
      return date
        && typeof date === "object"
        && "getTime" in date
        && typeof date.getTime === "function"
        && "toISOString" in date
        && typeof date.toISOString === "function"
        && Number.isFinite(date.getTime())
        ? date.toISOString()
        : undefined;
    }
  } catch {
    return undefined;
  }

  return typeof value === "string" ? value : undefined;
}

function readRequiredString(data: PricingDocumentData, field: string) {
  const value = data[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Pricing request is missing required string field: ${field}`);
  }
  return value;
}

function readPricingStatus(data: PricingDocumentData) {
  const status = readRequiredString(data, "status");
  if (!PRICING_STATUSES.includes(status as PricingRequestStatus)) {
    throw new Error(`Pricing request has invalid status: ${status}`);
  }
  return status as PricingRequestStatus;
}

function readPricingTimeline(data: PricingDocumentData) {
  const timeline = readRequiredString(data, "timeline");
  if (!PRICING_TIMELINES.includes(timeline as PricingRequestTimeline)) {
    throw new Error(`Pricing request has invalid timeline: ${timeline}`);
  }
  return timeline as PricingRequestTimeline;
}

function readOptionalNumber(data: PricingDocumentData, field: string) {
  return typeof data[field] === "number" ? data[field] : undefined;
}

function readOptionalString(data: PricingDocumentData, field: string) {
  return typeof data[field] === "string" ? data[field] : undefined;
}

function readOptionalLeadRating(data: PricingDocumentData) {
  const value = readOptionalString(data, "leadRating");
  return value && PRICING_LEAD_RATINGS.includes(value as PricingLeadRating) ? value as PricingLeadRating : undefined;
}

function readOptionalNextAction(data: PricingDocumentData) {
  const value = readOptionalString(data, "nextAction");
  return value && PRICING_NEXT_ACTIONS.includes(value as PricingNextAction) ? value as PricingNextAction : undefined;
}

export function serializeAdminPricingRequestDoc(id: string, data: PricingDocumentData): PricingRequest {
  const vehicleId = readOptionalString(data, "vehicleId");
  const createdAt = serializeAdminPricingDate(data.createdAt);
  const respondedAt = serializeAdminPricingDate(data.respondedAt);

  return {
    id,
    userId: readRequiredString(data, "userId"),
    ...(vehicleId ? { vehicleId } : {}),
    currentPrice: readOptionalNumber(data, "currentPrice"),
    timeline: readPricingTimeline(data),
    message: readRequiredString(data, "message"),
    status: readPricingStatus(data),
    leadRating: readOptionalLeadRating(data),
    nextAction: readOptionalNextAction(data),
    ...(createdAt ? { createdAt } : {}),
    response: readOptionalString(data, "response"),
    ...(respondedAt ? { respondedAt } : {})
  };
}

export function sortAdminPricingRequests(items: PricingRequest[]) {
  return [...items].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export function buildAdminPricingCollectionResult(docs: Iterable<AdminPricingDocumentSnapshotLike>): AdminPricingCollectionResult {
  const items: PricingRequest[] = [];
  let skippedCount = 0;

  for (const doc of docs) {
    try {
      items.push(serializeAdminPricingRequestDoc(doc.id, doc.data()));
    } catch {
      skippedCount += 1;
    }
  }

  return {
    items: sortAdminPricingRequests(items),
    source: "firestore",
    ...(skippedCount > 0 ? { error: `Skipped ${skippedCount} malformed pricing request record${skippedCount === 1 ? "" : "s"}.` } : {})
  };
}
