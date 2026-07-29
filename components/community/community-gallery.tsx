"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_CATEGORY_LABELS,
  getCommunityMomentCoverImage,
  getCommunityMomentImageCount,
  getCommunityMomentImages,
  isPublicActiveLinkedVehicle,
  listPublishedCommunityMoments,
} from "@/lib/community";
import { getVehicleById } from "@/lib/data";
import { getVehicleDisplayReference } from "@/lib/utils";
import type { CommunityMoment, CommunityMomentCategoryId, Vehicle } from "@/types";

function formatMomentDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getMomentLabel(moment: CommunityMoment) {
  return moment.title || COMMUNITY_CATEGORY_LABELS[moment.category];
}

export function CommunityGallery() {
  const [moments, setMoments] = useState<CommunityMoment[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<"all" | CommunityMomentCategoryId>("all");
  const [selectedMoment, setSelectedMoment] = useState<CommunityMoment | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [linkedVehicle, setLinkedVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadMoments() {
      setLoading(true);
      setError("");

      try {
        const items = await listPublishedCommunityMoments();
        if (!cancelled) setMoments(items);
      } catch (loadError) {
        console.error("[community] Failed to load published moments.", {
          error: loadError instanceof Error ? loadError.message : String(loadError),
        });
        if (!cancelled) {
          setMoments([]);
          setError("Community photos could not be loaded right now.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadMoments();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLinkedVehicle() {
      setLinkedVehicle(null);
      if (!selectedMoment?.linkedListingId) return;

      const vehicle = await getVehicleById(selectedMoment.linkedListingId).catch(() => null);
      if (!cancelled) {
        setLinkedVehicle(isPublicActiveLinkedVehicle(vehicle) ? vehicle : null);
      }
    }

    void loadLinkedVehicle();

    return () => {
      cancelled = true;
    };
  }, [selectedMoment?.id, selectedMoment?.linkedListingId]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [selectedMoment?.id]);

  const selectedImages = useMemo(
    () => getCommunityMomentImages(selectedMoment),
    [selectedMoment]
  );

  const selectedImage = selectedImages[activeImageIndex] ?? getCommunityMomentCoverImage(selectedMoment);
  const hasMultipleSelectedImages = selectedImages.length > 1;

  function openMoment(moment: CommunityMoment) {
    setActiveImageIndex(0);
    setSelectedMoment(moment);
  }

  function showRelativeImage(offset: -1 | 1) {
    if (!selectedImages.length) return;
    setActiveImageIndex((current) => (current + offset + selectedImages.length) % selectedImages.length);
  }

  useEffect(() => {
    if (!selectedMoment || !hasMultipleSelectedImages) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showRelativeImage(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        showRelativeImage(1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasMultipleSelectedImages, selectedImages.length, selectedMoment?.id]);

  useEffect(() => {
    if (!hasMultipleSelectedImages) return;
    const neighbourIndexes = [
      (activeImageIndex + 1) % selectedImages.length,
      (activeImageIndex - 1 + selectedImages.length) % selectedImages.length,
    ];

    neighbourIndexes.forEach((index) => {
      const image = selectedImages[index];
      if (!image?.displayUrl) return;
      const preloadImage = new Image();
      preloadImage.src = image.displayUrl;
    });
  }, [activeImageIndex, hasMultipleSelectedImages, selectedImages]);

  const visibleCategories = useMemo(() => {
    const categoryIds = new Set(moments.map((moment) => moment.category));
    return COMMUNITY_CATEGORIES.filter((category) => categoryIds.has(category.id));
  }, [moments]);

  const filteredMoments = useMemo(
    () => selectedCategory === "all"
      ? moments
      : moments.filter((moment) => moment.category === selectedCategory),
    [moments, selectedCategory]
  );

  return (
    <>
      {loading ? (
        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] px-6 py-12 text-sm text-white/60">
          Loading Community moments...
        </div>
      ) : error ? (
        <div className="rounded-[32px] border border-red-300/20 bg-red-500/10 px-6 py-12 text-sm text-red-100">
          {error}
        </div>
      ) : moments.length ? (
        <>
          <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" aria-label="Community categories">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`shrink-0 rounded-full border px-5 py-3 text-sm font-semibold transition ${
                selectedCategory === "all"
                  ? "border-[#D9B36A] bg-[#D9B36A] text-[#141414]"
                  : "border-white/12 bg-white/[0.04] text-white/74 hover:border-[#D9B36A]/50 hover:text-white"
              }`}
            >
              All
            </button>
            {visibleCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category.id)}
                className={`shrink-0 rounded-full border px-5 py-3 text-sm font-semibold transition ${
                  selectedCategory === category.id
                    ? "border-[#D9B36A] bg-[#D9B36A] text-[#141414]"
                    : "border-white/12 bg-white/[0.04] text-white/74 hover:border-[#D9B36A]/50 hover:text-white"
                }`}
              >
                {category.label}
              </button>
            ))}
          </nav>

          <div className="mt-8 columns-1 gap-5 sm:columns-2 xl:columns-3">
            {filteredMoments.map((moment) => (
              <button
                key={moment.id}
                type="button"
                onClick={() => openMoment(moment)}
                className="group mb-5 block w-full break-inside-avoid overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.04] text-left shadow-[0_26px_70px_rgba(0,0,0,0.24)] transition hover:-translate-y-1 hover:border-[#D9B36A]/35"
              >
                {(() => {
                  const coverImage = getCommunityMomentCoverImage(moment);
                  const imageCount = getCommunityMomentImageCount(moment);
                  if (!coverImage) return null;
                  return (
                <div
                  className="relative overflow-hidden bg-black/40"
                  style={{
                    aspectRatio: `${coverImage.thumbnailWidth || 4} / ${coverImage.thumbnailHeight || 3}`,
                  }}
                >
                  <img
                    src={coverImage.thumbnailUrl}
                    alt={getMomentLabel(moment)}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(0,0,0,0.55)_100%)]" />
                  <span className="absolute bottom-4 left-4 rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F0D296] backdrop-blur">
                    {COMMUNITY_CATEGORY_LABELS[moment.category]}
                  </span>
                  {imageCount > 1 ? (
                    <span className="absolute right-4 top-4 rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur">
                      {imageCount} photos
                    </span>
                  ) : null}
                </div>
                  );
                })()}
                {(moment.title || moment.caption || moment.location || moment.momentDate) ? (
                  <div className="space-y-2 p-5">
                    {moment.title ? <h2 className="text-xl font-semibold text-white">{moment.title}</h2> : null}
                    {moment.caption ? <p className="text-sm leading-6 text-white/66">{moment.caption}</p> : null}
                    <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-white/42">
                      {moment.location ? <span>{moment.location}</span> : null}
                      {moment.momentDate ? <span>{formatMomentDate(moment.momentDate)}</span> : null}
                    </div>
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] px-6 py-12 text-sm text-white/60">
          No Community moments have been published yet.
        </div>
      )}

      {selectedMoment && selectedImage ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={getMomentLabel(selectedMoment)}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/86 px-4 py-5 backdrop-blur-sm md:px-8"
          onClick={() => setSelectedMoment(null)}
        >
          <div
            className="mx-auto max-w-6xl overflow-hidden rounded-[34px] border border-white/12 bg-[#0B0B0B] shadow-[0_30px_90px_rgba(0,0,0,0.5)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[#D9B36A]">
                {COMMUNITY_CATEGORY_LABELS[selectedMoment.category]}
              </p>
              <button
                type="button"
                onClick={() => setSelectedMoment(null)}
                className="rounded-full border border-white/12 px-4 py-2 text-sm font-semibold text-white/78 transition hover:bg-white/8"
              >
                Close
              </button>
            </div>
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
              <div
                className="bg-black"
                onTouchStart={(event) => setTouchStartX(event.changedTouches[0]?.clientX ?? null)}
                onTouchEnd={(event) => {
                  if (touchStartX === null || !hasMultipleSelectedImages) return;
                  const endX = event.changedTouches[0]?.clientX ?? touchStartX;
                  const distance = endX - touchStartX;
                  setTouchStartX(null);
                  if (Math.abs(distance) < 42) return;
                  showRelativeImage(distance < 0 ? 1 : -1);
                }}
              >
                <div className="relative flex min-h-[320px] items-center justify-center">
                <img
                  src={selectedImage.displayUrl}
                  alt={`${getMomentLabel(selectedMoment)}${hasMultipleSelectedImages ? ` - photo ${activeImageIndex + 1} of ${selectedImages.length}` : ""}`}
                  aria-label={hasMultipleSelectedImages ? `Photo ${activeImageIndex + 1} of ${selectedImages.length}` : undefined}
                  className="max-h-[82vh] w-full object-contain"
                />
                  {hasMultipleSelectedImages ? (
                    <>
                      <button
                        type="button"
                        onClick={() => showRelativeImage(-1)}
                        className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/18 bg-black/50 text-2xl font-light text-white shadow-lg backdrop-blur transition hover:bg-black/75"
                        aria-label="Previous Community photo"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={() => showRelativeImage(1)}
                        className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/18 bg-black/50 text-2xl font-light text-white shadow-lg backdrop-blur transition hover:bg-black/75"
                        aria-label="Next Community photo"
                      >
                        ›
                      </button>
                      <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white/86 backdrop-blur">
                        {activeImageIndex + 1} / {selectedImages.length}
                      </span>
                    </>
                  ) : null}
                </div>
                {hasMultipleSelectedImages ? (
                  <div className="flex gap-2 overflow-x-auto border-t border-white/10 bg-[#080808] px-4 py-3">
                    {selectedImages.map((image, index) => (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => setActiveImageIndex(index)}
                        aria-label={`Show photo ${index + 1} of ${selectedImages.length}`}
                        className={`h-16 w-20 shrink-0 overflow-hidden rounded-2xl border transition ${
                          index === activeImageIndex ? "border-[#D9B36A]" : "border-white/12 opacity-65 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={image.thumbnailUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <aside className="space-y-5 p-6 md:p-8">
                {selectedMoment.title ? <h2 className="text-3xl font-semibold text-white">{selectedMoment.title}</h2> : null}
                {selectedMoment.caption ? <p className="text-base leading-7 text-white/68">{selectedMoment.caption}</p> : null}
                <div className="space-y-2 text-sm text-white/58">
                  {selectedMoment.momentDate ? <p>{formatMomentDate(selectedMoment.momentDate)}</p> : null}
                  {selectedMoment.location ? <p>{selectedMoment.location}</p> : null}
                </div>
                {linkedVehicle ? (
                  <div className="rounded-[24px] border border-[#D9B36A]/20 bg-[#D9B36A]/10 p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#D9B36A]">Featured vehicle</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                      {linkedVehicle.year} {linkedVehicle.make} {linkedVehicle.model}
                    </h3>
                    <p className="mt-1 text-sm text-white/55">{getVehicleDisplayReference(linkedVehicle)}</p>
                    <Link
                      href={`/inventory/${linkedVehicle.id}`}
                      className="mt-4 inline-flex rounded-full bg-[#D9B36A] px-5 py-3 text-sm font-semibold text-[#141414] transition hover:bg-[#e3bf78]"
                    >
                      View this car →
                    </Link>
                  </div>
                ) : null}
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
