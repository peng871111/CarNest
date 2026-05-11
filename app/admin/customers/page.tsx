"use client";

import { VehicleWorkspaceScreen } from "@/components/admin/vehicle-workspace-screen";

export default function AdminCustomersPage() {
  return (
    <VehicleWorkspaceScreen
      title="Customers"
      description="Create reusable customer profiles, review linked vehicles, and correct private customer-to-vehicle relationships without touching the public website."
      defaultView="customers"
    />
  );
}
