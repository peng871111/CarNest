import { SellFlow } from "@/components/forms/sell-flow";
import { SellerShell } from "@/components/layout/seller-shell";

export default function SellerNewVehiclePage() {
  return (
    <SellerShell
      title="Add Vehicle"
      description="Start a new CarNest listing directly from your workspace."
      allowedRoles={["seller", "buyer"]}
    >
      <SellFlow />
    </SellerShell>
  );
}
