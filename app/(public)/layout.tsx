import { ReactNode } from "react";
import Navbar from "@/components/layout/navbar";
import { SiteFooter } from "@/components/layout/site-footer";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-transparent text-ink">
      <Navbar />
      <div className="flex flex-1 flex-col">
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </div>
    </div>
  );
}
