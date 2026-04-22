import { MetadataRoute } from "next";
import { listPublishedVehicles } from "@/lib/data";
import { buildAbsoluteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = [
    "/",
    "/inventory",
    "/sold",
    "/sell",
    "/selling-tips",
    "/pricing-advice",
    "/about",
    "/how-it-works",
    "/faq",
    "/contact",
    "/warehouse",
    "/terms",
    "/privacy",
    "/disclaimer"
  ].map((pathname) => ({
    url: buildAbsoluteUrl(pathname),
    lastModified: new Date(),
    changeFrequency: pathname === "/" || pathname === "/inventory" ? "daily" : "weekly",
    priority: pathname === "/" ? 1 : pathname === "/inventory" ? 0.9 : 0.7
  })) satisfies MetadataRoute.Sitemap;

  try {
    const { vehicles } = await listPublishedVehicles();
    const vehiclePages = vehicles.map((vehicle) => ({
      url: buildAbsoluteUrl(`/inventory/${vehicle.id}`),
      lastModified: vehicle.updatedAt ? new Date(vehicle.updatedAt) : vehicle.createdAt ? new Date(vehicle.createdAt) : new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8
    }));

    return [...staticPages, ...vehiclePages];
  } catch {
    return staticPages;
  }
}
