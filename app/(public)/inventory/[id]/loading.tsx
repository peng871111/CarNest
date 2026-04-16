export default function VehicleDetailLoading() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <div className="grid gap-10 lg:grid-cols-[1.2fr,0.8fr]">
        <section className="space-y-6">
          <div className="h-4 w-32 rounded-full bg-shell" />
          <div className="aspect-[16/10] rounded-[32px] bg-shell" />
          <div className="grid gap-4 rounded-[28px] border border-black/5 bg-white p-6 shadow-panel md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="h-3 w-20 rounded-full bg-shell" />
                <div className="h-5 w-32 rounded-full bg-shell" />
              </div>
            ))}
          </div>
        </section>
        <aside className="space-y-6">
          <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
            <div className="h-4 w-24 rounded-full bg-shell" />
            <div className="mt-4 h-12 w-64 rounded-[20px] bg-shell" />
            <div className="mt-6 h-10 w-40 rounded-[18px] bg-shell" />
          </div>
          <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
            <div className="h-4 w-28 rounded-full bg-shell" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-12 rounded-2xl bg-shell" />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
