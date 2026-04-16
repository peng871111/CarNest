import Link from "next/link";

const BENEFITS = [
  {
    title: "Why secure storage helps sellers",
    text: "A professionally managed storage environment can improve presentation, reduce disruption at home, and create a more controlled sale process."
  },
  {
    title: "Flexible inspections",
    text: "Warehouse-based vehicles can support more structured appointment windows and a smoother inspection experience for qualified buyers."
  },
  {
    title: "Time saving",
    text: "CarNest can help reduce the back-and-forth involved in managing access, timing, and presentation while the vehicle is on the market."
  },
  {
    title: "Convenience",
    text: "Keeping the vehicle in a dedicated environment can make the selling process easier to coordinate without constantly reorganising your day."
  },
  {
    title: "Added security during the selling process",
    text: "Secure storage adds another layer of protection while the vehicle is being offered for sale, especially for premium or enthusiast stock."
  }
];

export default function WarehousePage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-20">
      <section className="rounded-[36px] border border-black/5 bg-[#111111] p-10 text-[#F5F5F5] shadow-panel">
        <p className="text-sm uppercase tracking-[0.35em] text-[#C6A87D]">Secure Warehouse Storage</p>
        <h1 className="mt-4 font-display text-5xl">Secure Warehouse Storage</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-[#F5F5F5]/72">
          For sellers who want a more managed sale, CarNest can support secure storage, curated presentation, and a smoother inspection experience through a quote-led warehouse pathway.
        </p>
        <div className="mt-8">
          <Link href="/sell" className="inline-flex rounded-full bg-[#C6A87D] px-6 py-3 text-sm font-semibold text-[#111111] transition hover:opacity-90">
            Request support through your listing
          </Link>
        </div>
      </section>

      <section className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {BENEFITS.map((benefit) => (
          <article key={benefit.title} className="rounded-[28px] border border-black/5 bg-white p-7 shadow-panel">
            <h2 className="text-2xl font-semibold text-ink">{benefit.title}</h2>
            <p className="mt-4 text-sm leading-7 text-ink/65">{benefit.text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
