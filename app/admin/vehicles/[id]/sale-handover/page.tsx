import { SaleHandoverWorkspace } from "@/components/admin/sale-handover-workspace";

export const dynamic = "force-dynamic";

export default async function AdminVehicleSaleHandoverPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SaleHandoverWorkspace listingId={id} />;
}
