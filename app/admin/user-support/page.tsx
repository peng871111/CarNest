import { AdminShell } from "@/components/layout/admin-shell";
import { UserSupportPanel } from "@/components/admin/user-support-panel";
import { getUserSupportRecord } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminUserSupportPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const query = ((await searchParams)?.q ?? "").trim();
  const record = await getUserSupportRecord(query);

  return (
    <AdminShell
      title="User Support"
      description="Search a specific customer or listing, review account-linked activity, and perform support actions without scanning the full user base."
      requiredPermission="manageUsers"
    >
      <UserSupportPanel initialQuery={query} initialRecord={record} />
    </AdminShell>
  );
}
