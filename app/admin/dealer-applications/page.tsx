"use client";

import { useEffect, useState } from "react";
import { DealerApplicationReviewBoard } from "@/components/admin/dealer-application-review-board";
import { AdminShell } from "@/components/layout/admin-shell";
import { useAuth } from "@/lib/auth";
import { getDealerApplicationsData } from "@/lib/data";
import { canAccessRole } from "@/lib/permissions";
import { DealerApplication } from "@/types";

export default function AdminDealerApplicationsPage() {
  const { appUser, loading } = useAuth();
  const [applications, setApplications] = useState<DealerApplication[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadApplications() {
      if (loading || !canAccessRole("admin", appUser?.role)) return;
      const result = await getDealerApplicationsData();
      if (cancelled) return;
      setApplications(result.items);
      setError(result.error ?? "");
    }

    void loadApplications();

    return () => {
      cancelled = true;
    };
  }, [appUser?.role, loading]);

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
