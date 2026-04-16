import Link from "next/link";
import { AdminShell } from "@/components/layout/admin-shell";
import { PricingRequestAdminEditor } from "@/components/pricing/pricing-request-admin-editor";
import { PricingRequestStatusBadge } from "@/components/pricing/pricing-request-status-badge";
import { getAppUserById, getPricingRequestsData, getVehicleById } from "@/lib/data";
import { formatAdminDateTime, formatCurrency, getAccountDisplayReference, getVehicleDisplayReference } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage({
  searchParams
}: {
  searchParams?: Promise<{ write?: string; status?: string; pricingId?: string }>;
}) {
  const { items: pricingRequests, error } = await getPricingRequestsData();
  const params = searchParams ? await searchParams : undefined;
  const writeStatus =
    params?.write === "success"
      ? `Pricing request updated to ${params.status ?? "saved"}`
      : params?.write === "mock"
        ? "Pricing request update recorded"
        : "No recent updates";

  const requestsWithContext = await Promise.all(
    pricingRequests.map(async (pricingRequest) => ({
      pricingRequest,
      user: await getAppUserById(pricingRequest.userId),
      vehicle: pricingRequest.vehicleId ? await getVehicleById(pricingRequest.vehicleId) : null
    }))
  );

  return (
    <AdminShell
      title="Pricing"
      description="Review manual pricing advice requests, respond with human guidance, and move each lead through the CarNest follow-up process."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">Pricing requests loaded: {pricingRequests.length}</div>
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">Recent activity: {writeStatus}</div>
      </div>

      {error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
          Something went wrong. Please try again.
        </div>
      ) : null}

      <section className="rounded-[32px] border border-black/5 bg-white shadow-panel">
        <div className="grid grid-cols-[1fr,1fr,1.1fr,1.3fr,1.3fr] gap-4 border-b border-black/5 bg-shell px-6 py-4 text-xs uppercase tracking-[0.22em] text-ink/55">
          <span>Account</span>
          <span>Vehicle</span>
          <span>Timeline</span>
          <span>Request</span>
          <span>Admin actions</span>
        </div>
        <div>
          {requestsWithContext.length ? (
            requestsWithContext.map(({ pricingRequest, user, vehicle }) => (
              <div
                key={pricingRequest.id}
                className="grid grid-cols-[1fr,1fr,1.1fr,1.3fr,1.3fr] gap-4 border-b border-black/5 px-6 py-5 text-sm last:border-b-0"
              >
                <div>
                  <p className="font-semibold text-ink">{user?.displayName || user?.name || "CarNest user"}</p>
                  <p className="mt-1 text-ink/55">{user?.email || "Email unavailable"}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink/45">
                    {getAccountDisplayReference(user ?? { id: pricingRequest.userId })}
                  </p>
                </div>
                <div>
                  {vehicle ? (
                    <Link href={`/admin/vehicles/${vehicle.id}`} className="block rounded-[20px] transition hover:text-bronze">
                      <p className="font-semibold text-ink">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink/45">
                        {getVehicleDisplayReference(vehicle)}
                      </p>
                    </Link>
                  ) : pricingRequest.vehicleId ? (
                    <>
                      <p className="font-semibold text-ink">Linked vehicle unavailable</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink/45">
                        {getVehicleDisplayReference(pricingRequest.vehicleId)}
                      </p>
                    </>
                  ) : (
                    <p className="text-ink/55">No linked vehicle</p>
                  )}
                </div>
                <div>
                  <p className="font-medium text-ink">{pricingRequest.timeline}</p>
                  <p className="mt-1 text-ink/55">
                    {typeof pricingRequest.currentPrice === "number" ? formatCurrency(pricingRequest.currentPrice) : "No asking price supplied"}
                  </p>
                  <p className="mt-2 text-ink/55">{formatAdminDateTime(pricingRequest.createdAt)}</p>
                </div>
                <div className="space-y-3">
                  <PricingRequestStatusBadge status={pricingRequest.status} />
                  <p className="text-ink/70">{pricingRequest.message}</p>
                  {pricingRequest.response ? (
                    <div className="rounded-[20px] bg-shell px-4 py-3 text-sm text-ink/65">
                      <p className="font-medium text-ink">Response</p>
                      <p className="mt-2 leading-6">{pricingRequest.response}</p>
                    </div>
                  ) : null}
                </div>
                <div>
                  <PricingRequestAdminEditor pricingRequest={pricingRequest} />
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-12 text-sm text-ink/60">No pricing advice requests yet.</div>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
