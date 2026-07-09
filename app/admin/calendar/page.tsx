import { AdminCalendarPanel } from "@/components/admin/admin-calendar-panel";
import { AdminShell } from "@/components/layout/admin-shell";

export const dynamic = "force-dynamic";

export default function AdminCalendarPage() {
  return (
    <AdminShell
      title="Admin Calendar"
      description="View and manage daily appointments and important events."
      requiredPermission="manageVehicles"
    >
      <AdminCalendarPanel />
    </AdminShell>
  );
}
