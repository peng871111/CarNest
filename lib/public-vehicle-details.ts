import type { Vehicle } from "@/types";

type VehicleIdentitySource = unknown;

const REGISTRATION_ALIASES = ["registrationPlate", "registrationNumber", "registrationNo", "registration", "rego"] as const;
const VIN_ALIASES = ["vin", "vinNumber", "chassisNumber", "vinOrChassisNumber", "vinOrChassis"] as const;
const VARIANT_ALIASES = ["variant", "trim", "badge"] as const;

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function asRecord(value: VehicleIdentitySource): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function cleanNumberText(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.round(value));
  return cleanText(value).replace(/[^\d.]/g, "");
}

function readFirstText(source: VehicleIdentitySource, aliases: readonly string[]) {
  const record = asRecord(source);
  if (!record) return "";

  for (const alias of aliases) {
    const value = cleanText(record[alias]);
    if (value) return value;
  }

  return "";
}

function readFirstUpperText(source: VehicleIdentitySource, aliases: readonly string[]) {
  const value = readFirstText(source, aliases);
  return value ? value.toUpperCase() : "";
}

function firstValue(values: Array<string | number | undefined>) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function firstTextFromSources(sources: VehicleIdentitySource[], aliases: readonly string[], uppercase = false) {
  for (const source of sources) {
    const value = uppercase ? readFirstUpperText(source, aliases) : readFirstText(source, aliases);
    if (value) return value;
  }

  return "";
}

function firstNumberFromSources(sources: VehicleIdentitySource[], aliases: readonly string[]) {
  for (const source of sources) {
    const record = asRecord(source);
    if (!record) continue;
    for (const alias of aliases) {
      const raw = record[alias];
      if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
      const numeric = Number(cleanNumberText(raw));
      if (Number.isFinite(numeric) && numeric > 0) return Math.round(numeric);
    }
  }

  return 0;
}

function stripVariantSuffix(model: string, variant: string) {
  const normalizedModel = cleanText(model);
  const normalizedVariant = cleanText(variant);
  if (!normalizedModel || !normalizedVariant) return normalizedModel;

  const modelLower = normalizedModel.toLowerCase();
  const variantLower = normalizedVariant.toLowerCase();
  if (!modelLower.endsWith(` ${variantLower}`)) return normalizedModel;

  const stripped = normalizedModel.slice(0, normalizedModel.length - normalizedVariant.length).trim();
  return stripped || normalizedModel;
}

export interface PublicVehicleIdentitySnapshot {
  make: string;
  model: string;
  variant: string;
  year: number;
  colour: string;
  rego: string;
  vin: string;
  mileage: number;
  keyCount: string;
  regoExpiry: string;
}

export function getVehicleIdentitySourceFromStorageContract(storageContract: VehicleIdentitySource) {
  const record = asRecord(storageContract);
  const vehicleDetails = record?.vehicleDetails;
  return vehicleDetails && typeof vehicleDetails === "object" ? vehicleDetails as VehicleIdentitySource : null;
}

export function buildPublicVehicleIdentitySnapshot(input: {
  listing?: VehicleIdentitySource;
  vehicleRecord?: VehicleIdentitySource;
  storageContract?: VehicleIdentitySource;
}): PublicVehicleIdentitySnapshot {
  const listing = input.listing ?? null;
  const vehicleRecord = input.vehicleRecord ?? null;
  const storageVehicleDetails = getVehicleIdentitySourceFromStorageContract(input.storageContract) ?? input.storageContract ?? null;
  const sources = [vehicleRecord, storageVehicleDetails, listing];
  const variant = firstTextFromSources(sources, VARIANT_ALIASES, true);
  const rawModel = firstTextFromSources(sources, ["model"], true);

  return {
    make: firstTextFromSources(sources, ["make"], true),
    model: stripVariantSuffix(rawModel, variant),
    variant,
    year: firstNumberFromSources(sources, ["year"]),
    colour: firstTextFromSources(sources, ["colour", "color"], true),
    rego: firstTextFromSources(sources, REGISTRATION_ALIASES, true),
    vin: firstTextFromSources(sources, VIN_ALIASES, true),
    mileage: firstNumberFromSources(sources, ["odometer", "mileage", "kms", "kilometres"]),
    keyCount: String(firstValue([
      firstTextFromSources(sources, ["numberOfKeys", "keyCount", "keys"]),
    ]) || ""),
    regoExpiry: firstTextFromSources(sources, ["registrationExpiry", "regoExpiry"]),
  };
}

export function applyPublicVehicleIdentitySnapshot(
  vehicle: Vehicle,
  snapshot: PublicVehicleIdentitySnapshot
): Vehicle {
  return {
    ...vehicle,
    make: snapshot.make || vehicle.make,
    model: snapshot.model || vehicle.model,
    variant: snapshot.variant || vehicle.variant,
    year: snapshot.year || vehicle.year,
    colour: snapshot.colour || vehicle.colour,
    rego: snapshot.rego || vehicle.rego,
    vin: snapshot.vin || vehicle.vin,
    mileage: snapshot.mileage || vehicle.mileage,
    keyCount: snapshot.keyCount || vehicle.keyCount,
    regoExpiry: snapshot.regoExpiry || vehicle.regoExpiry,
  };
}

export function buildPublicVehicleIdentityUpdatePayload(
  currentListing: Pick<Vehicle, "make" | "model" | "variant" | "year" | "colour" | "rego" | "vin" | "mileage" | "keyCount" | "regoExpiry">,
  snapshot: PublicVehicleIdentitySnapshot
) {
  const payload: Partial<Pick<Vehicle, "make" | "model" | "variant" | "year" | "colour" | "rego" | "vin" | "mileage" | "keyCount" | "regoExpiry">> = {};

  if (snapshot.make && snapshot.make !== currentListing.make) payload.make = snapshot.make;
  if (snapshot.model && snapshot.model !== currentListing.model) payload.model = snapshot.model;
  if (snapshot.variant && snapshot.variant !== currentListing.variant) payload.variant = snapshot.variant;
  if (snapshot.year && snapshot.year !== currentListing.year) payload.year = snapshot.year;
  if (snapshot.colour && snapshot.colour !== currentListing.colour) payload.colour = snapshot.colour;
  if (snapshot.rego && snapshot.rego !== currentListing.rego) payload.rego = snapshot.rego;
  if (snapshot.vin && snapshot.vin !== currentListing.vin) payload.vin = snapshot.vin;
  if (snapshot.mileage && snapshot.mileage !== currentListing.mileage) payload.mileage = snapshot.mileage;
  if (snapshot.keyCount && snapshot.keyCount !== currentListing.keyCount) payload.keyCount = snapshot.keyCount;
  if (snapshot.regoExpiry && snapshot.regoExpiry !== currentListing.regoExpiry) payload.regoExpiry = snapshot.regoExpiry;

  return payload;
}
