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
    window.requestAnimationFrame(() => {
      const target = document.getElementById("take-action-panel");
      if (!target) return;

      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }

  function handleActionClick(action: "offer" | "inspection") {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("action", action);
    router.replace(`${pathname}?${nextParams.toString()}#take-action-panel`, { scroll: false });
    scrollToActionPanel();
  }

  return (
    <div className="rounded-[24px] border border-black/5 bg-white p-4 shadow-panel lg:hidden">
      <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Asking price</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{formatCurrency(price)}</p>
      <div className="mt-4 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => handleActionClick("offer")}
          className="rounded-full bg-ink px-5 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-ink/92"
        >
          Make Offer
        </button>
        {canBookInspection ? (
          <button
            type="button"
            onClick={() => handleActionClick("inspection")}
            className="rounded-full border border-black/10 bg-white px-5 py-3 text-center text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
          >
            Book Inspection
          </button>
        ) : null}
      </div>
      <p className="mt-3 text-xs leading-5 text-ink/50">
        No pressure — we simply help arrange the viewing. You deal directly with the owner if you proceed.
      </p>
    </div>
  );
}
