import { SaleHandoverWorkspace } from "@/components/admin/sale-handover-workspace";

export const dynamic = "force-dynamic";

export default async function AdminVehicleSaleHandoverPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ mode?: string; recordId?: string }>;
}) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  return <SaleHandoverWorkspace listingId={id} initialMode={query.mode} initialRecordId={query.recordId} />;
}
