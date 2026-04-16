import { SellerOffersPageClient } from "@/components/offers/seller-offers-page";

export const dynamic = "force-dynamic";

export default async function SellerOffersPage({
  searchParams
}: {
  searchParams?: Promise<{ write?: string; status?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;

  return <SellerOffersPageClient initialWrite={params?.write} initialStatus={params?.status} />;
}
