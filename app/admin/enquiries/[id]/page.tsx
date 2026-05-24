import { AdminEnquiryDetailPanel } from "@/components/contact-messages/admin-enquiry-detail-panel";

export const dynamic = "force-dynamic";

export default async function AdminEnquiryDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ write?: string; status?: string }>;
}) {
  const { id } = await params;
  const query = searchParams ? await searchParams : undefined;
  return <AdminEnquiryDetailPanel enquiryId={id} write={query?.write} status={query?.status} />;
}
