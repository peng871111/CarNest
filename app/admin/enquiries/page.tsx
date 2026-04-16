import { AdminShell } from "@/components/layout/admin-shell";
import Link from "next/link";
import { ContactMessageStatusActions } from "@/components/contact-messages/contact-message-status-actions";
import { ContactMessageStatusBadge } from "@/components/contact-messages/contact-message-status-badge";
import { getContactMessagesData } from "@/lib/data";
import { formatAdminDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminEnquiriesPage({
  searchParams
}: {
  searchParams?: Promise<{ write?: string; status?: string; enquiryId?: string }>;
}) {
  const { items: enquiries, error } = await getContactMessagesData();
  const params = searchParams ? await searchParams : undefined;
  const writeStatus =
    params?.write === "success"
      ? `Enquiry status updated to ${params.status ?? "saved"}`
      : params?.write === "mock"
        ? "Enquiry update recorded"
        : "No recent updates";

  return (
    <AdminShell title="Enquiries" description="Review contact form submissions and move each enquiry through the CarNest response process.">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">Enquiries loaded: {enquiries.length}</div>
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          Recent activity: {writeStatus}
        </div>
      </div>

      {error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
          Something went wrong. Please try again.
        </div>
      ) : null}

      <section className="overflow-visible rounded-[32px] border border-black/5 bg-white shadow-panel">
        <div className="grid grid-cols-[0.9fr,1fr,0.9fr,1.2fr,1fr,1fr,1fr,220px] gap-4 border-b border-black/5 bg-shell px-6 py-4 text-xs uppercase tracking-[0.22em] text-ink/55">
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
          {enquiries.length ? (
            enquiries.map((enquiry) => (
              <div key={enquiry.id} className="grid grid-cols-[0.9fr,1fr,0.9fr,1.2fr,1fr,1fr,1fr,220px] gap-4 border-b border-black/5 px-6 py-5 text-sm last:border-b-0">
                <div>
                  <p className="font-semibold text-ink">{enquiry.name}</p>
                </div>
                <div className="text-ink/70">{enquiry.email}</div>
                <div className="text-ink/70">{enquiry.phone || "Not provided"}</div>
                <div>
                  <p className="font-semibold text-ink">{enquiry.subject}</p>
                  <p className="mt-1 line-clamp-2 text-ink/55">{enquiry.message}</p>
                  <Link href={`/admin/enquiries/${enquiry.id}`} className="mt-2 inline-flex text-sm font-medium text-ink underline">
                    View details
                  </Link>
                </div>
                <div className="text-ink/70">{enquiry.category}</div>
                <div>
                  <ContactMessageStatusBadge status={enquiry.status} />
                </div>
                <div className="text-ink/70">{formatAdminDateTime(enquiry.createdAt)}</div>
                <div className="relative z-30 overflow-visible">
                  <ContactMessageStatusActions contactMessage={enquiry} />
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-12 text-sm text-ink/60">
              No contact enquiries have been submitted yet.
            </div>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
