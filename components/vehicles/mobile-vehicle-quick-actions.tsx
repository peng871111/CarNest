"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

interface MobileVehicleQuickActionsProps {
  vehicleId: string;
  price: number;
  canBookInspection: boolean;
}

export function MobileVehicleQuickActions({
  vehicleId,
  price,
  canBookInspection
}: MobileVehicleQuickActionsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function scrollToActionPanel() {
    window.setTimeout(() => {
      const target = document.getElementById("take-action-panel");
      if (!target) return;

      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 80);
  }

  function handleActionClick(action: "offer" | "inspection") {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("action", action);
    router.replace(`${pathname}?${nextParams.toString()}#take-action-panel`, { scroll: false });
    scrollToActionPanel();
  }

  return (
    <div className="sticky top-[84px] z-20 rounded-[24px] border border-black/5 bg-[#FCFAF6]/95 p-4 shadow-panel backdrop-blur lg:hidden">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.22em] text-ink/45">Asking price</p>
        <p className="mt-1 text-xl font-semibold text-ink">{formatCurrency(price)}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleActionClick("offer")}
          className="w-full rounded-full bg-ink px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-ink/92"
        >
          Make Offer
        </button>
        {canBookInspection ? (
          <button
            type="button"
            onClick={() => handleActionClick("inspection")}
            className="w-full rounded-full border border-black/10 bg-white px-4 py-3 text-center text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
          >
            Book Inspection
          </button>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
