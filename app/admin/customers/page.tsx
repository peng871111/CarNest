import { VehicleWorkspaceScreen } from "@/components/admin/vehicle-workspace-screen";

export default async function AdminCustomersPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const queryValue = resolvedParams.query;
  const customerIdValue = resolvedParams.customerId;
  const initialCustomerSearch =
    (typeof queryValue === "string" ? queryValue : Array.isArray(queryValue) ? queryValue[0] : "")
    || (typeof customerIdValue === "string" ? customerIdValue : Array.isArray(customerIdValue) ? customerIdValue[0] : "")
    || "";

  return (
    <VehicleWorkspaceScreen
      title="Customers"
      description="Find active customer profiles, edit linked owners, and open related vehicles without touching the public website."
      defaultView="customers"
      initialCustomerSearch={initialCustomerSearch}
    />
  );
}
