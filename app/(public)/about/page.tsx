import Link from "next/link";

const ABOUT_SECTIONS = [
  {
    title: "Who we are",
    text: "CarNest is a vehicle listing and storage platform designed to make private vehicle sales more structured, secure, and time-efficient."
  },
  {
    title: "What we do",
    text: "CarNest helps sellers present vehicles professionally, connect with buyers, and optionally request secure warehouse storage and managed inspection support."
  },
  {
    title: "What makes CarNest different",
    text: "CarNest combines online exposure with optional real-world support, including secure storage, flexible inspection access, and a more curated selling experience."
  },
  {
    title: "What CarNest is not",
    text: "CarNest does not act as a dealer, broker, or financial intermediary in the vehicle transaction. Buyers and sellers complete negotiations and payment directly."
  }
];

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-20">
      <section className="rounded-[36px] border border-black/5 bg-hero-glow p-10 shadow-panel">
        <p className="text-sm uppercase tracking-[0.35em] text-bronze">About Us</p>
        <h1 className="mt-4 font-display text-5xl text-ink">A more structured way to sell privately</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-ink/68">
          CarNest is built for vehicle owners who want a cleaner, more professional path to market without losing control of the sale itself.
        </p>
      </section>

      <section className="mt-12 grid gap-6 md:grid-cols-2">
        {ABOUT_SECTIONS.map((section) => (
          <article key={section.title} className="rounded-[28px] border border-black/5 bg-white p-7 shadow-panel">
            <h2 className="text-2xl font-semibold text-ink">{section.title}</h2>
            <p className="mt-4 text-sm leading-7 text-ink/65">{section.text}</p>
          </article>
        ))}
      </section>

      <section className="mt-12 rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
        <p className="text-sm uppercase tracking-[0.35em] text-bronze">Explore CarNest</p>
        <div className="mt-5 flex flex-wrap gap-4">
          <Link href="/sell" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-ink/90">
            Sell your car
          </Link>
          <Link href="/warehouse" className="rounded-full border border-ink px-6 py-3 text-sm font-semibold text-ink transition hover:bg-shell">
            Secure warehouse storage
          </Link>
        </div>
      </section>
    </main>
  );
}
