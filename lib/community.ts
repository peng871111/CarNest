"use client";

import {
  collection,
  deleteField,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { hasAdminPermission } from "@/lib/permissions";
import type {
  AppUser,
  CommunityMoment,
  CommunityMomentCategoryId,
  CommunityMomentImage,
  CommunityMomentStatus,
  Vehicle,
} from "@/types";

export const COMMUNITY_COLLECTION = "communityMoments";
export const COMMUNITY_MAX_IMAGES = 12;
export const COMMUNITY_LEGACY_PRIMARY_IMAGE_ID = "legacy-primary";

export const COMMUNITY_CATEGORIES: Array<{
  id: CommunityMomentCategoryId;
  label: string;
  description: string;
}> = [
  {
    id: "car-meets-events",
    label: "Car Meets & Events",
    description: "Car meets, organised events, community gatherings and Cars & Coffee moments.",
  },
  {
    id: "on-the-road",
    label: "On the Road",
    description: "Driving photos, rolling shots and automotive lifestyle moments.",
  },
  {
    id: "featured-cars",
    label: "Featured Cars",
    description: "Interesting, rare, special and standout CarNest vehicles.",
  },
  {
    id: "deliveries-owners",
    label: "Deliveries & Owners",
    description: "Delivery moments, handovers and owners with their vehicles.",
  },
  {
    id: "behind-the-scenes",
    label: "Behind the Scenes",
    description: "Warehouse activity, preparation, photography and day-to-day CarNest operations.",
  },
];

export const COMMUNITY_CATEGORY_LABELS = Object.fromEntries(
  COMMUNITY_CATEGORIES.map((category) => [category.id, category.label])
) as Record<CommunityMomentCategoryId, string>;

const COMMUNITY_CATEGORY_IDS = new Set(COMMUNITY_CATEGORIES.map((category) => category.id));

export interface CommunityMomentWriteInput {
  category: CommunityMomentCategoryId;
  status: CommunityMomentStatus;
  featured: boolean;
  image?: CommunityMomentImage;
  images?: CommunityMomentImage[];
  coverImageId?: string;
  title?: string;
  caption?: string;
  momentDate?: string;
  location?: string;
  linkedListingId?: string;
}

function serializeDate(value: unknown) {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
  }
  return undefined;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeImageId(value: unknown, fallback: string) {
  const candidate = normalizeString(value);
  return /^[A-Za-z0-9_-]{3,120}$/.test(candidate) ? candidate : fallback;
}

function normalizeCategory(value: unknown): CommunityMomentCategoryId {
  return typeof value === "string" && COMMUNITY_CATEGORY_IDS.has(value as CommunityMomentCategoryId)
    ? value as CommunityMomentCategoryId
    : "on-the-road";
}

function normalizeStatus(value: unknown): CommunityMomentStatus {
  return value === "published" ? "published" : "draft";
}

function serializeImage(value: unknown, fallbackId = COMMUNITY_LEGACY_PRIMARY_IMAGE_ID): CommunityMomentImage | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const originalPath = normalizeString(data.originalPath);
  const displayPath = normalizeString(data.displayPath);
  const thumbnailPath = normalizeString(data.thumbnailPath);
  const displayUrl = normalizeString(data.displayUrl);
  const thumbnailUrl = normalizeString(data.thumbnailUrl);

  if (!originalPath || !displayPath || !thumbnailPath || !displayUrl || !thumbnailUrl) {
    return null;
  }

  return {
    id: normalizeImageId(data.id, fallbackId),
    originalPath,
    displayPath,
    thumbnailPath,
    displayUrl,
    thumbnailUrl,
    originalFileName: normalizeString(data.originalFileName) || "community-photo",
    contentType: normalizeString(data.contentType) || "image/jpeg",
    displayWidth: typeof data.displayWidth === "number" ? data.displayWidth : 1600,
    displayHeight: typeof data.displayHeight === "number" ? data.displayHeight : 1000,
    thumbnailWidth: typeof data.thumbnailWidth === "number" ? data.thumbnailWidth : 760,
    thumbnailHeight: typeof data.thumbnailHeight === "number" ? data.thumbnailHeight : 480,
    uploadedAt: serializeDate(data.uploadedAt) ?? new Date().toISOString(),
  };
}

function serializeImages(value: unknown) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value
    .map((item, index) => serializeImage(item, `community-image-${index + 1}`))
    .filter((item): item is CommunityMomentImage => Boolean(item))
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

export function getCommunityMomentImages(moment?: Pick<CommunityMoment, "image" | "images"> | null) {
  if (!moment) return [] as CommunityMomentImage[];
  return Array.isArray(moment.images) && moment.images.length ? moment.images : [moment.image].filter(Boolean);
}

export function getCommunityMomentCoverImage(
  moment?: Pick<CommunityMoment, "image" | "images" | "coverImageId"> | null
) {
  if (!moment) return null;
  const images = getCommunityMomentImages(moment);
  return images.find((image) => image.id === moment.coverImageId)
    ?? images.find((image) => image.displayPath === moment.image?.displayPath)
    ?? moment.image
    ?? images[0]
    ?? null;
}

export function getCommunityMomentImageCount(moment?: Pick<CommunityMoment, "image" | "images"> | null) {
  return getCommunityMomentImages(moment).length;
}

export function serializeCommunityMomentDoc(id: string, data: Record<string, unknown>): CommunityMoment | null {
  const legacyImage = serializeImage(data.image);
  const storedImages = serializeImages(data.images).slice(0, COMMUNITY_MAX_IMAGES);
  const images = storedImages.length ? storedImages : legacyImage ? [legacyImage] : [];
  if (!images.length) return null;

  const requestedCoverImageId = normalizeString(data.coverImageId);
  const image =
    images.find((item) => item.id === requestedCoverImageId)
    ?? (legacyImage ? images.find((item) => item.displayPath === legacyImage.displayPath) : null)
    ?? images[0];

  const status = normalizeStatus(data.status);
  const published = status === "published" && data.published === true;

  return {
    id,
    category: normalizeCategory(data.category),
    status,
    published,
    featured: Boolean(data.featured),
    title: normalizeString(data.title) || undefined,
    caption: normalizeString(data.caption) || undefined,
    momentDate: (serializeDate(data.momentDate) ?? normalizeString(data.momentDate)) || undefined,
    location: normalizeString(data.location) || undefined,
    linkedListingId: normalizeString(data.linkedListingId) || undefined,
    image,
    images,
    coverImageId: image.id,
    collectionType: data.collectionType === "moment" ? "moment" : "moment",
    albumId: normalizeString(data.albumId) || undefined,
    eventId: normalizeString(data.eventId) || undefined,
    createdBy: normalizeString(data.createdBy) || undefined,
    updatedBy: normalizeString(data.updatedBy) || undefined,
    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt),
    publishedAt: serializeDate(data.publishedAt),
  };
}

function sortCommunityMoments(left: CommunityMoment, right: CommunityMoment) {
  const leftDate = left.momentDate || left.publishedAt || left.updatedAt || left.createdAt || "";
  const rightDate = right.momentDate || right.publishedAt || right.updatedAt || right.createdAt || "";
  return rightDate.localeCompare(leftDate);
}

function assertCanManageCommunity(actor?: AppUser | null) {
  if (!hasAdminPermission(actor, "manageVehicles")) {
    throw new Error("You do not have access to manage Community moments.");
  }
}

function cleanMomentImages(
  input: CommunityMomentWriteInput,
  fallbackImages: CommunityMomentImage[] = [],
  fallbackCoverImageId = ""
) {
  const submittedImages = Array.isArray(input.images) && input.images.length
    ? input.images
    : input.image
      ? [input.image]
      : fallbackImages;
  const images = serializeImages(submittedImages);

  if (images.length > COMMUNITY_MAX_IMAGES) {
    throw new Error(`Maximum ${COMMUNITY_MAX_IMAGES} photos per Moment.`);
  }

  const coverImageId = normalizeImageId(input.coverImageId || fallbackCoverImageId, images[0]?.id ?? "");
  const image = images.find((item) => item.id === coverImageId) ?? images[0] ?? null;

  return {
    image,
    images,
    coverImageId: image?.id ?? "",
  };
}

function cleanMomentInput(
  input: CommunityMomentWriteInput,
  fallbackImages: CommunityMomentImage[] = [],
  fallbackCoverImageId = ""
) {
  if (!COMMUNITY_CATEGORY_IDS.has(input.category)) {
    throw new Error("Select a valid Community category.");
  }

  const status = normalizeStatus(input.status);
  const imageState = cleanMomentImages(input, fallbackImages, fallbackCoverImageId);
  const title = normalizeString(input.title);
  const caption = normalizeString(input.caption);
  const momentDate = normalizeString(input.momentDate);
  const location = normalizeString(input.location);
  const linkedListingId = normalizeString(input.linkedListingId);

  if (!imageState.image || !imageState.images.length) {
    throw new Error("Upload at least one photo before saving this Community moment.");
  }

  return {
    category: input.category,
    status,
    published: status === "published",
    featured: Boolean(input.featured),
    image: imageState.image,
    images: imageState.images,
    coverImageId: imageState.coverImageId,
    ...(title ? { title } : {}),
    ...(caption ? { caption } : {}),
    ...(momentDate ? { momentDate } : {}),
    ...(location ? { location } : {}),
    ...(linkedListingId ? { linkedListingId } : {}),
  };
}

export function createCommunityMomentId() {
  return doc(collection(db, COMMUNITY_COLLECTION)).id;
}

export async function listCommunityMomentsForAdmin(actor?: AppUser | null) {
  assertCanManageCommunity(actor);

  if (!isFirebaseConfigured) {
    return [] as CommunityMoment[];
  }

  const snapshot = await getDocs(collection(db, COMMUNITY_COLLECTION));
  return snapshot.docs
    .map((item) => serializeCommunityMomentDoc(item.id, item.data()))
    .filter((item): item is CommunityMoment => Boolean(item))
    .sort(sortCommunityMoments);
}

export async function listPublishedCommunityMoments() {
  if (!isFirebaseConfigured) {
    return [] as CommunityMoment[];
  }

  const snapshot = await getDocs(
    query(
      collection(db, COMMUNITY_COLLECTION),
      where("published", "==", true),
      where("status", "==", "published")
    )
  );

  return snapshot.docs
    .map((item) => serializeCommunityMomentDoc(item.id, item.data()))
    .filter((item): item is CommunityMoment => Boolean(item?.published))
    .sort(sortCommunityMoments);
}

export async function listFeaturedPublishedCommunityMoments(maxCount = 6) {
  const moments = await listPublishedCommunityMoments();
  return moments.filter((moment) => moment.featured).slice(0, maxCount);
}

export function isPublicActiveLinkedVehicle(vehicle: Vehicle | null | undefined) {
  return Boolean(
    vehicle
    && !vehicle.deleted
    && vehicle.status === "approved"
    && (vehicle.sellerStatus === "ACTIVE" || vehicle.sellerStatus === "UNDER_OFFER")
  );
}

export async function createCommunityMoment(momentId: string, input: CommunityMomentWriteInput, actor?: AppUser | null) {
  assertCanManageCommunity(actor);

  const now = new Date().toISOString();
  const cleanedInput = cleanMomentInput(input);

  const payload = {
    ...cleanedInput,
    collectionType: "moment",
    createdBy: actor?.id ?? "",
    updatedBy: actor?.id ?? "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...(cleanedInput.published ? { publishedAt: serverTimestamp() } : {}),
  };

  if (!isFirebaseConfigured) {
    return {
      id: momentId,
      ...payload,
      createdAt: now,
      updatedAt: now,
      publishedAt: cleanedInput.published ? now : undefined,
    } as CommunityMoment;
  }

  await setDoc(doc(db, COMMUNITY_COLLECTION, momentId), payload);
  return {
    id: momentId,
    ...cleanedInput,
    collectionType: "moment" as const,
    createdBy: actor?.id,
    updatedBy: actor?.id,
    createdAt: now,
    updatedAt: now,
    publishedAt: cleanedInput.published ? now : undefined,
  } satisfies CommunityMoment;
}

export async function updateCommunityMoment(moment: CommunityMoment, input: CommunityMomentWriteInput, actor?: AppUser | null) {
  assertCanManageCommunity(actor);

  const cleanedInput = cleanMomentInput(input, getCommunityMomentImages(moment), moment.coverImageId);
  const wasPublished = moment.published;
  const shouldPublishNow = cleanedInput.published && !wasPublished;
  const now = new Date().toISOString();

  if (!isFirebaseConfigured) {
    return {
      ...moment,
      ...cleanedInput,
      updatedBy: actor?.id,
      updatedAt: now,
      publishedAt: shouldPublishNow ? now : moment.publishedAt,
    } satisfies CommunityMoment;
  }

  await updateDoc(doc(db, COMMUNITY_COLLECTION, moment.id), {
    category: cleanedInput.category,
    status: cleanedInput.status,
    published: cleanedInput.published,
    featured: cleanedInput.featured,
    title: cleanedInput.title ?? deleteField(),
    caption: cleanedInput.caption ?? deleteField(),
    momentDate: cleanedInput.momentDate ?? deleteField(),
    location: cleanedInput.location ?? deleteField(),
    linkedListingId: cleanedInput.linkedListingId ?? deleteField(),
    image: cleanedInput.image,
    images: cleanedInput.images,
    coverImageId: cleanedInput.coverImageId,
    updatedBy: actor?.id ?? "",
    updatedAt: serverTimestamp(),
    ...(shouldPublishNow ? { publishedAt: serverTimestamp() } : {}),
  });

  return {
    ...moment,
    ...cleanedInput,
    updatedBy: actor?.id,
    updatedAt: now,
    publishedAt: shouldPublishNow ? now : moment.publishedAt,
  } satisfies CommunityMoment;
}
