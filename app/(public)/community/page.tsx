import { Metadata } from "next";
import { CommunityGallery } from "@/components/community/community-gallery";

export const metadata: Metadata = {
  title: {
    absolute: "CarNest Community | Shared automotive moments"
  },
  description: "Explore CarNest Community photos, featured vehicles, owner moments and automotive stories.",
  alternates: {
    canonical: "/community"
  }
};

export default function CommunityPage() {
  return (
    <main className="-mx-6 -mt-10 min-h-screen overflow-hidden bg-[#050505] text-white">
      <section className="relative border-b border-white/8 bg-[radial-gradient(circle_at_20%_20%,rgba(217,179,106,0.18),transparent_30%),linear-gradient(180deg,#070707_0%,#050505_100%)] px-6 py-20 md:py-28">
        <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="relative mx-auto max-w-7xl">
          <p className="text-sm uppercase tracking-[0.36em] text-[#D9B36A]">CarNest Community</p>
          <h1 className="mt-5 max-w-4xl font-display text-5xl leading-[0.96] text-white md:text-7xl">
            CarNest Community
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/68">
            Cars are better when they&apos;re shared.
          </p>
        </div>
      </section>

      <section className="px-6 py-12 md:py-16">
        <div className="mx-auto max-w-7xl">
          <CommunityGallery />
        </div>
      </section>
    </main>
  );
}
