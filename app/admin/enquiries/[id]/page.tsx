import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/layout/admin-shell";
import { ContactMessageStatusActions } from "@/components/contact-messages/contact-message-status-actions";
import { ContactMessageStatusBadge } from "@/components/contact-messages/contact-message-status-badge";
import { getContactMessageById } from "@/lib/data";
import { formatAdminDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminEnquiryDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ write?: string; status?: string }>;
}) {
  const { id } = await params;
  const enquiry = await getContactMessageById(id);
  const query = searchParams ? await searchParams : undefined;

  if (!enquiry) notFound();

  const writeStatus =
    query?.write === "success"
      ? `Enquiry status updated to ${query.status ?? "saved"}`
      : query?.write === "mock"
        ? "Enquiry update recorded"
        : "";

  return (
    <AdminShell title="Enquiry Details" description="Review the full enquiry details and move the message through the CarNest admin response flow.">
      {writeStatus ? <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">{writeStatus}</div> : null}

      <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
        <Link
          href="/admin/enquiries"
          className="inline-flex items-center text-sm font-medium text-ink/72 transition hover:text-ink"
        >
          ← Back to enquiries
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="mt-5">
            <p className="text-xs uppercase tracking-[0.26em] text-bronze">Contact enquiry</p>
            <h2 className="mt-3 text-3xl font-semibold text-ink">{enquiry.subject}</h2>
            <p className="mt-3 text-sm leading-6 text-ink/60">
              Submitted {formatAdminDateTime(enquiry.createdAt)}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <ContactMessageStatusBadge status={enquiry.status} />
            <ContactMessageStatusActions contactMessage={enquiry} redirectBase={`/admin/enquiries/${enquiry.id}`} />
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Name</p>
            <p className="mt-2 text-base text-ink">{enquiry.name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Email</p>
            <p className="mt-2 text-base text-ink">{enquiry.email}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Phone</p>
            <p className="mt-2 text-base text-ink">{enquiry.phone || "Not provided"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Category</p>
            <p className="mt-2 text-base text-ink">{enquiry.category}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Status</p>
            <div className="mt-2">
              <ContactMessageStatusBadge status={enquiry.status} />
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
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-ink/72">{enquiry.message}</p>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
