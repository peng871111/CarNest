"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ContactMessageStatusActions } from "@/components/contact-messages/contact-message-status-actions";
import { ContactMessageStatusBadge } from "@/components/contact-messages/contact-message-status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { useAuth } from "@/lib/auth";
import { getContactMessagesData } from "@/lib/data";
import { hasAdminPermission } from "@/lib/permissions";
import { formatAdminDateTime } from "@/lib/utils";
import { ContactMessage } from "@/types";

function getDisplayValue(value: string | undefined, fallback: string) {
  return value?.trim() ? value : fallback;
}

export function AdminEnquiriesPanel({
  write,
  status
}: {
  write?: string;
  status?: string;
}) {
  const { appUser, firebaseUser, loading: authLoading } = useAuth();
  const canManageEnquiries = hasAdminPermission(appUser, "manageEnquiries");
  const [enquiries, setEnquiries] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const writeStatus =
    write === "success"
      ? `Enquiry status updated to ${status ?? "saved"}`
      : write === "mock"
        ? "Enquiry update recorded"
        : "No recent updates";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (authLoading) return;
      if (!canManageEnquiries || !firebaseUser) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        await firebaseUser.getIdToken();
        const result = await getContactMessagesData();
        if (cancelled) return;
        setEnquiries(result.items);
        setErrorMessage(result.error || "");
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "We couldn't load enquiries.");
          setEnquiries([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, canManageEnquiries, firebaseUser]);

  return (
    <AdminShell title="Enquiries" description="Review contact form submissions and move each enquiry through the CarNest response process." requiredPermission="manageEnquiries">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          Enquiries loaded: {loading ? "Loading..." : enquiries.length}
        </div>
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          Recent activity: {writeStatus}
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
          Something went wrong. Please try again.
        </div>
      ) : null}

      <section className="overflow-visible rounded-[32px] border border-black/5 bg-white shadow-panel">
        <div className="hidden grid-cols-[0.9fr,1fr,0.9fr,1.2fr,1fr,1fr,1fr,220px] gap-4 border-b border-black/5 bg-shell px-6 py-4 text-xs uppercase tracking-[0.22em] text-ink/55 xl:grid">
          <span>Name</span>
          <span>Email</span>
          <span>Phone</span>
          <span>Enquiry</span>
          <span>Category</span>
          <span>Status</span>
          <span>Created</span>
          <span>Actions</span>
        </div>
        <div>
          {!loading && enquiries.length ? (
            enquiries.map((enquiry) => (
              <div key={enquiry.id} className="border-b border-black/5 px-6 py-5 last:border-b-0 xl:grid xl:grid-cols-[0.9fr,1fr,0.9fr,1.2fr,1fr,1fr,1fr,220px] xl:gap-4">
                <div>
                  <p className="font-semibold text-ink">{getDisplayValue(enquiry.name, "Name pending")}</p>
                </div>
                <div className="mt-2 text-ink/70 xl:mt-0">{getDisplayValue(enquiry.email, "Email pending")}</div>
                <div className="mt-2 text-ink/70 xl:mt-0">{getDisplayValue(enquiry.phone, "Not provided")}</div>
                <div className="mt-3 xl:mt-0">
                  <p className="font-semibold text-ink">{getDisplayValue(enquiry.subject, "General enquiry")}</p>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-ink/55">{getDisplayValue(enquiry.message, "No message provided.")}</p>
                  <Link href={`/admin/enquiries/${enquiry.id}`} className="mt-2 inline-flex text-sm font-medium text-ink underline">
                    View details
                  </Link>
                </div>
                <div className="mt-3 text-ink/70 xl:mt-0">{getDisplayValue(enquiry.category, "GENERAL ENQUIRY")}</div>
                <div className="mt-3 xl:mt-0">
                  <ContactMessageStatusBadge status={getDisplayValue(enquiry.status, "NEW")} />
                </div>
                <div className="mt-3 text-ink/70 xl:mt-0">{formatAdminDateTime(enquiry.createdAt)}</div>
                <div className="relative z-30 mt-4 overflow-visible xl:mt-0">
                  <ContactMessageStatusActions contactMessage={enquiry} />
                </div>
              </div>
            ))
          ) : !loading ? (
            <div className="px-6 py-12 text-sm text-ink/60">
              No contact enquiries have been submitted yet.
            </div>
          ) : (
            <div className="px-6 py-12 text-sm text-ink/60">
              Loading enquiries...
            </div>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
