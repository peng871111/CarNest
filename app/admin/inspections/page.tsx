import Link from "next/link";
import { AdminShell } from "@/components/layout/admin-shell";
import { InspectionStatusActions } from "@/components/inspections/inspection-status-actions";
import { InspectionStatusBadge } from "@/components/inspections/inspection-status-badge";
import { getInspectionRequestsData } from "@/lib/data";
import { formatAdminDateTime, getVehicleDisplayReference } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminInspectionsPage({
  searchParams
}: {
  searchParams?: Promise<{ write?: string; status?: string; inspectionId?: string }>;
}) {
  const { items: inspectionRequests, error } = await getInspectionRequestsData();
  const params = searchParams ? await searchParams : undefined;
  const writeStatus =
    params?.write === "success"
      ? `Inspection status updated to ${params.status ?? "saved"}`
      : params?.write === "mock"
        ? "Inspection update recorded"
        : "No recent updates";

  return (
    <AdminShell
      title="Inspections"
      description="Manage warehouse inspection requests and move each appointment through the CarNest coordination workflow."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          Inspection requests loaded: {inspectionRequests.length}
        </div>
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          Recent activity: {writeStatus}
        </div>
      </div>

      {error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
          Something went wrong. Please try again.
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[32px] border border-black/5 bg-white shadow-panel">
        <div className="grid grid-cols-[1.3fr,1fr,1fr,1fr,220px] gap-4 border-b border-black/5 bg-shell px-6 py-4 text-xs uppercase tracking-[0.22em] text-ink/55">
          <span>Vehicle</span>
          <span>Buyer</span>
          <span>Preferred time</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        <div>
          {inspectionRequests.length ? (
            inspectionRequests.map((inspectionRequest) => (
              <div
                key={inspectionRequest.id}
                className="grid grid-cols-[1.3fr,1fr,1fr,1fr,220px] gap-4 border-b border-black/5 px-6 py-5 text-sm last:border-b-0"
              >
                <Link
                  href={`/admin/vehicles/${inspectionRequest.vehicleId}`}
                  className="-mx-3 -my-2 block rounded-[20px] px-3 py-2 transition hover:bg-shell"
                >
                  <p className="font-semibold text-ink">{inspectionRequest.vehicleTitle}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink/45">
                    {getVehicleDisplayReference(inspectionRequest.vehicleId)}
                  </p>
                  <p className="mt-1 text-ink/55">{formatAdminDateTime(inspectionRequest.createdAt)}</p>
                </Link>
                <div>
                  <p className="font-medium text-ink">{inspectionRequest.buyerName}</p>
                  <p className="mt-1 text-ink/55">{inspectionRequest.buyerEmail}</p>
                  <p className="mt-1 text-ink/55">{inspectionRequest.buyerPhone}</p>
                </div>
                <div>
                  <p className="text-ink/70">{inspectionRequest.preferredTime}</p>
                  <p className="mt-1 line-clamp-3 text-ink/55">{inspectionRequest.message || "No extra notes provided."}</p>
                </div>
                <div>
                  <InspectionStatusBadge status={inspectionRequest.status} />
                </div>
                <div>
                  <InspectionStatusActions inspectionRequest={inspectionRequest} />
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-12 text-sm text-ink/60">
              No inspection requests yet.
            </div>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
