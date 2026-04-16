import "./globals.css";
import { Metadata } from "next";
import { ReactNode } from "react";
import { AppProviders } from "@/components/providers/app-providers";
import { getSiteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "CarNest | Buy and sell cars with confidence",
    template: "%s | CarNest"
  },
  description:
    "Helping sellers save time and buyers find cars they can trust. Browse quality vehicles, make offers, and request inspections on CarNest."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-shell font-sans text-ink antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
