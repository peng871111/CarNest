import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WorkspaceHeader } from "@/components/layout/workspace-header";

export default async function DealerDashboardPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get("carnest_role")?.value;
  const dealerStatus = cookieStore.get("carnest_dealer_status")?.value;

  if (role === "dealer" && dealerStatus !== "approved") {
    redirect("/dealer/application-status");
  }

  return (
    <div>
      <WorkspaceHeader workspaceLabel="ACCOUNT" />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
          <p className="text-xs uppercase tracking-[0.28em] text-bronze">Dealer</p>
          <h1 className="mt-4 font-display text-4xl text-ink">Dealer workspace</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
            Your dealer account is active. Dealer-specific tools and workflow controls will appear here.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/dashboard/settings" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
              Account Settings
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
