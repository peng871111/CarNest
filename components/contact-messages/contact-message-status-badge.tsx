import { getContactMessageStatusLabel, getContactMessageStatusTone } from "@/lib/permissions";

export function ContactMessageStatusBadge({ status }: { status: string }) {
  const displayStatus = getContactMessageStatusLabel(status);

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getContactMessageStatusTone(status)}`}
    >
      {displayStatus}
    </span>
  );
}
