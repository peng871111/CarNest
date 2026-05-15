import Link from "next/link";
import { AdminShell } from "@/components/layout/admin-shell";

export const dynamic = "force-dynamic";

const ADMIN_HOME_LINKS = [
  {
    href: "/admin/vehicles",
    eyebrow: "Listings",
    title: "Vehicles",
    description: "Manage active listings, owners, storage contracts, and vehicle logs."
  },
  {
    href: "/admin/customers",
    eyebrow: "Owners",
    title: "Customers",
    description: "Open customer profiles, linked vehicles, and owner contact records."
  },
  {
    href: "/admin/warehouse-intake",
    eyebrow: "Contracts",
    title: "Storage Contracts",
    description: "Start new storage paperwork or continue existing signed and draft contracts."
  },
  {
    href: "/admin/user-support",
    eyebrow: "Support",
    title: "User Support",
    description: "Search users, review backend access, and handle admin support tasks."
  }
];

export default function AdminDashboardPage() {
  return (
    <AdminShell
      title="Admin Overview"
      description="Choose the workspace you want to open. Vehicles, customers, and storage contracts remain separated for faster daily staff workflow."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {ADMIN_HOME_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-[24px] border border-black/5 bg-white p-5 shadow-panel transition hover:border-[#C6A87D]/50 hover:shadow-lg"
          >
            <p className="text-xs uppercase tracking-[0.24em] text-bronze">{link.eyebrow}</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">{link.title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/62">{link.description}</p>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
