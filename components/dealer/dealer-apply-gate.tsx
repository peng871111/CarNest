"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DealerApplicationForm } from "@/components/forms/dealer-application-form";
import { useAuth } from "@/lib/auth";
import { getDealerApplicationByUserId } from "@/lib/data";
import { DealerApplication } from "@/types";

export function DealerApplyGate() {
  const router = useRouter();
  const { appUser, loading } = useAuth();
  const [application, setApplication] = useState<DealerApplication | null>(null);
  const [loadingApplication, setLoadingApplication] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadApplication() {
      if (!appUser?.id) {
        setApplication(null);
        setLoadingApplication(false);
        return;
      }

      setLoadingApplication(true);
      const nextApplication = await getDealerApplicationByUserId(appUser.id).catch(() => null);
      if (!cancelled) {
        setApplication(nextApplication);
        setLoadingApplication(false);
      }
    }

    void loadApplication();

    return () => {
      cancelled = true;
    };
  }, [appUser?.id]);

  useEffect(() => {
    if (loading || loadingApplication) return;

    if (appUser?.dealerStatus === "approved" || application?.status === "approved") {
      router.replace("/dealer/dashboard");
      return;
    }

    if (application && application.status !== "info_requested") {
      router.replace("/dealer/application-status");
    }
  }, [appUser?.dealerStatus, application, loading, loadingApplication, router]);

  if (loading || loadingApplication) {
    return <p className="text-sm text-ink/60">Loading your dealer application details...</p>;
  }

  if (application && application.status !== "info_requested") {
    return <p className="text-sm text-ink/60">Redirecting to your dealer application status...</p>;
  }

  return <DealerApplicationForm />;
}
