import rawAustralianPostcodes from "@/data/au-postcodes.json";

export interface AustralianPostcodeLocation {
  suburb: string;
  state: string;
}

type RawAustralianPostcodeMap = Record<string, string[][]>;

// Source dataset: Elkfox/Australian-Postcode-Data, downloaded on 2026-04-19 and compacted for in-app lookup use.
const AUSTRALIAN_POSTCODE_MAP = Object.fromEntries(
  Object.entries(rawAustralianPostcodes as RawAustralianPostcodeMap).map(([postcode, locations]) => [
    postcode,
    locations
      .filter((location): location is [string, string] => location.length >= 2)
      .map(([suburb, state]) => ({ suburb, state }))
  ])
) as Record<string, AustralianPostcodeLocation[]>;

export function normalizeAustralianPostcode(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

export function isAustralianPostcode(value: string) {
  return /^\d{4}$/.test(normalizeAustralianPostcode(value));
}

export function getAustralianPostcodeLocations(postcode: string) {
  const normalizedPostcode = normalizeAustralianPostcode(postcode);
  if (!isAustralianPostcode(normalizedPostcode)) return [];

  return AUSTRALIAN_POSTCODE_MAP[normalizedPostcode] ?? [];
}

export function findAustralianPostcodeLocation(postcode: string, suburb: string) {
  const normalizedSuburb = suburb.trim().toUpperCase();
  if (!normalizedSuburb) return undefined;

  return getAustralianPostcodeLocations(postcode).find((location) => location.suburb === normalizedSuburb);
}
