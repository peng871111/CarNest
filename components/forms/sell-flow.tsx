"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { createVehicle } from "@/lib/data";
import { db, isFirebaseConfigured, isFirebaseStorageConfigured } from "@/lib/firebase";
import { optimizeVehicleImages } from "@/lib/image-processing";
import { uploadVehicleImages } from "@/lib/storage";
import { VEHICLE_PLACEHOLDER_IMAGE } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { VehicleFormInput } from "@/types";

const STEPS = [
  { id: 1, title: "Vehicle details" },
  { id: 2, title: "Photos" },
  { id: 3, title: "Listing choice" },
  { id: 4, title: "Review and submit" }
] as const;

const MAKE_OPTIONS = [
  "ABARTH",
  "ALFA ROMEO",
  "AUDI",
  "BMW",
  "BYD",
  "CHEVROLET",
  "CHRYSLER",
  "CUPRA",
  "FERRARI",
  "FIAT",
  "FORD",
  "GENESIS",
  "GWM",
  "HOLDEN",
  "HONDA",
  "HYUNDAI",
  "ISUZU",
  "JAGUAR",
  "JEEP",
  "KIA",
  "LAMBORGHINI",
  "LAND ROVER",
  "LDV",
  "LEXUS",
  "MAHINDRA",
  "MASERATI",
  "MAZDA",
  "MERCEDES-BENZ",
  "MG",
  "MINI",
  "MITSUBISHI",
  "NISSAN",
  "PEUGEOT",
  "POLESTAR",
  "PORSCHE",
  "RENAULT",
  "SKODA",
  "SUBARU",
  "SUZUKI",
  "TESLA",
  "TOYOTA",
  "VOLKSWAGEN",
  "VOLVO",
  "OTHER"
];
const BODY_TYPE_OPTIONS = ["SEDAN", "HATCHBACK", "WAGON", "SUV", "COUPE", "CONVERTIBLE", "UTE", "VAN", "PEOPLE MOVER", "OTHER"];
const FUEL_TYPE_OPTIONS = ["PETROL", "DIESEL", "EV", "PHEV", "HEV"];
const TRANSMISSION_OPTIONS = ["AT", "MT"];
const DRIVETRAIN_OPTIONS = ["FWD", "RWD", "AWD", "4WD", "OTHER"];
const STATE_OPTIONS = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR + 1 - 1980 + 1 }, (_, index) => String(CURRENT_YEAR + 1 - index));

type ListingChoice = "basic" | "service_quote";

interface SellFlowState {
  make: string;
  year: string;
  model: string;
  bodyType: string;
  fuelType: string;
  transmission: string;
  drivetrain: string;
  mileage: string;
  price: string;
  colour: string;
  suburb: string;
  state: string;
  description: string;
  listingChoice: ListingChoice;
  serviceQuoteNotes: string;
}

const initialState: SellFlowState = {
  make: "",
  year: String(new Date().getFullYear()),
  model: "",
  bodyType: "",
  fuelType: "",
  transmission: "",
  drivetrain: "",
  mileage: "",
  price: "",
  colour: "",
  suburb: "",
  state: "VIC",
  description: "",
  listingChoice: "basic",
  serviceQuoteNotes: ""
};

function toUppercaseValue(value: string) {
  return value.toUpperCase();
}

function moveItemToFront<T>(items: T[], index: number) {
  if (index <= 0 || index >= items.length) return items;
  return [items[index], ...items.slice(0, index), ...items.slice(index + 1)];
}

export function SellFlow() {
  const router = useRouter();
  const { appUser, loading } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [processingImages, setProcessingImages] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState<SellFlowState>(initialState);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const previewImages = useMemo(
    () => (selectedFiles.length ? selectedFiles.map((file) => URL.createObjectURL(file)) : [VEHICLE_PLACEHOLDER_IMAGE]),
    [selectedFiles]
  );

  const canSubmit = appUser?.role === "seller" || appUser?.role === "buyer";

  function setField<K extends keyof SellFlowState>(key: K, value: SellFlowState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validateStep(step: number) {
    if (step === 1) {
      if (!form.make || !form.year || !form.model || !form.bodyType || !form.fuelType || !form.transmission) {
        return "Complete the core vehicle details before continuing.";
      }
      if (!form.drivetrain || !form.suburb || !form.state || !form.description) {
        return "Please complete the remaining required vehicle fields.";
      }
      return "";
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
    setSelectedFiles((current) => moveItemToFront(current, index));
  }

  async function handleImageSelection(files: FileList | null) {
    if (!files?.length) {
      setSelectedFiles([]);
      return;
    }

    setProcessingImages(true);
    setError("");

    try {
      const processedFiles = await optimizeVehicleImages(Array.from(files));
      setSelectedFiles(processedFiles);
    } catch {
      setError("We couldn't prepare your photos right now. Please try again.");
    } finally {
      setProcessingImages(false);
    }
  }

  async function handleSubmit() {
    if (!appUser || !canSubmit) return;

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
      const imageUrls =
        selectedFiles.length && isFirebaseStorageConfigured ? await uploadVehicleImages(selectedFiles, appUser.id) : [];

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
        regoExpiry: "",
        serviceHistory: "",
        keyCount: "",
        sellerLocationSuburb: form.suburb,
        sellerLocationState: form.state,
        description: form.description,
        coverImageUrl: imageUrls[0] || "",
        imageUrls,
        images: imageUrls,
        submissionPreference: form.listingChoice,
        serviceQuoteNotes: form.listingChoice === "service_quote" ? form.serviceQuoteNotes : ""
      };

      const result = await createVehicle(payload, appUser);

      // 新增：如果卖家选择了 Service Quote，同时写入 quotes collection
      if (form.listingChoice === "service_quote" && isFirebaseConfigured) {
        await addDoc(collection(db, "quotes"), {
          vehicleId: result.vehicle.id,
          sellerUid: appUser.id,
          sellerName: appUser.name || appUser.displayName || "",
          sellerEmail: appUser.email || "",
          sellerPhone: appUser.phone || "",

          make: form.make,
          model: form.model,
          year: form.year,

          requestType: "CONCIERGE",
          preferredServices: ["TAILORED_QUOTE"],
          notes: form.serviceQuoteNotes || "",

          linkedVehicleSnapshot: {
            make: form.make,
            model: form.model,
            year: form.year,
            bodyType: form.bodyType,
            fuelType: form.fuelType,
            transmission: form.transmission,
            drivetrain: form.drivetrain,
            mileage: Number(form.mileage || 0),
            price: Number(form.price || 0),
            colour: form.colour,
            suburb: form.suburb,
            state: form.state,
            description: form.description,
            imageCount: selectedFiles.length
          },

          status: "NEW",
          createdAt: serverTimestamp()
        });
      }

      setMessage(
        result.writeSucceeded
          ? "Vehicle submitted successfully. Your seller submission is now in the pending review queue."
          : "Vehicle captured in mock mode only. Configure Firebase to persist live submissions."
      );

      router.replace(`/seller/vehicles?write=${result.writeSucceeded ? "success" : "mock"}&action=create&vehicleId=${result.vehicle.id}`);
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

  if (!appUser) {
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
            Register as seller
          </Link>
        </div>
      </div>
    );
  }

  if (!canSubmit) {
    return (
      <div className="rounded-[32px] border border-white/10 bg-[#121212] p-8 text-[#F5F5F5] shadow-panel">
        <p className="text-xs uppercase tracking-[0.28em] text-[#C6A87D]">Seller access</p>
        <h2 className="mt-4 font-display text-4xl">This submission flow is for seller accounts.</h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#F5F5F5]/72">
          You are currently signed in as a {appUser.role}. Switch to a seller account to submit a vehicle through the guided sell flow.
        </p>
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

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">Make</span>
                <select value={form.make} onChange={(event) => setField("make", event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-3 text-sm uppercase" required>
                  <option value="">SELECT MAKE</option>
                  {MAKE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Year</span>
                <select value={form.year} onChange={(event) => setField("year", event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-3 text-sm" required>
                  {YEAR_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Model</span>
                <Input value={form.model} onChange={(event) => setField("model", toUppercaseValue(event.target.value))} className="border-white/10 bg-[#1A1A1A] text-[#F5F5F5] uppercase" required />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Body type</span>
                <select value={form.bodyType} onChange={(event) => setField("bodyType", event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-3 text-sm uppercase" required>
                  <option value="">SELECT BODY TYPE</option>
                  {BODY_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Fuel type</span>
                <select value={form.fuelType} onChange={(event) => setField("fuelType", event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-3 text-sm uppercase" required>
                  <option value="">SELECT FUEL TYPE</option>
                  {FUEL_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Transmission</span>
                <select value={form.transmission} onChange={(event) => setField("transmission", event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-3 text-sm uppercase" required>
                  <option value="">SELECT TRANSMISSION</option>
                  {TRANSMISSION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Drivetrain</span>
                <select value={form.drivetrain} onChange={(event) => setField("drivetrain", event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-3 text-sm uppercase" required>
                  <option value="">SELECT DRIVETRAIN</option>
                  {DRIVETRAIN_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Mileage</span>
                <Input type="number" min="0" value={form.mileage} onChange={(event) => setField("mileage", event.target.value)} className="border-white/10 bg-[#1A1A1A] text-[#F5F5F5]" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Target asking price</span>
                <Input type="number" min="0" value={form.price} onChange={(event) => setField("price", event.target.value)} className="border-white/10 bg-[#1A1A1A] text-[#F5F5F5]" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Colour</span>
                <Input value={form.colour} onChange={(event) => setField("colour", event.target.value)} className="border-white/10 bg-[#1A1A1A] text-[#F5F5F5]" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Suburb</span>
                <Input value={form.suburb} onChange={(event) => setField("suburb", toUppercaseValue(event.target.value))} className="border-white/10 bg-[#1A1A1A] text-[#F5F5F5] uppercase" required />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">State</span>
                <select value={form.state} onChange={(event) => setField("state", event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-3 text-sm uppercase" required>
                  {STATE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Description</span>
              <Textarea value={form.description} onChange={(event) => setField("description", event.target.value)} className="border-white/10 bg-[#1A1A1A] text-[#F5F5F5]" required />
            </label>
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
                Images are resized before upload for faster listing performance.
              </p>
              {processingImages ? <p className="mt-3 text-sm text-[#F5F5F5]/72">Preparing images...</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {previewImages.map((image, index) => (
                <div key={`${image}-${index}`} className="relative h-48 overflow-hidden rounded-[24px] border border-white/10 bg-[#181818]">
                  <Image src={image} alt={`Vehicle preview ${index + 1}`} fill className="object-cover" unoptimized={image.startsWith("blob:")} />
                  {selectedFiles[index] ? (
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
                  onChange={(event) => setField("serviceQuoteNotes", event.target.value)}
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
                      {[form.suburb, form.state].filter(Boolean).join(", ") || "Not provided"}
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
                    {selectedFiles.length ? `${selectedFiles.length} photo${selectedFiles.length === 1 ? "" : "s"} ready for upload` : "No photos selected. Placeholder imagery will be used until images are added later."}
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
            <Button type="button" className="bg-[#C6A87D] text-[#111111] hover:opacity-90" onClick={handleNext}>
              Continue
            </Button>
          ) : (
            <Button type="button" className="bg-[#C6A87D] text-[#111111] hover:opacity-90" disabled={saving || !canSubmit} onClick={() => void handleSubmit()}>
              {saving ? "Submitting..." : "Submit vehicle"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
