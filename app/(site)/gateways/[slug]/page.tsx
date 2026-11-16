import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getGateways, getPublishedTreks, getRegions } from "@/lib/data/public";
import { TrekCard } from "@/components/TrekCard";
import { ScrollStage } from "@/components/ScrollStage";
import { metres } from "@/lib/format";
import { HeroSkeleton } from "@/components/Skeletons";

export function generateStaticParams() {
  return [{ slug: "kathmandu" }, { slug: "pokhara" }];
}

export async function generateMetadata({ params }: PageProps<"/gateways/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const g = (await getGateways()).find((x) => x.slug === slug);
  if (!g) return { title: "Gateway not found" };
  return { title: `Treks from ${g.name}`, description: g.summary, alternates: { canonical: `/gateways/${g.slug}` } };
}

export default function GatewayPage({ params }: PageProps<"/gateways/[slug]">) {
  return <Suspense fallback={<HeroSkeleton height="72svh" />}><Gateway params={params} /></Suspense>;
}

async function Gateway({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [gateways, regions, treks] = await Promise.all([getGateways(), getRegions(), getPublishedTreks()]);
  const g = gateways.find((x) => x.slug === slug);
  if (!g) notFound();
  const gRegions = regions.filter((r) => r.gateway === g.slug);
  return (
    <ScrollStage>
      <section className="trek-hero" data-rail-hide style={{ height: "72svh" }} aria-labelledby="gw-title" data-alt={g.elevationM ?? undefined} data-alt-label={g.name}>
        {g.image && <div className="trek-hero__img" data-sc-parallax="1.2"><Image src={g.image.src} alt={g.image.alt} fill priority sizes="100vw" quality={78} style={{ objectFit: "cover" }} /></div>}
        <div className="trek-hero__scrim" />
        {g.image?.credit && <p className="trek-hero__credit">Photo: {g.image.credit}</p>}
        <div className="trek-hero__copy">
          <ol className="crumbs"><li><Link href="/">Home</Link></li><li><Link href="/treks">Treks</Link></li><li>{g.name}</li></ol>
          <h1 id="gw-title" className="display display--xl">Treks from {g.name}</h1>
          <p className="lede" style={{ color: "#e4e7e1" }}>{g.summary}{g.elevationM != null && <> The city sits at about {metres(g.elevationM)}.</>}</p>
        </div>
      </section>
      {gRegions.map((r) => {
        const list = treks.filter((t) => t.regionId === r.id);
        return (
          <section key={r.id} className="wrap section--tight" aria-labelledby={`r-${r.slug}`}>
            <div className="split-head" data-sc-in data-sc-stagger="60">
              <div>
                <h2 id={`r-${r.slug}`} className="display display--md">{r.name}</h2>
                <p className="lede" style={{ marginTop: "0.5rem" }}>{r.summary}</p>
              </div>
              <Link className="link-arrow" href={`/treks?region=${r.slug}`}>Filter this region</Link>
            </div>
            {list.length ? (
              <div className="catalogue__grid">{list.map((t) => <TrekCard key={t.id} trek={t} regionName={r.name} />)}</div>
            ) : <p className="empty">No treks are published in this region yet.</p>}
          </section>
        );
      })}
      <div className="section--tight" />
    </ScrollStage>
  );
}
