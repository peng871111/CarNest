import { redirect } from "next/navigation";

export default async function SellerOfferDetailRedirectPage({
  params
}: {
  params: Promise<{ offerId: string }>;
}) {
  const { offerId } = await params;
  redirect(`/seller/offers?offerId=${encodeURIComponent(offerId)}`);
}
