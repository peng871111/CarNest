import { ReactNode } from "react";
import Navbar from "@/components/layout/navbar";
import { SiteFooter } from "@/components/layout/site-footer";

export default function PublicLayout({ children }: { children: ReactNode }) {
return (
  <div className="flex min-h-screen flex-col bg-transparent text-ink">
    <Navbar />

    <main className="flex-1">
      <div className="mx-auto max-w-7xl px-6 py-10">
        {children}
      </div>
    </main>

    <SiteFooter />
  </div>
);
}
