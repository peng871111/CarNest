"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { getComplianceAlertsData, listUsers } from "@/lib/data";
import { AdminAccessManager } from "@/components/admin/admin-access-manager";
import { useAuth } from "@/lib/auth";
import { canAccessRole } from "@/lib/permissions";
import { AppUser, ComplianceAlert } from "@/types";

export default function AdminUsersPage() {
  const { appUser, loading } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [complianceAlerts, setComplianceAlerts] = useState<ComplianceAlert[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadUsersPage() {
      if (loading || !canAccessRole("admin", appUser?.role)) return;
      const [nextUsers, complianceAlertsResult] = await Promise.all([listUsers(), getComplianceAlertsData()]);
      if (cancelled) return;
      setUsers(nextUsers);
      setComplianceAlerts(complianceAlertsResult.items);
    }

    void loadUsersPage();

    return () => {
      cancelled = true;
    };
  }, [appUser?.role, loading]);

  const adminUsers = useMemo(
    () => users.filter((user) => user.role === "admin" || user.role === "super_admin"),
    [users]
  );
  const openComplianceAlerts = useMemo(
    () => complianceAlerts.filter((item) => item.status === "open"),
    [complianceAlerts]
  );

  return (
    <AdminShell
      title="Admin Access"
      description="Manage internal admin and super-admin accounts only. Use User Support for customer account lookups and operational support tasks."
      requiredPermission="manageAdmins"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          Admin accounts: {adminUsers.length}
        </div>
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          Super admins: {adminUsers.filter((user) => user.role === "super_admin").length}
        </div>
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          Standard accounts hidden here by default
        </div>
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
          Open compliance alerts: {openComplianceAlerts.length}
        </div>
      </div>
      <AdminAccessManager users={adminUsers} complianceAlerts={complianceAlerts} />
    </AdminShell>
  );
}
