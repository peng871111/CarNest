"use client";

import { FormEvent, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCalendarDate } from "@/lib/utils";
import { Vehicle, VehicleFormFieldsValue } from "@/types";

export const TRANSMISSION_OPTIONS = ["AT", "MT", "DCT", "CVT", "PDK", "OTHER"];
export const FUEL_TYPE_OPTIONS = ["PETROL", "DIESEL", "EV", "PHEV", "HEV", "HYBRID", "LPG", "OTHER"];
export const DRIVETRAIN_OPTIONS = ["FWD", "RWD", "AWD", "4WD", "OTHER"];
export const BODY_TYPE_OPTIONS = ["SUV", "SEDAN", "COUPE", "HATCH", "UTE", "WAGON", "CONVERTIBLE", "VAN", "OTHER"];
export const SERVICE_HISTORY_OPTIONS = ["FULL DEALER SERVICE HISTORY", "PARTIAL DEALER SERVICE HISTORY", "NO SERVICE HISTORY"];
export const KEY_COUNT_OPTIONS = ["1 KEY", "2 KEYS", "3 KEYS"];
export const STATE_OPTIONS = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"];

type VehicleFormTheme = "light" | "dark";

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

function blockManualDateEntry(event: FormEvent<HTMLInputElement>) {
  event.preventDefault();
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
    sellerLocationState: vehicle?.sellerLocationState ?? "",
    description: descriptionOverride ?? vehicle?.description ?? ""
  };
}

export function validateVehicleFormFields(values: VehicleFormFieldsValue) {
  if (!values.year.trim()) return "Please enter the vehicle year.";
  if (!values.make.trim()) return "Please enter the vehicle make.";
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
  if (!values.sellerLocationSuburb.trim()) return "Please enter the seller suburb.";
  if (!values.sellerLocationState.trim()) return "Please select the seller state.";
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
            <Input
              value={value.make}
              onChange={(event) => onFieldChange("make", normalizeUppercase(event.target.value))}
              className={`${classes.input} uppercase`}
              required
            />
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
            <Input
              value={value.sellerLocationSuburb}
              onChange={(event) => onFieldChange("sellerLocationSuburb", normalizeUppercase(event.target.value))}
              className={`${classes.input} uppercase`}
              required
            />
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
            <Input
              type="date"
              value={value.regoExpiry}
              lang="en-AU"
              onChange={(event) => onFieldChange("regoExpiry", event.target.value)}
              onBeforeInput={blockManualDateEntry}
              onPaste={(event) => event.preventDefault()}
              className={classes.input}
            />
            <p className={classes.preview}>
              {value.regoExpiry ? `Displayed in CarNest as ${formatCalendarDate(value.regoExpiry)}` : "Display format: DD/MM/YYYY"}
            </p>
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
            <select
              value={value.sellerLocationState}
              onChange={(event) => onFieldChange("sellerLocationState", event.target.value)}
              className={`${classes.select} uppercase`}
              required
            >
              <option value="">SELECT STATE</option>
              {STATE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
