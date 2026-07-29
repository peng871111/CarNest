"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  COMMUNITY_CATEGORY_LABELS,
  getCommunityMomentCoverImage,
  listFeaturedPublishedCommunityMoments,
} from "@/lib/community";
import type { CommunityMoment } from "@/types";

export function CommunityHomepageSection() {
  const [moments, setMoments] = useState<CommunityMoment[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadFeaturedMoments() {
      try {
        const items = await listFeaturedPublishedCommunityMoments(6);
        if (!cancelled) setMoments(items);
      } catch (error) {
        console.warn("[community] Featured homepage moments could not be loaded.", {
          error: error instanceof Error ? error.message : String(error),
        });
        if (!cancelled) setMoments([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    void loadFeaturedMoments();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || !moments.length) return null;

  return (
    <section className="mt-12 overflow-hidden rounded-[36px] border border-white/8 bg-[linear-gradient(135deg,rgba(18,18,18,0.98),rgba(8,8,8,0.96))] p-5 shadow-[0_28px_70px_rgba(0,0,0,0.34)] md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.34em] text-[#D9B36A]">CarNest Community</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">Cars are better when they&apos;re shared.</h2>
        </div>
        <Link href="/community" className="text-sm font-semibold text-[#F0D296] transition hover:text-white">
          Explore the Community →
        </Link>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {moments.map((moment, index) => {
          const coverImage = getCommunityMomentCoverImage(moment);
          if (!coverImage) return null;

          return (
            <Link
              key={moment.id}
              href="/community"
              className={`group overflow-hidden rounded-[26px] border border-white/8 bg-white/[0.04] transition hover:-translate-y-1 hover:border-[#D9B36A]/35 ${
                index === 0 ? "sm:col-span-2 lg:col-span-1" : ""
              }`}
            >
              <div
                className="relative overflow-hidden bg-black/40"
                style={{
                  aspectRatio: `${coverImage.thumbnailWidth || 4} / ${coverImage.thumbnailHeight || 3}`,
                }}
              >
                <img
                  src={coverImage.thumbnailUrl}
                  alt={moment.title || `CarNest ${COMMUNITY_CATEGORY_LABELS[moment.category]} moment`}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_42%,rgba(0,0,0,0.58)_100%)]" />
                <span className="absolute bottom-4 left-4 rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F0D296] backdrop-blur">
                  {COMMUNITY_CATEGORY_LABELS[moment.category]}
                </span>
              </div>
              {(moment.title || moment.location) ? (
                <div className="p-4">
                  {moment.title ? <h3 className="text-lg font-semibold text-white">{moment.title}</h3> : null}
                  {moment.location ? <p className="mt-1 text-sm text-white/55">{moment.location}</p> : null}
                </div>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
