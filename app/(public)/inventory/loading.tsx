export default function InventoryLoading() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-10 space-y-3">
        <div className="h-4 w-24 rounded-full bg-shell" />
        <div className="h-12 w-80 max-w-full rounded-[20px] bg-shell" />
        <div className="h-6 w-[32rem] max-w-full rounded-[16px] bg-shell" />
      </div>
      <div className="mb-8 rounded-[28px] border border-black/5 bg-white p-5 shadow-panel">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="h-3 w-20 rounded-full bg-shell" />
              <div className="h-12 rounded-2xl bg-shell" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-[24px] border border-black/5 bg-white shadow-panel">
            <div className="aspect-[4/3] bg-shell" />
            <div className="space-y-3 p-4">
              <div className="h-5 w-40 rounded-full bg-shell" />
              <div className="h-4 w-28 rounded-full bg-shell" />
              <div className="h-4 w-full rounded-full bg-shell" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
