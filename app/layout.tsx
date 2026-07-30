import "./globals.css";
import { Metadata } from "next";
import { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/react";
import { AppProviders } from "@/components/providers/app-providers";

const ROOT_TITLE = "CarNest | Buy and sell cars with confidence";
const ROOT_DESCRIPTION =
  "Helping sellers save time and buyers find cars they can trust. Browse quality vehicles, make offers, and request inspections on CarNest.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.carnest.au"),
  title: {
    default: ROOT_TITLE,
    template: "%s | CarNest"
  },
  description: ROOT_DESCRIPTION,
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: ROOT_TITLE,
    description: ROOT_DESCRIPTION,
    url: "https://www.carnest.au",
    siteName: "CarNest",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: ROOT_TITLE,
    description: ROOT_DESCRIPTION
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-shell font-sans text-ink antialiased">
        <AppProviders>{children}</AppProviders>
        {process.env.NODE_ENV === "production" ? <Analytics /> : null}
      </body>
    </html>
  );
}
