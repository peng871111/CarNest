import { DealerApplicationStatusPanel } from "@/components/dealer/dealer-application-status-panel";
import { WorkspaceHeader } from "@/components/layout/workspace-header";

type DealerApplicationStatusPageProps = {
  searchParams?: Promise<{
    submitted?: string;
  }>;
};

export default async function DealerApplicationStatusPage({ searchParams }: DealerApplicationStatusPageProps) {
  const params = searchParams ? await searchParams : undefined;

  return (
    <div>
      <WorkspaceHeader workspaceLabel="ACCOUNT" />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <DealerApplicationStatusPanel justSubmitted={params?.submitted === "success"} />
      </main>
    </div>
  );
}
