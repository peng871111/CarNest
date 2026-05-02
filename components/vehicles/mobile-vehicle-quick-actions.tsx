"use client";

import { useEffect, useRef, useState } from "react";
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
  const cardRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showCompactSticky, setShowCompactSticky] = useState(false);

  useEffect(() => {
    function handleScroll() {
      const card = cardRef.current;
      if (!card) return;

      const headerOffset = 128;
      const nextShowCompactSticky = card.getBoundingClientRect().bottom <= headerOffset;
      setShowCompactSticky((current) => (current === nextShowCompactSticky ? current : nextShowCompactSticky));
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

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
    <div className="lg:hidden">
      <div ref={cardRef} className="rounded-[24px] border border-black/5 bg-[#FCFAF6] p-4 shadow-panel">
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

      <div
        className={`sticky top-[128px] z-30 mt-3 transition-all duration-200 ${
          showCompactSticky ? "opacity-100" : "pointer-events-none h-0 overflow-hidden opacity-0"
        }`}
      >
        <div className="rounded-[20px] border border-black/5 bg-[#FCFAF6]/95 px-3 py-2.5 shadow-panel backdrop-blur">
          <div className="flex items-center gap-2.5">
            <p className="min-w-0 flex-1 truncate text-base font-semibold text-ink">{formatCurrency(price)}</p>
            <button
              type="button"
              onClick={() => handleActionClick("offer")}
              className="rounded-full bg-ink px-3.5 py-2.5 text-center text-xs font-semibold text-white shadow-sm transition hover:bg-ink/92"
            >
              Make Offer
            </button>
            {canBookInspection ? (
              <button
                type="button"
                onClick={() => handleActionClick("inspection")}
                className="rounded-full border border-black/10 bg-white px-3.5 py-2.5 text-center text-xs font-semibold text-ink transition hover:border-bronze hover:text-bronze"
              >
                Book Inspection
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
