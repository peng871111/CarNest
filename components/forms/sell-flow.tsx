"use client";

import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { createQuoteRequest, createVehicle } from "@/lib/data";
import { isFirebaseConfigured, isFirebaseStorageConfigured } from "@/lib/firebase";
import { prepareVehicleImageUploads } from "@/lib/image-processing";
import { uploadVehicleImageAssets } from "@/lib/storage";
import { VEHICLE_PLACEHOLDER_IMAGE } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { AppUser, PreparedVehicleImageUpload, VehicleFormFieldsValue, VehicleFormInput } from "@/types";
import {
  VehicleFormFields,
  buildVehicleFormFieldsValue,
  validateVehicleFormFields
} from "@/components/forms/vehicle-form-fields";

const STEPS = [
  { id: 1, title: "Vehicle details" },
  { id: 2, title: "Photos" },
  { id: 3, title: "Listing choice" },
  { id: 4, title: "Review and submit" }
] as const;

type ListingChoice = "basic" | "service_quote";

interface SellFlowState extends VehicleFormFieldsValue {
  listingChoice: ListingChoice;
  serviceQuoteNotes: string;
}

interface SellFlowDraft {
  form: SellFlowState;
  currentStep: number;
}

const initialState: SellFlowState = {
  ...buildVehicleFormFieldsValue(),
  listingChoice: "basic",
  serviceQuoteNotes: ""
};

function moveItemToFront<T>(items: T[], index: number) {
  if (index <= 0 || index >= items.length) return items;
  return [items[index], ...items.slice(0, index), ...items.slice(index + 1)];
}

function getSubmissionErrorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
}

function getSubmissionErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "");
}

function isPermissionDeniedError(error: unknown) {
  const code = getSubmissionErrorCode(error).toLowerCase();
  const message = getSubmissionErrorMessage(error).toLowerCase();
  return code.includes("permission-denied") || message.includes("missing or insufficient permissions");
}

function logSubmissionFailure(
  operation: "profile-setup" | "photo-upload" | "listing-create" | "quote-create",
  error: unknown,
  context?: Record<string, unknown>
) {
  console.error("[sell-flow] vehicle submission failed", {
    operation,
    code: getSubmissionErrorCode(error),
    message: getSubmissionErrorMessage(error),
    ...context,
    error
  });
}

function logSubmissionStage(
  operation: "profile-setup" | "photo-upload" | "listing-create" | "quote-create",
  status: "start" | "success",
  context?: Record<string, unknown>
) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.info("[sell-flow] vehicle submission stage", {
    operation,
    status,
    ...context
  });
}

function canSubmitVehicleForProfile(user: Pick<AppUser, "role" | "dealerStatus"> | null | undefined) {
  if (!user) return false;
  if (user.role === "dealer") return user.dealerStatus === "approved";
  return user.role === "seller" || user.role === "buyer";
}

function resolveSubmissionFailureMessage(
  operation: "profile-setup" | "photo-upload" | "listing-create" | "quote-create",
  error: unknown
) {
  if (operation === "profile-setup") {
    return "We couldn't finish setting up your account profile. Please refresh and try again.";
  }

  if (operation === "photo-upload") {
    return isPermissionDeniedError(error)
      ? "We couldn't upload your vehicle photos to your account storage. Please sign in again and try once more."
      : "We couldn't upload your vehicle photos right now. Please try again.";
  }

  if (operation === "listing-create") {
    return isPermissionDeniedError(error)
      ? "We couldn't create your listing because your account doesn't have permission to submit it yet. Please refresh and try again."
      : "We couldn't create your listing right now. Please try again.";
  }

  return isPermissionDeniedError(error)
    ? "Your vehicle was submitted, but we couldn't create the linked service quote request. Please contact CarNest support so we can finish it for you."
    : "Your vehicle was submitted, but we couldn't create the linked service quote request right now.";
}

export function SellFlow() {
  const router = useRouter();
  const { appUser, firebaseUser, loading, refreshProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [processingImages, setProcessingImages] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState<SellFlowState>(initialState);
  const [selectedImages, setSelectedImages] = useState<PreparedVehicleImageUpload[]>([]);
  const [draftReady, setDraftReady] = useState(false);
  const [bootstrapAttemptedUid, setBootstrapAttemptedUid] = useState<string | null>(null);
  const draftStorageKey = useMemo(() => `draft:sell-flow:${appUser?.id ?? firebaseUser?.uid ?? "anonymous"}`, [appUser?.id, firebaseUser?.uid]);

  const previewImages = useMemo(
    () => (selectedImages.length ? selectedImages.map((image) => image.previewUrl) : [VEHICLE_PLACEHOLDER_IMAGE]),
    [selectedImages]
  );

  useEffect(() => {
    return () => {
      selectedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, [selectedImages]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedDraft = window.localStorage.getItem(draftStorageKey);
    if (!savedDraft) {
      setDraftReady(true);
      return;
    }

    try {
      const parsedDraft = JSON.parse(savedDraft) as Partial<SellFlowDraft>;
      if (parsedDraft.form) {
        setForm((current) => ({ ...current, ...parsedDraft.form }));
      }

      if (typeof parsedDraft.currentStep === "number") {
        setCurrentStep(Math.min(Math.max(parsedDraft.currentStep, 1), 4));
      }
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    } finally {
      setDraftReady(true);
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (!draftReady || typeof window === "undefined") return;

    const draftPayload: SellFlowDraft = {
      form,
      currentStep
    };

    window.localStorage.setItem(draftStorageKey, JSON.stringify(draftPayload));
  }, [currentStep, draftReady, draftStorageKey, form]);

  useEffect(() => {
    if (!firebaseUser) {
      setBootstrapAttemptedUid(null);
      return;
    }

    if (loading || appUser || bootstrapAttemptedUid === firebaseUser.uid) {
      return;
    }

    setBootstrapAttemptedUid(firebaseUser.uid);
    void refreshProfile().catch((profileError) => {
      logSubmissionFailure("profile-setup", profileError, {
        userId: firebaseUser.uid,
        path: `/users/${firebaseUser.uid}`,
        ownerField: "uid",
        attemptedInBackground: true
      });
    });
  }, [appUser, bootstrapAttemptedUid, firebaseUser, loading, refreshProfile]);

  const isBlockedDealer = appUser?.role === "dealer" && appUser.dealerStatus !== "approved";
  const canSubmit = Boolean(firebaseUser) && !loading && (!appUser || canSubmitVehicleForProfile(appUser)) && !isBlockedDealer;

  function setField<K extends keyof SellFlowState>(key: K, value: SellFlowState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validateStep(step: number) {
    if (step === 1) {
      return validateVehicleFormFields(form);
    }

    if (step === 3 && form.listingChoice === "service_quote" && !form.serviceQuoteNotes.trim()) {
      return "Add a short note so CarNest knows what support you want quoted.";
    }

    return "";
  }

  function handleNext() {
    const nextError = validateStep(currentStep);
    if (nextError) {
      setError(nextError);
      return;
    }

    setError("");
    setCurrentStep((step) => Math.min(step + 1, 4));
  }

  function handleBack() {
    setError("");
    setCurrentStep((step) => Math.max(step - 1, 1));
  }

  function setSelectedFileAsCover(index: number) {
    setSelectedImages((current) => moveItemToFront(current, index));
  }

  async function handleImageSelection(files: FileList | null) {
    if (!files?.length) {
      setSelectedImages((current) => {
        current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
        return [];
      });
      return;
    }

    setProcessingImages(true);
    setError("");

    try {
      const processedFiles = await prepareVehicleImageUploads(Array.from(files));
      setSelectedImages((current) => {
        current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
        return processedFiles;
      });
    } catch {
      setError("We couldn't prepare your photos right now. Please try again.");
    } finally {
      setProcessingImages(false);
    }
  }

  async function handleSubmit() {
    if (!firebaseUser) {
      setError("Please sign in to submit your vehicle.");
      return;
    }

    const reviewError = validateStep(3);
    if (reviewError) {
      setError(reviewError);
      setCurrentStep(3);
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      let submissionActor = appUser;
      let quoteCreationFailed = false;
      let quoteCreationNotice = "";

      try {
        logSubmissionStage("profile-setup", "start", {
          userId: firebaseUser.uid,
          path: `/users/${firebaseUser.uid}`,
          ownerField: "uid"
        });
        submissionActor = await refreshProfile();
        if (!submissionActor) {
          throw new Error("User profile refresh returned an empty result.");
        }
        logSubmissionStage("profile-setup", "success", {
          userId: submissionActor.id,
          path: `/users/${submissionActor.id}`,
          ownerField: "uid",
          role: submissionActor.role
        });
      } catch (profileError) {
        logSubmissionFailure("profile-setup", profileError, {
          userId: firebaseUser.uid,
          listingChoice: form.listingChoice,
          path: `/users/${firebaseUser.uid}`,
          ownerField: "uid"
        });
        throw new Error(resolveSubmissionFailureMessage("profile-setup", profileError));
      }

      if (!canSubmitVehicleForProfile(submissionActor)) {
        setError(
          submissionActor.role === "dealer"
            ? "Your dealer application still needs approval before you can submit vehicles."
            : `You are currently signed in as a ${submissionActor.role}. Switch to a seller account to submit a vehicle.`
        );
        return;
      }

      let imageAssets = [] as Awaited<ReturnType<typeof uploadVehicleImageAssets>>;
      try {
        logSubmissionStage("photo-upload", "start", {
          userId: submissionActor.id,
          path: `vehicle-images/${submissionActor.id}/...`,
          ownerField: "auth.uid",
          imageCount: selectedImages.length
        });
        imageAssets =
          selectedImages.length && isFirebaseStorageConfigured ? await uploadVehicleImageAssets(selectedImages, submissionActor.id) : [];
        logSubmissionStage("photo-upload", "success", {
          userId: submissionActor.id,
          path: `vehicle-images/${submissionActor.id}/...`,
          ownerField: "auth.uid",
          imageCount: imageAssets.length
        });
      } catch (photoUploadError) {
        logSubmissionFailure("photo-upload", photoUploadError, {
          userId: submissionActor.id,
          imageCount: selectedImages.length,
          path: `vehicle-images/${submissionActor.id}/...`,
          ownerField: "auth.uid"
        });
        throw new Error(resolveSubmissionFailureMessage("photo-upload", photoUploadError));
      }

      const imageUrls = imageAssets.map((item) => item.fullUrl);

      const payload: VehicleFormInput = {
        listingType: "private",
        make: form.make,
        model: form.model,
        year: Number(form.year),
        price: Number(form.price || 0),
        mileage: Number(form.mileage || 0),
        transmission: form.transmission,
        fuelType: form.fuelType,
        drivetrain: form.drivetrain,
        bodyType: form.bodyType,
        colour: form.colour,
        regoExpiry: form.regoExpiry,
        serviceHistory: form.serviceHistory,
        keyCount: form.keyCount,
        sellerLocationSuburb: form.sellerLocationSuburb,
        sellerLocationPostcode: form.sellerLocationPostcode,
        sellerLocationState: form.sellerLocationState,
        description: form.description,
        videoUrl: form.videoUrl,
        coverImage: imageAssets[0]?.thumbnailUrl || imageUrls[0] || "",
        coverImageUrl: imageAssets[0]?.fullUrl || imageUrls[0] || "",
        imageAssets,
        imageUrls,
        images: imageUrls,
        submissionPreference: form.listingChoice,
        serviceQuoteNotes: form.listingChoice === "service_quote" ? form.serviceQuoteNotes : ""
      };

      let result;
      try {
        logSubmissionStage("listing-create", "start", {
          userId: submissionActor.id,
          collection: "vehicles",
          ownerFields: {
            ownerUid: submissionActor.id,
            sellerId: submissionActor.id
          },
          listingChoice: form.listingChoice
        });
        result = await createVehicle(payload, submissionActor);
        logSubmissionStage("listing-create", "success", {
          userId: submissionActor.id,
          documentPath: `/vehicles/${result.vehicle.id}`,
          ownerFields: {
            ownerUid: submissionActor.id,
            sellerId: submissionActor.id
          }
        });
      } catch (listingCreateError) {
        logSubmissionFailure("listing-create", listingCreateError, {
          userId: submissionActor.id,
          listingChoice: form.listingChoice,
          imageCount: imageAssets.length,
          listingType: payload.listingType,
          collection: "vehicles",
          ownerFields: {
            ownerUid: submissionActor.id,
            sellerId: submissionActor.id
          }
        });
        throw new Error(resolveSubmissionFailureMessage("listing-create", listingCreateError));
      }

      if (form.listingChoice === "service_quote" && isFirebaseConfigured) {
        try {
          logSubmissionStage("quote-create", "start", {
            userId: submissionActor.id,
            collection: "quotes",
            ownerFields: {
              ownerId: submissionActor.id,
              sellerUid: submissionActor.id
            },
            vehicleId: result.vehicle.id
          });
          await createQuoteRequest({
            ownerId: submissionActor.id,
            sellerUid: submissionActor.id,
            sellerName: submissionActor.name || submissionActor.displayName || "",
            sellerEmail: submissionActor.email || "",
            vehicleId: result.vehicle.id,
            vehicleYear: Number(form.year),
            vehicleMake: form.make,
            vehicleModel: form.model,
            quoteType: "SERVICE_SUPPORT",
            source: "sell_flow",
            notes: form.serviceQuoteNotes || ""
          });
          logSubmissionStage("quote-create", "success", {
            userId: submissionActor.id,
            collection: "quotes",
            ownerFields: {
              ownerId: submissionActor.id,
              sellerUid: submissionActor.id
            },
            vehicleId: result.vehicle.id
          });
        } catch (quoteCreateError) {
          logSubmissionFailure("quote-create", quoteCreateError, {
            userId: submissionActor.id,
            vehicleId: result.vehicle.id,
            collection: "quotes",
            ownerFields: {
              ownerId: submissionActor.id,
              sellerUid: submissionActor.id
            }
          });
          quoteCreationFailed = true;
          quoteCreationNotice = resolveSubmissionFailureMessage("quote-create", quoteCreateError);
        }
      }

      setMessage(
        result.writeSucceeded
          ? quoteCreationNotice
            ? `Vehicle submitted successfully. Your seller submission is now in the pending review queue. ${quoteCreationNotice}`
            : "Vehicle submitted successfully. Your seller submission is now in the pending review queue."
          : "Vehicle captured in mock mode only. Configure Firebase to persist live submissions."
      );

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(draftStorageKey);
      }

      router.replace(
        `/seller/vehicles?write=${result.writeSucceeded ? "success" : "mock"}&action=create&vehicleId=${result.vehicle.id}${quoteCreationFailed ? "&quote=failed" : ""}`
      );
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit your vehicle right now.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-[32px] border border-white/10 bg-[#121212] p-8 text-sm text-[#F5F5F5]/72">Loading sell flow...</div>;
  }

  if (!firebaseUser) {
    return (
      <div className="rounded-[32px] border border-white/10 bg-[#121212] p-8 text-[#F5F5F5] shadow-panel">
        <p className="text-xs uppercase tracking-[0.28em] text-[#C6A87D]">Seller access</p>
        <h2 className="mt-4 font-display text-4xl">Sign in to submit your vehicle.</h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#F5F5F5]/72">
          CarNest seller submissions attach the vehicle to your account and save the record into the pending approval queue.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link href="/login" className="rounded-full bg-[#C6A87D] px-6 py-3 text-sm font-semibold text-[#111111] transition hover:opacity-90">
            Login
          </Link>
          <Link href="/register" className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-[#F5F5F5] transition hover:border-[#C6A87D] hover:text-[#C6A87D]">
            Create account
          </Link>
        </div>
        <p className="mt-4 text-sm leading-6 text-[#F5F5F5]/72">Create an account to start selling your vehicle.</p>
      </div>
    );
  }

  if (appUser && !canSubmitVehicleForProfile(appUser)) {
    return (
      <div className="rounded-[32px] border border-white/10 bg-[#121212] p-8 text-[#F5F5F5] shadow-panel">
        <p className="text-xs uppercase tracking-[0.28em] text-[#C6A87D]">Seller access</p>
        <h2 className="mt-4 font-display text-4xl">{isBlockedDealer ? "Dealer approval is still in progress." : "This submission flow is for seller accounts."}</h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#F5F5F5]/72">
          {isBlockedDealer
            ? "Your dealer application needs approval before you can create listings. Check your application status for the next step."
            : `You are currently signed in as a ${appUser.role}. Switch to a seller account to submit a vehicle through the guided sell flow.`}
        </p>
        {isBlockedDealer ? (
          <div className="mt-8">
            <Link href="/dealer/application-status" className="rounded-full bg-[#C6A87D] px-6 py-3 text-sm font-semibold text-[#111111] transition hover:opacity-90">
              View application status
            </Link>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-3 md:grid-cols-4">
        {STEPS.map((step) => {
          const active = currentStep === step.id;
          const complete = currentStep > step.id;

          return (
            <div
              key={step.id}
              className={`rounded-[24px] border px-4 py-4 ${active ? "border-[#C6A87D] bg-[#171717] text-[#F5F5F5]" : complete ? "border-white/10 bg-[#141414] text-[#F5F5F5]" : "border-white/10 bg-[#111111] text-[#F5F5F5]/60"}`}
            >
              <p className="text-xs uppercase tracking-[0.22em] text-[#C6A87D]">Step {step.id}</p>
              <p className="mt-2 text-sm font-medium">{step.title}</p>
            </div>
          );
        })}
      </div>

      {!isFirebaseConfigured ? (
        <div className="rounded-[24px] border border-amber-300/30 bg-amber-100/10 px-4 py-3 text-sm leading-6 text-amber-100">
          Firebase is not configured, so submissions will run in mock mode until live Firestore access is enabled.
        </div>
      ) : null}
      {!isFirebaseStorageConfigured ? (
        <div className="rounded-[24px] border border-sky-300/30 bg-sky-100/10 px-4 py-3 text-sm leading-6 text-sky-100">
          Photo previews still work locally. Cloud image upload will activate once Firebase Storage is configured.
        </div>
      ) : null}

      <div className="rounded-[32px] border border-white/10 bg-[#111111] p-8 text-[#F5F5F5] shadow-panel">
        {currentStep === 1 ? (
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-[#C6A87D]">Step 1</p>
              <h2 className="mt-3 font-display text-4xl">Vehicle details</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#F5F5F5]/68">
                Share the core vehicle information first. CarNest will save this submission as a pending seller listing for review.
              </p>
            </div>
            <VehicleFormFields value={form} onFieldChange={setField} theme="dark" />
          </div>
        ) : null}

        {currentStep === 2 ? (
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-[#C6A87D]">Step 2</p>
              <h2 className="mt-3 font-display text-4xl">Photos</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#F5F5F5]/68">
                Add at least one strong photo if you have it ready. The first uploaded image becomes the cover image after upload.
              </p>
            </div>

            <div className="rounded-[28px] border border-dashed border-white/15 bg-[#161616] p-5">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => void handleImageSelection(event.target.files)}
                className="block w-full text-sm text-[#F5F5F5]/72"
              />
              <p className="mt-3 text-xs uppercase tracking-[0.22em] text-[#F5F5F5]/45">
                Local previews stay available even before cloud upload is configured.
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.22em] text-[#F5F5F5]/45">
                Images are automatically optimised for faster upload.
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.22em] text-[#F5F5F5]/45">
                Images must not contain text, ads, or contact details.
              </p>
              {processingImages ? <p className="mt-3 text-sm text-[#F5F5F5]/72">Processing images...</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {previewImages.map((image, index) => (
                <div key={`${image}-${index}`} className="relative h-48 overflow-hidden rounded-[24px] border border-white/10 bg-[#181818]">
                  <Image src={image} alt={`Vehicle preview ${index + 1}`} fill className="object-cover" unoptimized={image.startsWith("blob:")} />
                  {selectedImages[index] ? (
                    <>
                      {index === 0 ? (
                        <span className="absolute left-3 top-3 rounded-full bg-[#C6A87D] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#111111]">
                          Cover
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedFileAsCover(index)}
                          className="absolute left-3 top-3 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white transition hover:bg-black/80"
                        >
                          Set as cover
                        </button>
                      )}
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {currentStep === 3 ? (
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-[#C6A87D]">Step 3</p>
              <h2 className="mt-3 font-display text-4xl">Listing choice</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#F5F5F5]/68">
                Choose how you want CarNest to handle this submission. We do not show any public service pricing here.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setField("listingChoice", "basic")}
                className={`rounded-[28px] border p-6 text-left transition ${form.listingChoice === "basic" ? "border-[#C6A87D] bg-[#171717]" : "border-white/10 bg-[#141414] hover:border-[#C6A87D]/60"}`}
              >
                <p className="text-xs uppercase tracking-[0.22em] text-[#C6A87D]">Basic Listing (Free)</p>
                <h3 className="mt-3 text-2xl font-semibold text-[#F5F5F5]">Self-managed submission</h3>
                <p className="mt-3 text-sm leading-6 text-[#F5F5F5]/68">
                  Submit your vehicle into the standard seller review queue with your own listing details and photos.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setField("listingChoice", "service_quote")}
                className={`rounded-[28px] border p-6 text-left transition ${form.listingChoice === "service_quote" ? "border-[#C6A87D] bg-[#171717]" : "border-white/10 bg-[#141414] hover:border-[#C6A87D]/60"}`}
              >
                <p className="text-xs uppercase tracking-[0.22em] text-[#C6A87D]">Request CarNest Service Quote</p>
                <h3 className="mt-3 text-2xl font-semibold text-[#F5F5F5]">Support-first submission</h3>
                <p className="mt-3 text-sm leading-6 text-[#F5F5F5]/68">
                  Ask CarNest to review your submission and come back with a tailored service quote instead of fixed public pricing.
                </p>
              </button>
            </div>

            {form.listingChoice === "service_quote" ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium">Quote request notes</span>
                <Textarea
                  value={form.serviceQuoteNotes}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setField("serviceQuoteNotes", event.target.value)}
                  placeholder="Tell us whether you want help with inspection prep, premium presentation, warehouse handling, or end-to-end sales support."
                  className="border-white/10 bg-[#1A1A1A] text-[#F5F5F5]"
                  required
                />
              </label>
            ) : (
              <div className="rounded-[24px] border border-white/10 bg-[#161616] px-4 py-4 text-sm leading-6 text-[#F5F5F5]/72">
                Your vehicle will be submitted as a standard CarNest seller listing for review, with no service quote requested.
              </div>
            )}
          </div>
        ) : null}

        {currentStep === 4 ? (
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-[#C6A87D]">Step 4</p>
              <h2 className="mt-3 font-display text-4xl">Review and submit</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#F5F5F5]/68">
                Double-check the submission summary below. Seller submissions from this flow are saved as pending and stay out of public inventory until approved.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
              <div className="rounded-[28px] border border-white/10 bg-[#161616] p-6">
                <p className="text-xs uppercase tracking-[0.22em] text-[#C6A87D]">Vehicle summary</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm text-[#F5F5F5]/78">
                  <div>
                    <p className="text-[#F5F5F5]/42">Make</p>
                    <p className="mt-1">{form.make || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-[#F5F5F5]/42">Model</p>
                    <p className="mt-1">{form.model || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-[#F5F5F5]/42">Year</p>
                    <p className="mt-1">{form.year}</p>
                  </div>
                  <div>
                    <p className="text-[#F5F5F5]/42">Body type</p>
                    <p className="mt-1">{form.bodyType || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-[#F5F5F5]/42">Fuel type</p>
                    <p className="mt-1">{form.fuelType || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-[#F5F5F5]/42">Transmission</p>
                    <p className="mt-1">{form.transmission || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-[#F5F5F5]/42">Drivetrain</p>
                    <p className="mt-1">{form.drivetrain || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-[#F5F5F5]/42">Target asking price</p>
                    <p className="mt-1">{form.price ? formatCurrency(Number(form.price)) : "To be confirmed"}</p>
                  </div>
                  <div>
                    <p className="text-[#F5F5F5]/42">Location</p>
                    <p className="mt-1">
                      {[form.sellerLocationSuburb, form.sellerLocationPostcode, form.sellerLocationState].filter(Boolean).join(", ") || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#F5F5F5]/42">Listing choice</p>
                    <p className="mt-1">{form.listingChoice === "basic" ? "BASIC LISTING (FREE)" : "REQUEST CARNEST SERVICE QUOTE"}</p>
                  </div>
                </div>
                <div className="mt-5">
                  <p className="text-[#F5F5F5]/42">Description</p>
                  <p className="mt-2 text-sm leading-6 text-[#F5F5F5]/78">{form.description || "No description provided yet."}</p>
                </div>
                {form.listingChoice === "service_quote" ? (
                  <div className="mt-5 rounded-[22px] border border-[#C6A87D]/25 bg-[#1A1A1A] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#C6A87D]">Quote request</p>
                    <p className="mt-2 text-sm leading-6 text-[#F5F5F5]/78">{form.serviceQuoteNotes}</p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="rounded-[28px] border border-white/10 bg-[#161616] p-6">
                  <p className="text-xs uppercase tracking-[0.22em] text-[#C6A87D]">Photos</p>
                  <p className="mt-3 text-sm leading-6 text-[#F5F5F5]/72">
                    {selectedImages.length ? `${selectedImages.length} photo${selectedImages.length === 1 ? "" : "s"} ready for upload` : "No photos selected. Placeholder imagery will be used until images are added later."}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {previewImages.slice(0, 4).map((image, index) => (
                    <div key={`${image}-${index}`} className="relative h-36 overflow-hidden rounded-[22px] border border-white/10 bg-[#181818]">
                      <Image src={image} alt={`Review preview ${index + 1}`} fill className="object-cover" unoptimized={image.startsWith("blob:")} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-6 rounded-[24px] border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-100">{error}</p> : null}
        {message ? <p className="mt-6 rounded-[24px] border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-100">{message}</p> : null}

        <div className="mt-8 flex flex-wrap gap-3">
          {currentStep > 1 ? (
            <Button type="button" className="bg-white text-ink hover:bg-shell" onClick={handleBack}>
              Back
            </Button>
          ) : null}
          {currentStep < 4 ? (
            <Button type="button" className="bg-[#C6A87D] text-[#111111] hover:opacity-90" onClick={handleNext} disabled={processingImages}>
              Continue
            </Button>
          ) : (
            <Button type="button" className="bg-[#C6A87D] text-[#111111] hover:opacity-90" disabled={saving || processingImages || !canSubmit} onClick={() => void handleSubmit()}>
              {saving ? "Submitting..." : "Submit vehicle"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
