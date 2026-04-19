"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { createVehicle, deleteVehicleImage, updateVehicle } from "@/lib/data";
import { isFirebaseConfigured, isFirebaseStorageConfigured } from "@/lib/firebase";
import { optimizeVehicleImages, VEHICLE_IMAGE_UPLOAD_LIMIT } from "@/lib/image-processing";
import { uploadVehicleImages } from "@/lib/storage";
import { VEHICLE_PLACEHOLDER_IMAGE } from "@/lib/constants";
import { Vehicle, VehicleFormFieldsValue, VehicleFormInput } from "@/types";
import {
  VehicleFormFields,
  buildVehicleFormFieldsValue,
  validateVehicleFormFields
} from "@/components/forms/vehicle-form-fields";

interface SelectedImage {
  id: string;
  file: File;
  previewUrl: string;
}

interface ImagePreviewItem {
  key: string;
  src: string;
  source: "existing" | "selected";
  selectedImageId?: string;
}

function getListingModeLabel(listingType: Vehicle["listingType"]) {
  return listingType === "warehouse" ? "WAREHOUSE MANAGED" : "ONLINE LISTING ONLY";
}

function moveItemToFront<T>(items: T[], index: number) {
  if (index <= 0 || index >= items.length) return items;
  return [items[index], ...items.slice(0, index), ...items.slice(index + 1)];
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
  const [deletingImageUrl, setDeletingImageUrl] = useState("");
  const [message, setMessage] = useState("");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [formValues, setFormValues] = useState<VehicleFormFieldsValue>(buildVehicleFormFieldsValue(vehicle));
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>(vehicle?.imageUrls?.length ? vehicle.imageUrls : vehicle?.images ?? []);
  const [listingType, setListingType] = useState<Vehicle["listingType"]>(vehicle?.listingType ?? "warehouse");
  const [imageMode, setImageMode] = useState<"append" | "replace">("append");
  const [activeVehicle, setActiveVehicle] = useState<Vehicle | undefined>(vehicle);
  const currentVehicle = activeVehicle ?? vehicle;
  const [coverImageKey, setCoverImageKey] = useState<string | null>(null);

  useEffect(() => {
    setActiveVehicle(vehicle);
    setExistingImageUrls(vehicle?.imageUrls?.length ? vehicle.imageUrls : vehicle?.images ?? []);
    setCoverImageKey(null);
    setFormValues(
      buildVehicleFormFieldsValue(
        vehicle,
        appUser?.role === "seller" && vehicle?.pendingDescription ? vehicle.pendingDescription : undefined
      )
    );
  }, [appUser?.role, vehicle]);

  useEffect(() => {
    return () => {
      selectedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, [selectedImages]);

  useEffect(() => {
    const visibleKeys = new Set(
      (imageMode === "append"
        ? [
            ...existingImageUrls.map((imageUrl) => `existing:${imageUrl}`),
            ...selectedImages.map((image) => `selected:${image.id}`)
          ]
        : selectedImages.map((image) => `selected:${image.id}`))
    );

    if (coverImageKey && !visibleKeys.has(coverImageKey)) {
      setCoverImageKey(null);
    }
  }, [coverImageKey, existingImageUrls, imageMode, selectedImages]);

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
      const existingImageCount = currentVehicle && imageMode === "append" ? existingImageUrls.length : 0;
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

  async function handleDeleteExistingImage(imageUrl: string) {
    if (loading || !appUser || !currentVehicle) return;

    if (existingImageUrls.length <= 1) {
      setMessage("Upload a replacement before removing the final saved image.");
      return;
    }

    const confirmed = window.confirm("Delete this image from the listing?");
    if (!confirmed) return;

    setDeletingImageUrl(imageUrl);
    setMessage("");

    try {
      const result = await deleteVehicleImage(currentVehicle.id, imageUrl, appUser, currentVehicle);
      setActiveVehicle(result.vehicle);
      setExistingImageUrls(result.vehicle.imageUrls?.length ? result.vehicle.imageUrls : result.vehicle.images);
      setMessage(
        result.writeSucceeded && !result.storageDeleteSucceeded
          ? "Image removed from the listing. The storage file could not be deleted automatically."
          : "Image deleted."
      );
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setDeletingImageUrl("");
    }
  }

  function setSelectedImageAsCover(imageId: string) {
    const imageIndex = selectedImages.findIndex((image) => image.id === imageId);
    if (imageIndex < 0) return;

    setSelectedImages((current) => moveItemToFront(current, imageIndex));
    setCoverImageKey(`selected:${imageId}`);
  }

  function setExistingImageAsCover(imageUrl: string) {
    setCoverImageKey(`existing:${imageUrl}`);
  }

  const previewItems = useMemo<ImagePreviewItem[]>(() => {
    const items =
      selectedImages.length
        ? currentVehicle && imageMode === "append"
          ? [
              ...existingImageUrls.map((imageUrl) => ({ key: `existing:${imageUrl}`, src: imageUrl, source: "existing" as const })),
              ...selectedImages.map((image) => ({
                key: `selected:${image.id}`,
                src: image.previewUrl,
                source: "selected" as const,
                selectedImageId: image.id
              }))
            ]
          : selectedImages.map((image) => ({
              key: `selected:${image.id}`,
              src: image.previewUrl,
              source: "selected" as const,
              selectedImageId: image.id
            }))
        : existingImageUrls.length
          ? existingImageUrls.map((imageUrl) => ({ key: `existing:${imageUrl}`, src: imageUrl, source: "existing" as const }))
          : [{ key: "placeholder", src: VEHICLE_PLACEHOLDER_IMAGE, source: "existing" as const }];

    if (!coverImageKey) return items;

    const coverIndex = items.findIndex((item) => item.key === coverImageKey);
    return coverIndex > 0 ? moveItemToFront(items, coverIndex) : items;
  }, [coverImageKey, currentVehicle, existingImageUrls, imageMode, selectedImages]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !appUser) return;
    const validationError = validateVehicleFormFields(formValues);
    if (validationError) {
      setMessage(validationError);
      return;
    }
    setSaving(true);
    setMessage("");

    try {
      const files = selectedImages.map((image) => image.file);
      let imageUrls = [...existingImageUrls];

      if (files.length && isFirebaseStorageConfigured) {
        const uploadedUrls = await uploadVehicleImages(files, currentVehicle?.ownerUid ?? appUser.id);
        if (currentVehicle && imageMode === "append") {
          if (coverImageKey?.startsWith("selected:")) {
            const selectedId = coverImageKey.replace("selected:", "");
            const coverIndex = selectedImages.findIndex((image) => image.id === selectedId);
            const coverUrl = coverIndex >= 0 ? uploadedUrls[coverIndex] : "";
            imageUrls = coverUrl
              ? [coverUrl, ...existingImageUrls, ...uploadedUrls.filter((_, index) => index !== coverIndex)]
              : [...existingImageUrls, ...uploadedUrls];
          } else if (coverImageKey?.startsWith("existing:")) {
            const coverUrl = coverImageKey.replace("existing:", "");
            imageUrls = [coverUrl, ...existingImageUrls.filter((imageUrl) => imageUrl !== coverUrl), ...uploadedUrls];
          } else {
            imageUrls = [...existingImageUrls, ...uploadedUrls];
          }
        } else if (coverImageKey?.startsWith("selected:")) {
          const selectedId = coverImageKey.replace("selected:", "");
          const coverIndex = selectedImages.findIndex((image) => image.id === selectedId);
          const coverUrl = coverIndex >= 0 ? uploadedUrls[coverIndex] : "";
          imageUrls = coverUrl ? [coverUrl, ...uploadedUrls.filter((_, index) => index !== coverIndex)] : uploadedUrls;
        } else {
          imageUrls = uploadedUrls;
        }
      } else if (coverImageKey?.startsWith("existing:")) {
        const coverUrl = coverImageKey.replace("existing:", "");
        imageUrls = [coverUrl, ...existingImageUrls.filter((imageUrl) => imageUrl !== coverUrl)];
      }

      const payload: VehicleFormInput = {
        listingType,
        make: formValues.make,
        model: formValues.model,
        year: Number(formValues.year),
        price: Number(formValues.price),
        mileage: Number(formValues.mileage),
        transmission: formValues.transmission,
        fuelType: formValues.fuelType,
        drivetrain: formValues.drivetrain,
        bodyType: formValues.bodyType,
        colour: formValues.colour,
        regoExpiry: formValues.regoExpiry,
        serviceHistory: formValues.serviceHistory,
        keyCount: formValues.keyCount,
        sellerLocationSuburb: formValues.sellerLocationSuburb,
        sellerLocationPostcode: formValues.sellerLocationPostcode,
        sellerLocationState: formValues.sellerLocationState,
        description: formValues.description,
        coverImage: imageUrls[0] || currentVehicle?.coverImage || currentVehicle?.coverImageUrl || "",
        coverImageUrl: imageUrls[0] || currentVehicle?.coverImageUrl || "",
        imageUrls,
        images: imageUrls
      };

      const result = currentVehicle
        ? await updateVehicle(currentVehicle.id, payload, appUser, currentVehicle)
        : await createVehicle(payload, appUser);
      const descriptionReviewPending =
        "descriptionReviewPending" in result ? Boolean(result.descriptionReviewPending) : false;

      if (currentVehicle) {
        setActiveVehicle(result.vehicle);
        setExistingImageUrls(result.vehicle.imageUrls?.length ? result.vehicle.imageUrls : result.vehicle.images);
        setCoverImageKey(null);
        setFormValues(
          buildVehicleFormFieldsValue(
            result.vehicle,
            appUser.role === "seller" && descriptionReviewPending ? formValues.description : undefined
          )
        );
      }

      if (currentVehicle) {
        setMessage(
          appUser.role === "seller" && descriptionReviewPending
            ? "Your description update is under review and will go live once approved."
            : "Vehicle updated successfully."
        );
      } else {
        setMessage(result.writeSucceeded ? "Vehicle created successfully." : "Vehicle created successfully.");
      }

      const basePath =
        appUser.role === "seller" && currentVehicle
          ? `/seller/vehicles/${result.vehicle.id}/edit`
          : appUser.role === "seller"
            ? "/seller/vehicles"
            : "/admin/vehicles";
      router.replace(
        `${basePath}?write=${result.writeSucceeded ? "success" : "mock"}&action=${vehicle ? "update" : "create"}&loadedHint=refresh&vehicleId=${result.vehicle.id}${appUser.role === "seller" && descriptionReviewPending ? "&descriptionReview=pending" : ""}`
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
      {currentVehicle && appUser?.role === "seller" && currentVehicle.ownerUid !== appUser.id ? (
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
      {appUser?.role === "seller" && currentVehicle?.pendingDescription ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Your description update is under review and will go live once approved.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {listingTypeReadOnly ? (
          <div className="space-y-2">
            <span className="text-sm font-medium text-ink">Current listing mode</span>
            <input type="hidden" name="listingType" value={listingType} />
            <div className="rounded-2xl border border-black/10 bg-shell px-4 py-3 text-sm font-medium uppercase tracking-[0.16em] text-ink/80">
              {getListingModeLabel(listingType)}
            </div>
          </div>
        ) : (
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Listing type</span>
            <select
              value={listingType}
              onChange={(event) => setListingType(event.target.value as Vehicle["listingType"])}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
            >
              <option value="warehouse">Warehouse</option>
              <option value="private">Private</option>
            </select>
          </label>
        )}
      </div>
      <VehicleFormFields
        value={formValues}
        onFieldChange={(field, nextValue) => setFormValues((current) => ({ ...current, [field]: nextValue }))}
        theme="light"
        descriptionLead={
          appUser?.role === "seller" && currentVehicle?.pendingDescription ? (
            <div className="rounded-[20px] border border-black/5 bg-shell px-4 py-3 text-sm leading-6 text-ink/70">
              <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Current live description</p>
              <p className="mt-2 whitespace-pre-wrap">{currentVehicle.description}</p>
            </div>
          ) : null
        }
        descriptionHint={
          appUser?.role === "seller"
            ? currentVehicle?.pendingDescription
              ? "This textarea is your pending description under review. Do not include phone numbers, email addresses, or instructions to contact outside CarNest."
              : "Description changes are reviewed before publishing. Do not include phone numbers, email addresses, or instructions to contact outside CarNest."
            : undefined
        }
      />

      <div className="space-y-3">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink">Vehicle images</span>
          {currentVehicle ? (
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
          Maximum 21 images allowed. Images are automatically optimised for faster upload and local previews still work even when cloud upload is disabled.
        </p>
        {processingImages ? <p className="text-sm text-ink/60">Preparing images...</p> : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {previewItems.map((image, index) => (
            <div key={image.key} className="relative h-44 overflow-hidden rounded-[24px] border border-black/5 bg-shell">
              <Image src={image.src} alt={`Vehicle preview ${index + 1}`} fill className="object-cover" unoptimized={image.src.startsWith("blob:")} />
              {image.key !== "placeholder" ? (
                <>
                  {index === 0 ? (
                    <span className="absolute left-3 top-3 rounded-full bg-ink px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                      Cover
                    </span>
                  ) : image.source === "selected" && image.selectedImageId ? (
                    <button
                      type="button"
                      onClick={() => setSelectedImageAsCover(image.selectedImageId!)}
                      className="absolute left-3 top-3 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white transition hover:bg-black/80"
                    >
                      Set as cover
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setExistingImageAsCover(image.src)}
                      className="absolute left-3 top-3 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white transition hover:bg-black/80"
                    >
                      Set as cover
                    </button>
                  )}
                </>
              ) : null}
              {image.source === "selected" && image.selectedImageId ? (
                <button
                  type="button"
                  onClick={() => removeSelectedImage(image.selectedImageId!)}
                  className="absolute right-3 top-3 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white transition hover:bg-black/80"
                >
                  Remove
                </button>
              ) : image.key !== "placeholder" ? (
                <button
                  type="button"
                  onClick={() => void handleDeleteExistingImage(image.src)}
                  disabled={deletingImageUrl === image.src}
                  className="absolute right-3 top-3 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {deletingImageUrl === image.src ? "..." : "×"}
                </button>
              ) : null}
              {image.key !== "placeholder" ? (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-white">
                  {index === 0 ? "Primary listing image" : "Gallery image"}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {message ? <p className="rounded-[24px] bg-shell px-4 py-3 text-sm leading-6 text-ink/70">{message}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={saving || deletingImageUrl !== "" || loading || !appUser || (currentVehicle ? appUser.role === "seller" && currentVehicle.ownerUid !== appUser.id : appUser.role === "buyer")}>
          {saving && selectedImages.length && isFirebaseStorageConfigured
            ? "Uploading images..."
            : saving
              ? "Saving..."
              : currentVehicle
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
