"use client";

import { VehicleWorkspaceScreen } from "@/components/admin/vehicle-workspace-screen";

export default function AdminPublicListingsPage() {
  return (
    <VehicleWorkspaceScreen
      title="Public Listings"
      description="Review live website listings, moderate visibility, and link each listing back to its private vehicle record without changing the public site behavior."
      defaultView="listings"
    />
  );
}
