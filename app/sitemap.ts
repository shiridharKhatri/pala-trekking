import type { MetadataRoute } from "next";
import { getPublishedExperiences, getPublishedGuides, getPublishedPosts, getPublishedSlugs } from "@/lib/data/public";

const SITE = process.env.SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [treks, exps, guides, posts] = await Promise.all([getPublishedSlugs(), getPublishedExperiences(), getPublishedGuides(), getPublishedPosts()]);
  const fixed = ["", "/treks", "/gateways/kathmandu", "/gateways/pokhara", "/departures", "/experiences", "/compare", "/guides", "/blog", "/faqs", "/contact", "/about", "/terms", "/privacy", "/cancellation-policy"];
  return [
    ...fixed.map((p) => ({ url: `${SITE}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.6 })),
    ...treks.map((s) => ({ url: `${SITE}/treks/${s}`, changeFrequency: "weekly" as const, priority: 0.9 })),
    ...exps.map((e) => ({ url: `${SITE}/experiences/${e.slug}`, changeFrequency: "monthly" as const, priority: 0.5 })),
    ...guides.map((g) => ({ url: `${SITE}/guides/${g.slug}`, changeFrequency: "monthly" as const, priority: 0.5 })),
    ...posts.map((p) => ({ url: `${SITE}/blog/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
