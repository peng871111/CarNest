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
        <div className="hidden grid-cols-[minmax(140px,0.8fr)_minmax(180px,1fr)_minmax(140px,0.8fr)_minmax(280px,1.5fr)_minmax(130px,0.75fr)_minmax(110px,0.6fr)_minmax(150px,0.8fr)_180px] items-center gap-5 border-b border-black/5 bg-shell px-6 py-4 text-xs uppercase tracking-[0.22em] text-ink/55 xl:grid">
          <span>Name</span>
          <span>Email</span>
          <span>Phone</span>
          <span>Enquiry</span>
          <span>Category</span>
          <span>Status</span>
          <span>Created</span>
          <span className="text-right">Actions</span>
        </div>
        <div>
          {!loading && enquiries.length ? (
            enquiries.map((enquiry) => (
              <div
                key={enquiry.id}
                className="border-b border-black/5 px-5 py-5 last:border-b-0 sm:px-6 xl:grid xl:min-h-[132px] xl:grid-cols-[minmax(140px,0.8fr)_minmax(180px,1fr)_minmax(140px,0.8fr)_minmax(280px,1.5fr)_minmax(130px,0.75fr)_minmax(110px,0.6fr)_minmax(150px,0.8fr)_180px] xl:items-center xl:gap-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink xl:text-[15px]">{getDisplayValue(enquiry.name, "Name pending")}</p>
                </div>
                <div className="mt-2 min-w-0 xl:mt-0">
                  <p className="truncate text-sm text-ink/70">{getDisplayValue(enquiry.email, "Email pending")}</p>
                </div>
                <div className="mt-2 min-w-0 xl:mt-0">
                  <p className="truncate text-sm text-ink/70">{getDisplayValue(enquiry.phone, "Not provided")}</p>
                </div>
                <div className="mt-4 min-w-0 xl:mt-0 xl:self-stretch">
                  <div className="flex h-full min-h-[92px] flex-col justify-center">
                    <p className="truncate text-sm font-semibold text-ink xl:text-[15px]">{getDisplayValue(enquiry.subject, "General enquiry")}</p>
                    <p className="mt-1 line-clamp-2 min-h-[42px] max-w-full overflow-hidden text-sm leading-5 text-ink/55 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                      {getDisplayValue(enquiry.message, "No message provided.")}
                    </p>
                    <div className="mt-2">
                      <Link
                        href={`/admin/enquiries/${enquiry.id}`}
                        className="inline-flex h-8 items-center text-sm font-medium text-ink underline decoration-black/20 underline-offset-4 transition hover:text-bronze hover:decoration-bronze"
                      >
                        View details
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="mt-3 min-w-0 xl:mt-0">
                  <p className="truncate text-sm text-ink/70">{getDisplayValue(enquiry.category, "GENERAL ENQUIRY")}</p>
                </div>
                <div className="mt-3 flex min-h-[40px] items-center xl:mt-0">
                  <ContactMessageStatusBadge status={getDisplayValue(enquiry.status, "NEW")} />
                </div>
                <div className="mt-3 min-w-0 xl:mt-0">
                  <p className="whitespace-nowrap text-sm text-ink/70">{formatAdminDateTime(enquiry.createdAt)}</p>
                </div>
                <div className="relative z-30 mt-4 flex min-h-[44px] items-center xl:mt-0 xl:justify-end">
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
