import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getGuideBySlug, getPostsByGuide, getPublishedGuides, getPublishedTreks, getRegions } from "@/lib/data/public";
import { GuideAvatar } from "@/components/GuideCard";
import { TrekCard } from "@/components/TrekCard";
import { PostCard } from "@/components/PostCard";
import { RichText } from "@/components/RichText";
import { DetailSkeleton } from "@/components/Skeletons";

export async function generateStaticParams() {
  const guides = await getPublishedGuides();
  return guides.length ? guides.map((g) => ({ slug: g.slug })) : [{ slug: "_" }];
}

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const g = await getGuideBySlug(slug);
  return g ? { title: `${g.name}, ${g.role}`, description: g.bio.slice(0, 160), alternates: { canonical: `/guides/${g.slug}` } } : { title: "Guide not found" };
}

export default function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  return <Suspense fallback={<DetailSkeleton />}><Profile params={params} /></Suspense>;
}

async function Profile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = await getGuideBySlug(slug);
  if (!g) notFound();
  const [treks, regions, posts] = await Promise.all([getPublishedTreks(), getRegions(), getPostsByGuide(g.id)]);
  const led = treks.filter((t) => g.trekIds.includes(t.id));
  const banner = led.find((t) => t.heroImage) ?? null;
  const regionName = (id: string) => regions.find((r) => r.id === id)?.name;
  return (
    <>
      <header className="page-head wrap guide-head">
        <ol className="crumbs"><li><Link href="/">Home</Link></li><li><Link href="/guides">Guides</Link></li><li>{g.name}</li></ol>
        {banner?.heroImage && (
          <div className="guide-banner">
            <Image src={banner.heroImage.src} alt={banner.heroImage.alt} fill priority sizes="(max-width: 1200px) 92vw, 72rem" quality={72} style={{ objectFit: "cover" }} />
            <span className="guide-banner__caption">{banner.name}</span>
          </div>
        )}
        <div className="guide-head__row" data-banner={banner ? "" : undefined}>
          <GuideAvatar guide={g} size={128} />
          <div>
            <p className="label" style={{ margin: 0 }}>{g.role}</p>
            <h1 className="display display--lg" style={{ margin: "0.25rem 0 0" }}>{g.name}</h1>
          </div>
        </div>
        {g.sample && <p className="notice-box" style={{ marginTop: "var(--sc-5)" }}>Sample profile with placeholder text. Replace it with a real guide&apos;s details, with their consent, before launch.</p>}
      </header>
      <section className="wrap" style={{ paddingBottom: "var(--sc-section)" }}>
        <div className="detail-grid">
          <div style={{ display: "grid", gap: "var(--sc-7)" }}>
            {g.bio ? <RichText text={g.bio} /> : <p className="prose">This guide hasn&apos;t written an introduction yet.</p>}
            {led.length > 0 && (
              <div>
                <h2 className="display display--md">Treks {g.name.split(" ")[0]} leads</h2>
                <div className="catalogue__grid" style={{ marginTop: "var(--sc-5)" }}>
                  {led.map((t) => <TrekCard key={t.id} trek={t} regionName={regionName(t.regionId)} />)}
                </div>
              </div>
            )}
            {posts.length > 0 && (
              <div>
                <h2 className="display display--md">Writing</h2>
                <div className="post-grid" style={{ marginTop: "var(--sc-5)" }}>{posts.map((p) => <PostCard key={p.id} post={p} />)}</div>
              </div>
            )}
          </div>
          <aside className="book-panel guide-facts" aria-label="Guide facts">
            <dl>
              {g.yearsLeading != null && <div><dt>Leading treks</dt><dd>{g.yearsLeading} {g.yearsLeading === 1 ? "year" : "years"}</dd></div>}
              {g.languages.length > 0 && <div><dt>Languages</dt><dd>{g.languages.join(", ")}</dd></div>}
              {g.certifications.length > 0 && <div><dt>Licences and training</dt><dd><ul>{g.certifications.map((c) => <li key={c}>{c}</li>)}</ul></dd></div>}
            </dl>
            <p className="label" style={{ margin: 0 }}>Guides are assigned when a booking is confirmed, depending on availability. You can&apos;t yet request a specific guide online.</p>
          </aside>
        </div>
      </section>
    </>
  );
}
