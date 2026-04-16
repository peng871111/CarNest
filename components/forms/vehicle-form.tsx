"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { createVehicle, updateVehicle } from "@/lib/data";
import { isFirebaseConfigured, isFirebaseStorageConfigured } from "@/lib/firebase";
import { optimizeVehicleImages, VEHICLE_IMAGE_UPLOAD_LIMIT } from "@/lib/image-processing";
import { uploadVehicleImages } from "@/lib/storage";
import { VEHICLE_PLACEHOLDER_IMAGE } from "@/lib/constants";
import { Vehicle, VehicleFormInput } from "@/types";

const FUEL_TYPE_OPTIONS = ["PETROL", "DIESEL", "EV", "PHEV", "HEV", "HYBRID", "LPG", "OTHER"];
const TRANSMISSION_OPTIONS = ["AT", "MT", "DCT", "CVT", "PDK", "OTHER"];
const BODY_TYPE_OPTIONS = ["SUV", "SEDAN", "COUPE", "HATCH", "UTE", "WAGON", "CONVERTIBLE", "VAN", "OTHER"];
const SERVICE_HISTORY_OPTIONS = ["FULL DEALER SERVICE HISTORY", "PARTIAL DEALER SERVICE HISTORY", "NO SERVICE HISTORY"];
const KEY_COUNT_OPTIONS = ["1 KEY", "2 KEYS", "3 KEYS"];

function uppercaseValue(value: FormDataEntryValue | null) {
  return String(value ?? "").toUpperCase();
}

function applyUppercaseInput(event: FormEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  input.value = input.value.toUpperCase();
}

interface SelectedImage {
  id: string;
  file: File;
  previewUrl: string;
}

const initialState: VehicleFormInput = {
  listingType: "warehouse",
  make: "",
  model: "",
  year: new Date().getFullYear(),
  price: 0,
  mileage: 0,
  transmission: "",
  fuelType: "",
  drivetrain: "",
  bodyType: "",
  colour: "",
  serviceHistory: "",
  keyCount: "",
  sellerLocationSuburb: "",
  sellerLocationState: "",
  description: "",
  coverImage: "",
  coverImageUrl: "",
  imageUrls: [],
  images: []
};

function getListingModeLabel(listingType: Vehicle["listingType"]) {
  return listingType === "warehouse" ? "WAREHOUSE MANAGED" : "ONLINE LISTING ONLY";
}

export function VehicleForm({
  vehicle,
  listingTypeReadOnly = false
}: {
  vehicle?: Vehicle;
  listingTypeReadOnly?: boolean;
}) {
  const router = useRouter();
  const { appUser, loading } = useAuth();
  const [saving, setSaving] = useState(false);
  const [processingImages, setProcessingImages] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [listingType, setListingType] = useState<Vehicle["listingType"]>(vehicle?.listingType ?? "warehouse");
  const [imageMode, setImageMode] = useState<"append" | "replace">("append");

  const defaultValues = useMemo<VehicleFormInput>(
    () =>
      vehicle
        ? {
            listingType: vehicle.listingType,
            make: vehicle.make.toUpperCase(),
            model: vehicle.model.toUpperCase(),
            year: vehicle.year,
            price: vehicle.price,
            mileage: vehicle.mileage,
            transmission: vehicle.transmission.toUpperCase(),
            fuelType: vehicle.fuelType.toUpperCase(),
            drivetrain: vehicle.drivetrain,
            bodyType: vehicle.bodyType.toUpperCase(),
            colour: vehicle.colour,
            serviceHistory: vehicle.serviceHistory?.toUpperCase?.() ?? "",
            keyCount: vehicle.keyCount?.toUpperCase?.() ?? "",
            sellerLocationSuburb: vehicle.sellerLocationSuburb?.toUpperCase() ?? "",
            sellerLocationState: vehicle.sellerLocationState?.toUpperCase() ?? "",
            description: vehicle.description,
            coverImage: vehicle.coverImage ?? vehicle.coverImageUrl ?? vehicle.imageUrls[0] ?? vehicle.images[0] ?? "",
            coverImageUrl: vehicle.coverImageUrl ?? vehicle.imageUrls[0] ?? vehicle.images[0] ?? "",
            imageUrls: vehicle.imageUrls?.length ? vehicle.imageUrls : vehicle.images,
            images: vehicle.imageUrls?.length ? vehicle.imageUrls : vehicle.images
          }
        : initialState,
    [vehicle]
  );

  useEffect(() => {
    return () => {
      selectedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, [selectedImages]);

  async function handleImageSelection(files: FileList | null) {
    if (!files?.length) {
      setSelectedImages((current) => {
        current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
        return [];
      });
      return;
    }

    setProcessingImages(true);
    setMessage("");

    try {
      const existingImageCount = vehicle && imageMode === "append" ? defaultValues.imageUrls.length : 0;
      const remainingSlots = Math.max(0, VEHICLE_IMAGE_UPLOAD_LIMIT - existingImageCount);
      const acceptedFiles = Array.from(files).slice(0, remainingSlots);

      if (files.length > remainingSlots) {
        setMessage("Maximum 21 images allowed");
      }

      const processedFiles = await optimizeVehicleImages(acceptedFiles);
      const nextImages = processedFiles.map((file, index) => ({
        id: `${file.name}-${index}-${Date.now()}`,
        file,
        previewUrl: URL.createObjectURL(file)
      }));

      setSelectedImages((current) => {
        current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
        return nextImages;
      });
    } catch (imageError) {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setProcessingImages(false);
    }
  }

  function removeSelectedImage(imageId: string) {
    setSelectedImages((current) => {
      const image = current.find((item) => item.id === imageId);
      if (image) URL.revokeObjectURL(image.previewUrl);
      return current.filter((item) => item.id !== imageId);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !appUser) return;
    setSaving(true);
    setMessage("");

    try {
      const form = new FormData(event.currentTarget);
      const files = selectedImages.map((image) => image.file);
      const existingImageUrls = vehicle?.imageUrls?.length ? vehicle.imageUrls : vehicle?.images ?? [];
      let imageUrls = existingImageUrls;

      if (files.length && isFirebaseStorageConfigured) {
        const uploadedUrls = await uploadVehicleImages(files, appUser.id);
        imageUrls = vehicle && imageMode === "append" ? [...existingImageUrls, ...uploadedUrls] : uploadedUrls;
      }

      const payload: VehicleFormInput = {
        listingType: String(form.get("listingType")) as Vehicle["listingType"],
        make: uppercaseValue(form.get("make")),
        model: uppercaseValue(form.get("model")),
        year: Number(form.get("year")),
        price: Number(form.get("price")),
        mileage: Number(form.get("mileage")),
        transmission: uppercaseValue(form.get("transmission")),
        fuelType: uppercaseValue(form.get("fuelType")),
        drivetrain: String(form.get("drivetrain")),
        bodyType: uppercaseValue(form.get("bodyType")),
        colour: String(form.get("colour")),
        serviceHistory: uppercaseValue(form.get("serviceHistory")),
        keyCount: uppercaseValue(form.get("keyCount")),
        sellerLocationSuburb: uppercaseValue(form.get("sellerLocationSuburb")),
        sellerLocationState: uppercaseValue(form.get("sellerLocationState")),
        description: String(form.get("description")),
        coverImage: imageUrls[0] || vehicle?.coverImage || vehicle?.coverImageUrl || "",
        coverImageUrl: imageUrls[0] || vehicle?.coverImageUrl || "",
        imageUrls,
        images: imageUrls
      };

      const result = vehicle
        ? await updateVehicle(vehicle.id, payload, appUser, vehicle)
        : await createVehicle(payload, appUser);

      if (vehicle) {
        setMessage(result.writeSucceeded ? "Vehicle updated successfully." : "Vehicle updated successfully.");
      } else {
        setMessage(result.writeSucceeded ? "Vehicle created successfully." : "Vehicle created successfully.");
      }

      const basePath = appUser.role === "seller" ? "/seller/vehicles" : "/admin/vehicles";
      router.replace(
        `${basePath}?write=${result.writeSucceeded ? "success" : "mock"}&action=${vehicle ? "update" : "create"}&loadedHint=refresh&vehicleId=${result.vehicle.id}`
      );
      router.refresh();
    } catch (error) {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
      {vehicle && appUser?.role === "seller" && vehicle.ownerUid !== appUser.id ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900">
          You cannot edit a vehicle you do not own.
        </div>
      ) : null}
      {appUser?.role === "admin" && !isFirebaseConfigured ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Live saving is not available yet in this environment. You can continue working with the form, but changes will not be published until the project connection is complete.
        </div>
      ) : null}
      {appUser?.role === "admin" && !isFirebaseStorageConfigured ? (
        <div className="rounded-[24px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
          Image upload will be available once storage is ready in this environment.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {listingTypeReadOnly ? (
          <div className="space-y-2">
            <span className="text-sm font-medium text-ink">Current listing mode</span>
            <input type="hidden" name="listingType" value={defaultValues.listingType} />
            <div className="rounded-2xl border border-black/10 bg-shell px-4 py-3 text-sm font-medium uppercase tracking-[0.16em] text-ink/80">
              {getListingModeLabel(defaultValues.listingType)}
            </div>
          </div>
        ) : (
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Listing type</span>
            <select
              name="listingType"
              defaultValue={defaultValues.listingType}
              onChange={(event) => setListingType(event.target.value as Vehicle["listingType"])}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
            >
              <option value="warehouse">Warehouse</option>
              <option value="private">Private</option>
            </select>
          </label>
        )}
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Year</span>
          <Input type="number" name="year" min="1900" defaultValue={defaultValues.year} required />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Make</span>
          <Input name="make" defaultValue={defaultValues.make} className="uppercase" onInput={applyUppercaseInput} required />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Model</span>
          <Input name="model" defaultValue={defaultValues.model} className="uppercase" onInput={applyUppercaseInput} required />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Price</span>
          <Input type="number" name="price" min="0" defaultValue={defaultValues.price} required />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Mileage</span>
          <Input type="number" name="mileage" min="0" defaultValue={defaultValues.mileage} required />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Transmission</span>
          <select
            name="transmission"
            defaultValue={defaultValues.transmission}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm uppercase"
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
          <span className="text-sm font-medium text-ink">Fuel type</span>
          <select
            name="fuelType"
            defaultValue={defaultValues.fuelType}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm uppercase"
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
          <span className="text-sm font-medium text-ink">Drivetrain</span>
          <Input name="drivetrain" defaultValue={defaultValues.drivetrain} required />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Body type</span>
          <select
            name="bodyType"
            defaultValue={defaultValues.bodyType}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm uppercase"
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
          <span className="text-sm font-medium text-ink">Colour</span>
          <Input name="colour" defaultValue={defaultValues.colour} required />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Service history</span>
          <select
            name="serviceHistory"
            defaultValue={defaultValues.serviceHistory}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm uppercase"
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
          <span className="text-sm font-medium text-ink">Keys</span>
          <select
            name="keyCount"
            defaultValue={defaultValues.keyCount}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm uppercase"
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
          <span className="text-sm font-medium text-ink">Seller suburb</span>
          <Input
            name="sellerLocationSuburb"
            defaultValue={defaultValues.sellerLocationSuburb}
            placeholder={listingType === "private" ? "Required for private listings" : "Not shown for warehouse listings"}
            className="uppercase"
            onInput={applyUppercaseInput}
            required={listingType === "private"}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Seller state</span>
          <Input
            name="sellerLocationState"
            defaultValue={defaultValues.sellerLocationState}
            placeholder={listingType === "private" ? "Stored for admin context" : "Not shown for warehouse listings"}
            className="uppercase"
            onInput={applyUppercaseInput}
          />
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-ink">Description</span>
        <Textarea name="description" defaultValue={defaultValues.description} required />
      </label>

      <div className="space-y-3">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink">Vehicle images</span>
          {vehicle ? (
            <select
              value={imageMode}
              onChange={(event) => setImageMode(event.target.value as "append" | "replace")}
              className="mb-3 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
            >
              <option value="append">Append uploaded images</option>
              <option value="replace">Replace existing images</option>
            </select>
          ) : null}
          <input
            type="file"
            name="images"
            accept="image/*"
            multiple
            onChange={(event) => void handleImageSelection(event.target.files)}
            className="block w-full rounded-2xl border border-dashed border-black/15 bg-shell px-4 py-4 text-sm text-ink/65"
          />
        </label>
        <p className="text-xs uppercase tracking-[0.22em] text-ink/45">
          Maximum 21 images allowed. Images are compressed before upload and local previews still work even when cloud upload is disabled.
        </p>
        {processingImages ? <p className="text-sm text-ink/60">Preparing images...</p> : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(
            selectedImages.length
              ? vehicle && imageMode === "append"
                ? [...defaultValues.imageUrls, ...selectedImages.map((image) => image.previewUrl)]
                : selectedImages.map((image) => image.previewUrl)
              : defaultValues.imageUrls.length
                ? defaultValues.imageUrls
                : [VEHICLE_PLACEHOLDER_IMAGE]
          ).map((image, index) => (
            <div key={`${image}-${index}`} className="relative h-44 overflow-hidden rounded-[24px] border border-black/5 bg-shell">
              <Image src={image} alt={`Vehicle preview ${index + 1}`} fill className="object-cover" unoptimized={image.startsWith("blob:")} />
              {selectedImages[index - (vehicle && imageMode === "append" ? defaultValues.imageUrls.length : 0)] ? (
                <button
                  type="button"
                  onClick={() =>
                    removeSelectedImage(
                      selectedImages[index - (vehicle && imageMode === "append" ? defaultValues.imageUrls.length : 0)].id
                    )
                  }
                  className="absolute right-3 top-3 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white transition hover:bg-black/80"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {message ? <p className="rounded-[24px] bg-shell px-4 py-3 text-sm leading-6 text-ink/70">{message}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={saving || loading || !appUser || (vehicle ? appUser.role === "seller" && vehicle.ownerUid !== appUser.id : appUser.role === "buyer")}>
          {saving && selectedImages.length && isFirebaseStorageConfigured
            ? "Uploading images..."
            : saving
              ? "Saving..."
              : vehicle
                ? "Update vehicle"
                : "Create vehicle"}
        </Button>
        <Button
          type="button"
          className="bg-white text-ink ring-1 ring-black/10 hover:bg-shell"
          onClick={() => router.push(appUser?.role === "seller" ? "/seller/vehicles" : "/admin/vehicles")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
