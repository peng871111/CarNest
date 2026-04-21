"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  findAustralianPostcodeLocation,
  getAustralianPostcodeLocations,
  isAustralianPostcode,
  normalizeAustralianPostcode
} from "@/lib/australian-postcodes";
import { Vehicle, VehicleFormFieldsValue } from "@/types";

export const TRANSMISSION_OPTIONS = ["AT", "MT", "DCT", "CVT", "PDK", "OTHER"];
export const FUEL_TYPE_OPTIONS = ["PETROL", "DIESEL", "EV", "PHEV", "HEV", "HYBRID", "LPG", "OTHER"];
export const DRIVETRAIN_OPTIONS = ["FWD", "RWD", "AWD", "4WD", "OTHER"];
export const BODY_TYPE_OPTIONS = ["SUV", "SEDAN", "COUPE", "HATCH", "UTE", "WAGON", "CONVERTIBLE", "VAN", "OTHER"];
export const SERVICE_HISTORY_OPTIONS = ["FULL DEALER SERVICE HISTORY", "PARTIAL DEALER SERVICE HISTORY", "NO SERVICE HISTORY"];
export const KEY_COUNT_OPTIONS = ["1 KEY", "2 KEYS", "3 KEYS"];
export const COMMON_AU_MAKE_OPTIONS = [
  { label: "Toyota", value: "TOYOTA" },
  { label: "Lexus", value: "LEXUS" },
  { label: "BMW", value: "BMW" },
  { label: "Mercedes-Benz", value: "MERCEDES-BENZ" },
  { label: "Audi", value: "AUDI" },
  { label: "Volkswagen", value: "VOLKSWAGEN" },
  { label: "Honda", value: "HONDA" },
  { label: "Hyundai", value: "HYUNDAI" },
  { label: "Kia", value: "KIA" },
  { label: "Mazda", value: "MAZDA" },
  { label: "Nissan", value: "NISSAN" },
  { label: "Ford", value: "FORD" },
  { label: "Subaru", value: "SUBARU" },
  { label: "Mitsubishi", value: "MITSUBISHI" },
  { label: "Tesla", value: "TESLA" },
  { label: "Porsche", value: "PORSCHE" }
] as const;

type VehicleFormTheme = "light" | "dark";
type CalendarParts = { day: string; month: string; year: string };

function normalizeUppercase(value: string) {
  return value.toUpperCase();
}

function getThemeClasses(theme: VehicleFormTheme) {
  if (theme === "dark") {
    return {
      label: "text-sm font-medium text-[#F5F5F5]",
      input: "border-white/10 bg-[#1A1A1A] text-[#F5F5F5]",
      select: "w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-3 text-sm text-[#F5F5F5]",
      hint: "text-xs leading-5 text-[#F5F5F5]/60",
      preview: "text-xs uppercase tracking-[0.18em] text-[#F5F5F5]/45"
    };
  }

  return {
    label: "text-sm font-medium text-ink",
    input: "border-black/10 bg-white text-ink",
    select: "w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink",
    hint: "text-xs leading-5 text-ink/55",
    preview: "text-xs uppercase tracking-[0.18em] text-ink/45"
  };
}

function parseCalendarParts(value?: string): CalendarParts {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return { day: "", month: "", year: "" };
  }

  return {
    year: match[1],
    month: match[2],
    day: match[3]
  };
}

function buildIsoDate(parts: CalendarParts) {
  if (!parts.day || !parts.month || !parts.year) return "";
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getDaysInMonth(year: string, month: string) {
  if (!year || !month) return 31;
  return new Date(Number(year), Number(month), 0).getDate();
}

function AustralianDatePicker({
  value,
  onChange,
  classes,
  theme
}: {
  value: string;
  onChange: (nextValue: string) => void;
  classes: ReturnType<typeof getThemeClasses>;
  theme: VehicleFormTheme;
}) {
  const [parts, setParts] = useState<CalendarParts>(() => parseCalendarParts(value));
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 17 }, (_, index) => String(currentYear - 1 + index)),
    [currentYear]
  );
  const dayOptions = useMemo(() => {
    const totalDays = getDaysInMonth(parts.year, parts.month);
    return Array.from({ length: totalDays }, (_, index) => String(index + 1).padStart(2, "0"));
  }, [parts.month, parts.year]);

  useEffect(() => {
    setParts(parseCalendarParts(value));
  }, [value]);

  useEffect(() => {
    if (!parts.day || !parts.month || !parts.year) return;

    const maxDay = getDaysInMonth(parts.year, parts.month);
    if (Number(parts.day) > maxDay) {
      const clampedDay = String(maxDay).padStart(2, "0");
      const nextParts = { ...parts, day: clampedDay };
      setParts(nextParts);
      onChange(buildIsoDate(nextParts));
    }
  }, [onChange, parts]);

  function updatePart(field: keyof CalendarParts, nextValue: string) {
    setParts((current) => {
      const nextParts = { ...current, [field]: nextValue };
      const nextIso = buildIsoDate(nextParts);

      if (nextIso) {
        onChange(nextIso);
      } else if (!nextParts.day && !nextParts.month && !nextParts.year) {
        onChange("");
      }

      return nextParts;
    });
  }

  function clearValue() {
    setParts({ day: "", month: "", year: "" });
    onChange("");
  }

  const hasValue = Boolean(parts.day || parts.month || parts.year);
  const displayValue = `${parts.day || "DD"}/${parts.month || "MM"}/${parts.year || "YYYY"}`;
  const clearButtonClass =
    theme === "dark"
      ? "text-xs font-medium uppercase tracking-[0.18em] text-[#F5F5F5]/60 transition hover:text-[#C6A87D]"
      : "text-xs font-medium uppercase tracking-[0.18em] text-ink/55 transition hover:text-bronze";

  return (
    <div className="space-y-2">
      <div className={`${classes.input} flex items-center gap-2 rounded-2xl border px-3 py-2`}>
        <select
          value={parts.day}
          onChange={(event) => updatePart("day", event.target.value)}
          className="w-[28%] bg-transparent py-1 text-sm outline-none"
          aria-label="Rego expiry day"
        >
          <option value="">DD</option>
          {dayOptions.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>
        <span className={classes.preview}>/</span>
        <select
          value={parts.month}
          onChange={(event) => updatePart("month", event.target.value)}
          className="w-[28%] bg-transparent py-1 text-sm outline-none"
          aria-label="Rego expiry month"
        >
          <option value="">MM</option>
          {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((month) => (
            <option key={month} value={month}>
              {month}
            </option>
          ))}
        </select>
        <span className={classes.preview}>/</span>
        <select
          value={parts.year}
          onChange={(event) => updatePart("year", event.target.value)}
          className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none"
          aria-label="Rego expiry year"
        >
          <option value="">YYYY</option>
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className={classes.preview}>{displayValue}</p>
        {hasValue ? (
          <button
            type="button"
            onClick={clearValue}
            className={clearButtonClass}
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function buildVehicleFormFieldsValue(vehicle?: Vehicle, descriptionOverride?: string): VehicleFormFieldsValue {
  return {
    year: vehicle ? String(vehicle.year) : String(new Date().getFullYear()),
    make: vehicle?.make ?? "",
    model: vehicle?.model ?? "",
    price: vehicle ? String(vehicle.price) : "",
    mileage: vehicle ? String(vehicle.mileage) : "",
    transmission: vehicle?.transmission ?? "",
    fuelType: vehicle?.fuelType ?? "",
    drivetrain: vehicle?.drivetrain ?? "",
    bodyType: vehicle?.bodyType ?? "",
    colour: vehicle?.colour ?? "",
    regoExpiry: vehicle?.regoExpiry ?? "",
    serviceHistory: vehicle?.serviceHistory ?? "",
    keyCount: vehicle?.keyCount ?? "",
    sellerLocationSuburb: vehicle?.sellerLocationSuburb ?? "",
    sellerLocationPostcode: vehicle?.sellerLocationPostcode ?? "",
    sellerLocationState: vehicle?.sellerLocationState ?? "",
    description: descriptionOverride ?? vehicle?.description ?? ""
  };
}

export function validateVehicleFormFields(values: VehicleFormFieldsValue) {
  const postcode = normalizeAustralianPostcode(values.sellerLocationPostcode.trim());
  const postcodeMatches = getAustralianPostcodeLocations(postcode);
  const suburbMatch = findAustralianPostcodeLocation(postcode, values.sellerLocationSuburb);

  if (!values.year.trim()) return "Please enter the vehicle year.";
  if (!values.make.trim()) return "Please select the vehicle make.";
  if (!values.model.trim()) return "Please enter the vehicle model.";
  if (!values.price.trim() || Number(values.price) < 0) return "Please enter a valid target asking price.";
  if (!values.mileage.trim() || Number(values.mileage) < 0) return "Please enter valid mileage.";
  if (!values.transmission.trim()) return "Please select the transmission.";
  if (!values.fuelType.trim()) return "Please select the fuel type.";
  if (!values.drivetrain.trim()) return "Please select the drivetrain.";
  if (!values.bodyType.trim()) return "Please select the body type.";
  if (!values.colour.trim()) return "Please enter the vehicle colour.";
  if (!values.serviceHistory.trim()) return "Please select the service history.";
  if (!values.keyCount.trim()) return "Please select the key count.";
  if (!isAustralianPostcode(postcode)) return "Please enter a valid 4-digit Australian postcode";
  if (!postcodeMatches.length) return "Please enter a valid 4-digit Australian postcode";
  if (!values.sellerLocationSuburb.trim()) {
    return postcodeMatches.length > 1 ? "Please select the seller suburb for this postcode." : "Please enter the seller suburb.";
  }
  if (!suburbMatch) return "Please select a seller suburb that matches the postcode.";
  if (values.sellerLocationState.trim().toUpperCase() !== suburbMatch.state) return "Seller state must match the selected suburb and postcode.";
  if (!values.description.trim()) return "Please enter the vehicle description.";
  return "";
}

export function VehicleFormFields({
  value,
  onFieldChange,
  theme = "light",
  descriptionLead,
  descriptionHint
}: {
  value: VehicleFormFieldsValue;
  onFieldChange: <K extends keyof VehicleFormFieldsValue>(field: K, nextValue: VehicleFormFieldsValue[K]) => void;
  theme?: VehicleFormTheme;
  descriptionLead?: ReactNode;
  descriptionHint?: ReactNode;
}) {
  const classes = getThemeClasses(theme);
  const normalizedPostcode = useMemo(
    () => normalizeAustralianPostcode(value.sellerLocationPostcode),
    [value.sellerLocationPostcode]
  );
  const makeOptions = useMemo(() => {
    const currentMake = value.make.trim();
    if (!currentMake || COMMON_AU_MAKE_OPTIONS.some((option) => option.value === currentMake)) {
      return COMMON_AU_MAKE_OPTIONS;
    }

    return [{ label: currentMake, value: currentMake }, ...COMMON_AU_MAKE_OPTIONS];
  }, [value.make]);
  const postcodeMatches = useMemo(
    () => getAustralianPostcodeLocations(normalizedPostcode),
    [normalizedPostcode]
  );
  const selectedLocation = useMemo(
    () => findAustralianPostcodeLocation(normalizedPostcode, value.sellerLocationSuburb),
    [normalizedPostcode, value.sellerLocationSuburb]
  );
  const hasFullPostcode = normalizedPostcode.length === 4;
  const hasPostcodeLookupFailure = hasFullPostcode && postcodeMatches.length === 0;
  const hasMultipleSuburbMatches = postcodeMatches.length > 1;
  const singlePostcodeLocation = postcodeMatches.length === 1 ? postcodeMatches[0] : undefined;
  const resolvedState = singlePostcodeLocation?.state ?? selectedLocation?.state ?? "";
  const postcodeHint =
    !normalizedPostcode
      ? "Enter a 4-digit Australian postcode to match suburb and state."
      : !hasFullPostcode
        ? "Please enter a valid 4-digit Australian postcode"
        : hasPostcodeLookupFailure
          ? "Please enter a valid 4-digit Australian postcode"
          : hasMultipleSuburbMatches
            ? selectedLocation
              ? `${postcodeMatches.length} matching suburbs found. Seller state is filled automatically.`
              : `Select the correct suburb for postcode ${normalizedPostcode}.`
            : `Matched to ${singlePostcodeLocation?.suburb}, ${singlePostcodeLocation?.state}`;
  const postcodeHintClass =
    !normalizedPostcode
      ? classes.hint
      : !hasFullPostcode || hasPostcodeLookupFailure
        ? "text-xs leading-5 text-red-600"
        : classes.hint;

  useEffect(() => {
    if (!hasFullPostcode) {
      return;
    }

    if (!postcodeMatches.length) {
      if (value.sellerLocationSuburb) onFieldChange("sellerLocationSuburb", "");
      if (value.sellerLocationState) onFieldChange("sellerLocationState", "");
      return;
    }

    if (singlePostcodeLocation) {
      if (value.sellerLocationSuburb !== singlePostcodeLocation.suburb) {
        onFieldChange("sellerLocationSuburb", singlePostcodeLocation.suburb);
      }
      if (value.sellerLocationState !== singlePostcodeLocation.state) {
        onFieldChange("sellerLocationState", singlePostcodeLocation.state);
      }
      return;
    }

    if (!selectedLocation) {
      if (value.sellerLocationSuburb) onFieldChange("sellerLocationSuburb", "");
      if (value.sellerLocationState) onFieldChange("sellerLocationState", "");
      return;
    }

    if (value.sellerLocationState !== selectedLocation.state) {
      onFieldChange("sellerLocationState", selectedLocation.state);
    }
  }, [
    hasFullPostcode,
    onFieldChange,
    postcodeMatches,
    selectedLocation,
    singlePostcodeLocation,
    value.sellerLocationState,
    value.sellerLocationSuburb
  ]);

  return (
    <div className="space-y-4">
      <label className="space-y-2">
        <span className={classes.label}>Year</span>
        <Input
          type="number"
          min="1900"
          value={value.year}
          onChange={(event) => onFieldChange("year", event.target.value)}
          className={classes.input}
          required
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <label className="space-y-2">
            <span className={classes.label}>Make</span>
            <select
              value={value.make}
              onChange={(event) => onFieldChange("make", event.target.value)}
              className={classes.select}
              required
            >
              <option value="">SELECT MAKE</option>
              {makeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className={classes.label}>Target asking price</span>
            <Input
              type="number"
              min="0"
              value={value.price}
              onChange={(event) => onFieldChange("price", event.target.value)}
              className={classes.input}
              required
            />
          </label>
          <label className="space-y-2">
            <span className={classes.label}>Transmission</span>
            <select
              value={value.transmission}
              onChange={(event) => onFieldChange("transmission", event.target.value)}
              className={`${classes.select} uppercase`}
              required
            >
              <option value="">SELECT TRANSMISSION</option>
              {TRANSMISSION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className={classes.label}>Drivetrain</span>
            <select
              value={value.drivetrain}
              onChange={(event) => onFieldChange("drivetrain", event.target.value)}
              className={`${classes.select} uppercase`}
              required
            >
              <option value="">SELECT DRIVETRAIN</option>
              {DRIVETRAIN_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className={classes.label}>Colour</span>
            <Input
              value={value.colour}
              onChange={(event) => onFieldChange("colour", normalizeUppercase(event.target.value))}
              className={`${classes.input} uppercase`}
              required
            />
          </label>
          <label className="space-y-2">
            <span className={classes.label}>Service history</span>
            <select
              value={value.serviceHistory}
              onChange={(event) => onFieldChange("serviceHistory", event.target.value)}
              className={`${classes.select} uppercase`}
              required
            >
              <option value="">SELECT SERVICE HISTORY</option>
              {SERVICE_HISTORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className={classes.label}>Seller suburb</span>
            {hasMultipleSuburbMatches ? (
              <select
                value={selectedLocation?.suburb ?? ""}
                onChange={(event) => onFieldChange("sellerLocationSuburb", event.target.value)}
                className={`${classes.select} uppercase`}
                required
              >
                <option value="">SELECT SUBURB</option>
                {postcodeMatches.map((location) => (
                  <option key={`${normalizedPostcode}-${location.suburb}-${location.state}`} value={location.suburb}>
                    {location.suburb}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                value={singlePostcodeLocation?.suburb ?? (!hasFullPostcode ? value.sellerLocationSuburb : "")}
                readOnly
                className={`${classes.input} uppercase`}
                placeholder={hasPostcodeLookupFailure ? "No suburb found" : "Enter postcode first"}
                required={Boolean(singlePostcodeLocation)}
              />
            )}
            <p className={classes.hint}>
              {hasMultipleSuburbMatches
                ? "Choose the matching suburb for this postcode."
                : singlePostcodeLocation
                  ? "Seller suburb is filled automatically from the postcode."
                  : "Seller suburb is matched from the postcode dataset."}
            </p>
          </label>
          <label className="space-y-2">
            <span className={classes.label}>Postcode</span>
            <Input
              inputMode="numeric"
              maxLength={4}
              value={value.sellerLocationPostcode}
              onChange={(event) => onFieldChange("sellerLocationPostcode", normalizeAustralianPostcode(event.target.value))}
              className={classes.input}
              placeholder="3000"
              required
            />
            <p className={postcodeHintClass}>{postcodeHint}</p>
          </label>
          <label className="space-y-2">
            <span className={classes.label}>Description</span>
            {descriptionLead}
            <Textarea
              value={value.description}
              onChange={(event) => onFieldChange("description", event.target.value)}
              className={classes.input}
              required
            />
            {descriptionHint ? <div className={classes.hint}>{descriptionHint}</div> : null}
          </label>
        </div>

        <div className="space-y-4">
          <label className="space-y-2">
            <span className={classes.label}>Model</span>
            <Input
              value={value.model}
              onChange={(event) => onFieldChange("model", normalizeUppercase(event.target.value))}
              className={`${classes.input} uppercase`}
              required
            />
          </label>
          <label className="space-y-2">
            <span className={classes.label}>Mileage</span>
            <Input
              type="number"
              min="0"
              value={value.mileage}
              onChange={(event) => onFieldChange("mileage", event.target.value)}
              className={classes.input}
              required
            />
          </label>
          <label className="space-y-2">
            <span className={classes.label}>Fuel type</span>
            <select
              value={value.fuelType}
              onChange={(event) => onFieldChange("fuelType", event.target.value)}
              className={`${classes.select} uppercase`}
              required
            >
              <option value="">SELECT FUEL TYPE</option>
              {FUEL_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className={classes.label}>Body type</span>
            <select
              value={value.bodyType}
              onChange={(event) => onFieldChange("bodyType", event.target.value)}
              className={`${classes.select} uppercase`}
              required
            >
              <option value="">SELECT BODY TYPE</option>
              {BODY_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className={classes.label}>Rego expiry</span>
            <AustralianDatePicker
              value={value.regoExpiry}
              onChange={(nextValue) => onFieldChange("regoExpiry", nextValue)}
              classes={classes}
              theme={theme}
            />
          </label>
          <label className="space-y-2">
            <span className={classes.label}>Keys</span>
            <select
              value={value.keyCount}
              onChange={(event) => onFieldChange("keyCount", event.target.value)}
              className={`${classes.select} uppercase`}
              required
            >
              <option value="">SELECT KEYS</option>
              {KEY_COUNT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className={classes.label}>Seller state</span>
            <Input
              value={resolvedState || (!hasFullPostcode ? value.sellerLocationState : "")}
              readOnly
              className={`${classes.input} uppercase`}
              required={Boolean(resolvedState)}
            />
            <p className={classes.hint}>Seller state stays aligned with the selected postcode and suburb.</p>
          </label>
        </div>
      </div>
    </div>
  );
}
