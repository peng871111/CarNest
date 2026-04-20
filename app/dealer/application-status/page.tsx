import Link from "next/link";
import { cookies } from "next/headers";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { DealerStatus } from "@/types";

function getStatusConfig(status: DealerStatus) {
  if (status === "approved") {
    return {
      eyebrow: "Dealer approved",
      title: "Your dealer account is active",
      description: "Your application has been approved. You can now continue to the dealer dashboard and use dealer listing tools.",
      primaryHref: "/dealer",
      primaryLabel: "Continue to dealer dashboard"
    };
  }

  if (status === "info_requested") {
    return {
      eyebrow: "More information required",
      title: "We need a little more information",
      description: "Your dealer application needs additional details before it can be approved. Review your submission and provide the requested information.",
      primaryHref: "/dealer/apply",
      primaryLabel: "Update dealer application"
    };
  }

  if (status === "rejected") {
    return {
      eyebrow: "Application not approved",
      title: "Your dealer application was not approved",
      description: "Your dealer access is still blocked. Review your application details and submit an updated application if you would like CarNest to reassess it.",
      primaryHref: "/dealer/apply",
      primaryLabel: "Review application"
    };
  }

  if (status === "none") {
    return {
      eyebrow: "Dealer application",
      title: "Complete your dealer application",
      description: "Dealer access stays locked until your application is submitted and reviewed. Start your application to begin the verification process.",
      primaryHref: "/dealer/apply",
      primaryLabel: "Start dealer application"
    };
  }

  return {
    eyebrow: "Dealer status",
    title: "Application under review",
    description: "Your dealer account is pending manual verification. We'll notify you once the review is complete or if more information is required.",
    primaryHref: "/dealer/apply",
    primaryLabel: "Review application steps"
  };
}

export default async function DealerApplicationStatusPage() {
  const cookieStore = await cookies();
  const dealerStatus = (cookieStore.get("carnest_dealer_status")?.value as DealerStatus | undefined) ?? "none";
  const statusConfig = getStatusConfig(dealerStatus);

  return (
    <div>
      <WorkspaceHeader workspaceLabel="ACCOUNT" />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
          <p className="text-xs uppercase tracking-[0.28em] text-bronze">{statusConfig.eyebrow}</p>
          <h1 className="mt-4 font-display text-4xl text-ink">{statusConfig.title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">{statusConfig.description}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href={statusConfig.primaryHref} className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
              {statusConfig.primaryLabel}
            </Link>
            <Link href="/dashboard/settings" className="rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-ink">
              Account Settings
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
