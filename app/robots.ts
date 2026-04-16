import { MetadataRoute } from "next";
import { buildAbsoluteUrl, getRobotsRules } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: getRobotsRules(),
    sitemap: buildAbsoluteUrl("/sitemap.xml")
  };
}
