import { AdminEnquiriesPanel } from "@/components/contact-messages/admin-enquiries-panel";

export const dynamic = "force-dynamic";

export default async function AdminEnquiriesPage({
  searchParams
}: {
  searchParams?: Promise<{ write?: string; status?: string; enquiryId?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  return <AdminEnquiriesPanel write={params?.write} status={params?.status} />;
}
