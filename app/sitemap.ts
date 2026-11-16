import type { MetadataRoute } from "next";
import { getPublishedExperiences, getPublishedSlugs } from "@/lib/data/public";

const SITE = process.env.SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [treks, exps] = await Promise.all([getPublishedSlugs(), getPublishedExperiences()]);
  const fixed = ["", "/treks", "/gateways/kathmandu", "/gateways/pokhara", "/departures", "/experiences", "/compare", "/faqs", "/contact", "/about", "/terms", "/privacy", "/cancellation-policy"];
  return [
    ...fixed.map((p) => ({ url: `${SITE}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.6 })),
    ...treks.map((s) => ({ url: `${SITE}/treks/${s}`, changeFrequency: "weekly" as const, priority: 0.9 })),
    ...exps.map((e) => ({ url: `${SITE}/experiences/${e.slug}`, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
