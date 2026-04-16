"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { updateContactMessageStatus } from "@/lib/data";
import { getContactMessageStatusMenu, normalizeContactMessageStatus } from "@/lib/permissions";
import { ContactMessage, ContactMessageStatus } from "@/types";

export function ContactMessageStatusActions({
  contactMessage,
  redirectBase = "/admin/enquiries"
}: {
  contactMessage: ContactMessage;
  redirectBase?: string;
}) {
  const router = useRouter();
  const { appUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [currentStatus, setCurrentStatus] = useState<ContactMessageStatus>(
    normalizeContactMessageStatus(String(contactMessage.status))
  );

  useEffect(() => {
    setCurrentStatus(normalizeContactMessageStatus(String(contactMessage.status)));
  }, [contactMessage.status]);

  const menu = getContactMessageStatusMenu(currentStatus);

  async function handleStatus(status: ContactMessageStatus) {
    if (!appUser) return;
    setBusy(true);

    try {
      const result = await updateContactMessageStatus(contactMessage.id, status, appUser, contactMessage);
      setCurrentStatus(normalizeContactMessageStatus(String(result.contactMessage.status)));
      detailsRef.current?.removeAttribute("open");
      router.replace(`${redirectBase}?write=${result.writeSucceeded ? "success" : "mock"}&status=${status}&enquiryId=${contactMessage.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <details ref={detailsRef} className="relative z-50">
      <summary
        className="list-none rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-shell [&::-webkit-details-marker]:hidden"
      >
        Actions
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-[20px] border border-black/10 bg-white shadow-panel">
        {menu.hint ? (
          <div className="border-b border-black/5 px-4 py-3 text-xs uppercase tracking-[0.18em] text-ink/45">{menu.hint}</div>
        ) : null}

        {menu.actions.length ? (
          menu.actions.map((status, index) => (
            <button
              key={status}
              type="button"
              disabled={busy}
              onClick={() => void handleStatus(status)}
              className={`block w-full px-4 py-3 text-left text-sm text-ink transition hover:bg-shell disabled:opacity-40 ${
                index < menu.actions.length - 1 ? "border-b border-black/5" : ""
              }`}
            >
              {status === "CONTACTED" ? "Mark as Contacted" : "Mark as Closed"}
            </button>
          ))
        ) : (
          <div className="px-4 py-3 text-sm text-ink/55">{menu.emptyMessage}</div>
        )}
      </div>
    </details>
  );
}
