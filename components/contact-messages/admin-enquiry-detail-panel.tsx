"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ContactMessageStatusActions } from "@/components/contact-messages/contact-message-status-actions";
import { ContactMessageStatusBadge } from "@/components/contact-messages/contact-message-status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { useAuth } from "@/lib/auth";
import { getContactMessageById } from "@/lib/data";
import { hasAdminPermission } from "@/lib/permissions";
import { formatAdminDateTime } from "@/lib/utils";
import { ContactMessage } from "@/types";

function getDisplayValue(value: string | undefined, fallback: string) {
  return value?.trim() ? value : fallback;
}

export function AdminEnquiryDetailPanel({
  enquiryId,
  write,
  status
}: {
  enquiryId: string;
  write?: string;
  status?: string;
}) {
  const router = useRouter();
  const { appUser, firebaseUser, loading: authLoading } = useAuth();
  const canManageEnquiries = hasAdminPermission(appUser, "manageEnquiries");
  const [enquiry, setEnquiry] = useState<ContactMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const writeStatus =
    write === "success"
      ? `Enquiry status updated to ${status ?? "saved"}`
      : write === "mock"
        ? "Enquiry update recorded"
        : "";

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
        const result = await getContactMessageById(enquiryId);
        if (cancelled) return;
        if (!result) {
          router.replace("/admin/enquiries");
          return;
        }
        setEnquiry(result);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "We couldn't load this enquiry.");
          setEnquiry(null);
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
  }, [authLoading, canManageEnquiries, enquiryId, firebaseUser, router]);

  return (
    <AdminShell title="Enquiry Details" description="Review the full enquiry details and move the message through the CarNest admin response flow." requiredPermission="manageEnquiries">
      {writeStatus ? <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">{writeStatus}</div> : null}
      {errorMessage ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
          Something went wrong. Please try again.
        </div>
      ) : null}

      <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
        <Link
          href="/admin/enquiries"
          className="inline-flex items-center text-sm font-medium text-ink/72 transition hover:text-ink"
        >
          ← Back to enquiries
        </Link>

        {loading ? (
          <div className="mt-6 text-sm text-ink/60">Loading enquiry...</div>
        ) : enquiry ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="mt-5">
                <p className="text-xs uppercase tracking-[0.26em] text-bronze">Contact enquiry</p>
                <h2 className="mt-3 text-3xl font-semibold text-ink">{getDisplayValue(enquiry.subject, "General enquiry")}</h2>
                <p className="mt-3 text-sm leading-6 text-ink/60">
                  Submitted {formatAdminDateTime(enquiry.createdAt)}
                </p>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <ContactMessageStatusBadge status={getDisplayValue(enquiry.status, "NEW")} />
                <ContactMessageStatusActions contactMessage={enquiry} redirectBase={`/admin/enquiries/${enquiry.id}`} />
              </div>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Name</p>
                <p className="mt-2 text-base text-ink">{getDisplayValue(enquiry.name, "Name pending")}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Email</p>
                <p className="mt-2 text-base text-ink">{getDisplayValue(enquiry.email, "Email pending")}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Phone</p>
                <p className="mt-2 text-base text-ink">{getDisplayValue(enquiry.phone, "Not provided")}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Category</p>
                <p className="mt-2 text-base text-ink">{getDisplayValue(enquiry.category, "GENERAL ENQUIRY")}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Status</p>
                <div className="mt-2">
                  <ContactMessageStatusBadge status={getDisplayValue(enquiry.status, "NEW")} />
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Created at</p>
                <p className="mt-2 text-base text-ink">{formatAdminDateTime(enquiry.createdAt)}</p>
              </div>
            </div>

            <div className="mt-8 rounded-[28px] border border-black/5 bg-shell/80 p-2">
              <div className="rounded-[22px] border border-white/70 bg-white/75 px-6 py-6">
                <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Full message</p>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-ink/72">{getDisplayValue(enquiry.message, "No message provided.")}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-6 text-sm text-ink/60">Enquiry not found.</div>
        )}
      </section>
    </AdminShell>
  );
}
