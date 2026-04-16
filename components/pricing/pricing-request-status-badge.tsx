import { PricingRequestStatus } from "@/types";

const STATUS_STYLES: Record<PricingRequestStatus, string> = {
  NEW: "border-amber-200 bg-amber-50 text-amber-800",
  REPLIED: "border-sky-200 bg-sky-50 text-sky-800",
  CLOSED: "border-emerald-200 bg-emerald-50 text-emerald-800"
};

export function PricingRequestStatusBadge({ status }: { status: PricingRequestStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}
