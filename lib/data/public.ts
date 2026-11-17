import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db, C } from "../db";
import { plain, oid } from "../serialize";
import { departureState, SEAT_HOLDING } from "../departures";
import type { Advisory, ContentPage, Departure, Experience, Faq, Gateway, PublicDeparture, Region, SiteSettings, StayPoint, Trek, TrekCard, Guide, Post } from "../types";
import { DEFAULT_SETTINGS } from "../defaults";

export const TAGS = {
  catalogue: "catalogue",
  departures: "departures",
  content: "content",
  settings: "settings",
  advisories: "advisories",
  guides: "guides",
  posts: "posts",
} as const;

const CARD_FIELDS = {
  slug: 1, name: 1, gateway: 1, regionId: 1, durationDays: 1, difficulty: 1, maxAltitudeM: 1,
  basePrice: 1, summary: 1, heroImage: 1, featured: 1, bestSeason: 1, walkingHoursMin: 1,
  walkingHoursMax: 1, trailhead: 1, destination: 1, sample: 1,
};

export async function getSettings(): Promise<SiteSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.settings);
  const d = await (await db()).collection(C.settings).findOne({ _id: "site" as never });
  const s = d ? plain<Partial<SiteSettings>>(d) : {};
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    currency: { ...DEFAULT_SETTINGS.currency, ...(s.currency ?? {}) },
    home: { ...DEFAULT_SETTINGS.home, ...(s.home ?? {}) },
    company: { ...DEFAULT_SETTINGS.company, ...(s.company ?? {}) },
  };
}

export async function getGateways(): Promise<Gateway[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalogue);
  const rows = await (await db()).collection(C.gateways).find().sort({ order: 1 }).toArray();
  return plain<Gateway[]>(rows);
}

export async function getRegions(): Promise<Region[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalogue);
  const rows = await (await db()).collection(C.regions).find({ status: "published" }).sort({ order: 1 }).toArray();
  return plain<Region[]>(rows);
}

export async function getPublishedTreks(): Promise<TrekCard[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalogue);
  const rows = await (await db()).collection(C.treks)
    .find({ status: "published" }, { projection: CARD_FIELDS })
    .sort({ featured: -1, durationDays: 1 })
    .toArray();
  return plain<TrekCard[]>(rows);
}

export async function getPublishedSlugs(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalogue);
  const rows = await (await db()).collection(C.treks).find({ status: "published" }, { projection: { slug: 1 } }).toArray();
  return rows.map((r) => String(r.slug));
}

export async function getTrekBySlug(slug: string): Promise<Trek | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalogue);
  const d = await (await db()).collection(C.treks).findOne({ slug, status: "published" });
  return d ? plain<Trek>(d) : null;
}

export async function getTreksBySlugs(slugs: string[]): Promise<Trek[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalogue);
  const rows = await (await db()).collection(C.treks).find({ slug: { $in: slugs.slice(0, 3) }, status: "published" }).toArray();
  const list = plain<Trek[]>(rows);
  return slugs.map((s) => list.find((t) => t.slug === s)).filter(Boolean) as Trek[];
}

export async function getStayPoints(ids: string[]): Promise<StayPoint[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalogue);
  const oids = ids.map(oid).filter(Boolean);
  if (!oids.length) return [];
  const rows = await (await db()).collection(C.stayPoints).find({ _id: { $in: oids as never[] } }).toArray();
  return plain<StayPoint[]>(rows);
}

export async function getPublishedExperiences(): Promise<Experience[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalogue);
  const rows = await (await db()).collection(C.experiences).find({ status: "published" }).sort({ price: 1 }).toArray();
  return plain<Experience[]>(rows);
}

export async function getExperiencesForTrek(trekId: string): Promise<Experience[]> {
  const all = await getPublishedExperiences();
  return all.filter((e) => e.eligibleTrekIds.includes(trekId));
}

export async function getExperienceBySlug(slug: string): Promise<Experience | null> {
  const all = await getPublishedExperiences();
  return all.find((e) => e.slug === slug) ?? null;
}

/** Public departures: anonymous counts only, never customer data (FR 10). */
export async function getPublicDepartures(): Promise<PublicDeparture[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.departures);
  // Evaluated inside the cache scope: 'today' is at most one cache lifetime stale.
  const todayIso = new Date().toISOString().slice(0, 10);
  const database = await db();
  const deps = plain<Departure[]>(
    await database.collection(C.departures)
      .find({ isPublic: true, startDate: { $gte: todayIso } }, { projection: { notes: 0 } })
      .sort({ startDate: 1 }).limit(200).toArray(),
  );
  if (!deps.length) return [];
  const treks = plain<TrekCard[]>(
    await database.collection(C.treks).find({ status: "published" }, { projection: CARD_FIELDS }).toArray(),
  );
  const counts = await database.collection(C.bookings).aggregate<{ _id: string; n: number }>([
    { $match: { departureId: { $in: deps.map((d) => d.id) }, status: { $in: SEAT_HOLDING } } },
    { $group: { _id: "$departureId", n: { $sum: "$travellers" } } },
  ]).toArray();
  const byDep = new Map(counts.map((c) => [String(c._id), c.n]));
  const out: PublicDeparture[] = [];
  for (const d of deps) {
    const t = treks.find((x) => x.id === d.trekId);
    if (!t) continue; // unpublished trek: never shown
    const st = departureState(d, byDep.get(d.id) ?? 0, todayIso);
    out.push({
      id: d.id, trekId: t.id, trekSlug: t.slug, trekName: t.name, gateway: t.gateway,
      durationDays: t.durationDays, startDate: d.startDate, status: st.status,
      spacesLeft: st.spacesLeft, travellerCount: st.booked, sample: d.sample,
    });
  }
  return out;
}

export async function getActiveAdvisories(): Promise<Advisory[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.advisories);
  const rows = await (await db()).collection(C.advisories).find({ active: true }).sort({ updatedAt: -1 }).toArray();
  return plain<Advisory[]>(rows);
}

export async function getPage(slug: string): Promise<ContentPage | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.content);
  const d = await (await db()).collection(C.pages).findOne({ slug });
  return d ? plain<ContentPage>(d) : null;
}

export async function getFaqs(): Promise<Faq[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.content);
  const rows = await (await db()).collection(C.faqs).find({ published: true }).sort({ category: 1, order: 1 }).toArray();
  return plain<Faq[]>(rows);
}


// ------------------------------------------------------------ guides ----
/** Guide profiles: published AND consent recorded, checked again here. */
export async function getPublishedGuides(): Promise<Guide[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.guides);
  const rows = await (await db()).collection(C.guides).find({ status: "published", consent: true }).sort({ name: 1 }).toArray();
  return plain<Guide[]>(rows);
}

export async function getGuideBySlug(slug: string): Promise<Guide | null> {
  return (await getPublishedGuides()).find((g) => g.slug === slug) ?? null;
}

export async function getGuidesForTrek(trekId: string): Promise<Guide[]> {
  return (await getPublishedGuides()).filter((g) => g.trekIds.includes(trekId));
}

// -------------------------------------------------------------- blog ----
export async function getPublishedPosts(): Promise<Post[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.posts);
  const rows = await (await db()).collection(C.posts).find({ status: "published" }).sort({ publishedAt: -1, title: 1 }).toArray();
  return plain<Post[]>(rows);
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  return (await getPublishedPosts()).find((p) => p.slug === slug) ?? null;
}

export async function getPostsForTrek(trekId: string): Promise<Post[]> {
  return (await getPublishedPosts()).filter((p) => p.relatedTrekIds.includes(trekId));
}

export async function getPostsByGuide(guideId: string): Promise<Post[]> {
  return (await getPublishedPosts()).filter((p) => p.authorGuideId === guideId);
}
