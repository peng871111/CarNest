import { getContactMessageStatusLabel, getContactMessageStatusTone } from "@/lib/permissions";

export function ContactMessageStatusBadge({ status }: { status: string }) {
  const displayStatus = getContactMessageStatusLabel(status);

  return (
    <span
      className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-semibold uppercase tracking-[0.18em] ${getContactMessageStatusTone(status)}`}
    >
      {displayStatus}
    </span>
  );
}
