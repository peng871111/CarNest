import { DealerApplicationReviewBoard } from "@/components/admin/dealer-application-review-board";
import { AdminShell } from "@/components/layout/admin-shell";
import { getDealerApplicationsData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminDealerApplicationsPage() {
  const { items: applications, error } = await getDealerApplicationsData();

  return (
    <AdminShell
      title="Dealer Applications"
      description="Review dealer account applications, verification signals, and manual approval outcomes."
      requiredPermission="manageUsers"
    >
      {error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
          Something went wrong while loading dealer applications. Please try again.
        </div>
      ) : null}
      <DealerApplicationReviewBoard initialApplications={applications} />
    </AdminShell>
  );
}
