"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DealerAdditionalInfoPanel } from "@/components/dealer/dealer-additional-info-panel";
import { useAuth } from "@/lib/auth";
import { getDealerApplicationByUserId } from "@/lib/data";
import { formatAdminDateTime, formatCalendarDate } from "@/lib/utils";
import { DealerApplication, DealerStatus } from "@/types";

type StatusConfig = {
  eyebrow: string;
  title: string;
  body: string;
  secondary?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  noteLabel?: string;
  note?: string;
};

function normalizeDealerStatus(application: DealerApplication | null, fallbackStatus?: DealerStatus): DealerStatus {
  if (application?.status) return application.status;
  return fallbackStatus ?? "none";
}

function getStatusConfig(status: DealerStatus, application: DealerApplication | null, justSubmitted: boolean): StatusConfig {
  if (justSubmitted || status === "submitted_unverified") {
    return {
      eyebrow: "Dealer application",
      title: "Your dealer application has been submitted",
      body: "Thanks for your submission. Our team is reviewing your application.",
      secondary: "Most applications are reviewed within 1–2 business days.",
      primaryHref: "/dealer/application-status",
      primaryLabel: "View application status",
      secondaryHref: "/",
      secondaryLabel: "Back to site"
    };
  }

  if (status === "pending") {
    return {
      eyebrow: "Dealer application",
      title: "Your application is under review",
      body: "We’re currently reviewing your dealer application.",
      secondary: "We’ll notify you once a decision has been made.",
      primaryHref: "/dealer/application-status",
      primaryLabel: "View application status",
      secondaryHref: "/",
      secondaryLabel: "Back to site"
    };
  }

  if (status === "pending_review") {
    return {
      eyebrow: "Dealer application",
      title: "Your additional information has been submitted",
      body: "Thanks for the update. Our team is reviewing the additional information you provided.",
      secondary: "We’ll notify you once a decision has been made.",
      primaryHref: "/dealer/application-status",
      primaryLabel: "View application status",
      secondaryHref: "/",
      secondaryLabel: "Back to site"
    };
  }

  if (status === "info_requested") {
    return {
      eyebrow: "More information required",
      title: "More information is required",
      body: "We need a few more details before we can continue reviewing your application.",
      primaryHref: "/dealer/apply",
      primaryLabel: "Update application",
      secondaryHref: "/",
      secondaryLabel: "Back to site",
      noteLabel: "Admin note",
      note: application?.infoRequestNote
    };
  }

  if (status === "approved") {
    return {
      eyebrow: "Dealer approved",
      title: "Your dealer account is now active",
      body: "Your application has been approved and your dealer access is ready.",
      primaryHref: "/dealer/dashboard",
      primaryLabel: "Go to dealer dashboard",
      secondaryHref: "/",
      secondaryLabel: "Back to site"
    };
  }

  if (status === "rejected") {
    return {
      eyebrow: "Application not approved",
      title: "Your application was not approved",
      body: "Your application was not approved at this time.",
      secondaryHref: "/",
      secondaryLabel: "Back to site",
      noteLabel: "Reason",
      note: application?.rejectReason
    };
  }

  return {
    eyebrow: "Dealer application",
    title: "Complete your dealer application",
    body: "Dealer access stays locked until your application is submitted and reviewed.",
    primaryHref: "/dealer/apply",
    primaryLabel: "Start dealer application",
    secondaryHref: "/",
    secondaryLabel: "Back to site"
  };
}

export function DealerApplicationStatusPanel({ justSubmitted = false }: { justSubmitted?: boolean }) {
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

  if (loading || loadingApplication) {
    return <p className="text-sm text-ink/60">Loading your dealer application status...</p>;
  }

  const status = normalizeDealerStatus(application, appUser?.dealerStatus);
  if (status === "info_requested" && application) {
    return <DealerAdditionalInfoPanel application={application} onUpdated={setApplication} />;
  }

  const config = getStatusConfig(status, application, justSubmitted);

  return (
    <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
      <p className="text-xs uppercase tracking-[0.28em] text-bronze">{config.eyebrow}</p>
      <h1 className="mt-4 font-display text-4xl text-ink">{config.title}</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">{config.body}</p>
      {config.secondary ? <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/55">{config.secondary}</p> : null}

      {config.note ? (
        <div className="mt-6 rounded-[24px] border border-black/5 bg-shell px-5 py-4">
          <p className="text-xs uppercase tracking-[0.22em] text-bronze">{config.noteLabel}</p>
          <p className="mt-2 text-sm leading-6 text-ink/70">{config.note}</p>
        </div>
      ) : null}

      {application ? (
        <div className="mt-6 grid gap-3 rounded-[24px] border border-black/5 bg-shell px-5 py-4 text-sm text-ink/65 md:grid-cols-2">
          <p>Business: {application.legalBusinessName || application.tradingName || "Not provided"}</p>
          <p>Contact: {application.contactEmail || "Not provided"}</p>
          <p>Licence: {[application.lmctNumber, application.licenceState].filter(Boolean).join(" · ") || "Not provided"}</p>
          <p>Licence expiry: {formatCalendarDate(application.licenceExpiry)}</p>
          <p>Submitted: {formatAdminDateTime(application.requestedAt ?? application.lastSubmittedAt)}</p>
          <p>Reviewed: {application.reviewedAt ? formatAdminDateTime(application.reviewedAt) : "Not reviewed yet"}</p>
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-4">
        {config.primaryHref && config.primaryLabel ? (
          <Link href={config.primaryHref} className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
            {config.primaryLabel}
          </Link>
        ) : null}
        {config.secondaryHref && config.secondaryLabel ? (
          <Link href={config.secondaryHref} className="rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-ink">
            {config.secondaryLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
