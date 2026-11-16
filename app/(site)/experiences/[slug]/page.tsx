import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getExperienceBySlug, getPublishedExperiences, getPublishedTreks } from "@/lib/data/public";
import { ChargeNote, Price } from "@/components/CurrencyProvider";
import { RichText } from "@/components/RichText";
import { date } from "@/lib/format";
import { DetailSkeleton } from "@/components/Skeletons";

export async function generateStaticParams() {
  return (await getPublishedExperiences()).map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: PageProps<"/experiences/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const e = await getExperienceBySlug(slug);
  return e ? { title: e.name, description: e.summary, alternates: { canonical: `/experiences/${e.slug}` } } : { title: "Experience not found" };
}

export default function ExperiencePage({ params }: PageProps<"/experiences/[slug]">) {
  return <Suspense fallback={<DetailSkeleton />}><Detail params={params} /></Suspense>;
}

async function Detail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [e, treks] = await Promise.all([getExperienceBySlug(slug), getPublishedTreks()]);
  if (!e) notFound();
  const eligible = treks.filter((t) => e.eligibleTrekIds.includes(t.id));
  return (
    <>
      <header className="page-head wrap">
        <ol className="crumbs"><li><Link href="/">Home</Link></li><li><Link href="/experiences">Experiences</Link></li><li>{e.name}</li></ol>
        <p className="label">{e.location} · {e.durationNights} {e.durationNights === 1 ? "night" : "nights"}</p>
        <h1 className="display display--lg">{e.name}</h1>
        <p className="lede">{e.summary}</p>
      </header>
      <section className="wrap" style={{ paddingBottom: "var(--sc-section)" }}>
        <div className="detail-grid">
          <div style={{ display: "grid", gap: "var(--sc-6)" }}>
            {e.image && (
              <figure style={{ margin: 0 }}>
                <Image src={e.image.src} alt={e.image.alt} width={1600} height={1067} sizes="(max-width: 1000px) 92vw, 60vw" quality={75} priority style={{ borderRadius: "var(--sc-r-lg)", width: "100%", height: "auto" }} />
              </figure>
            )}
            <RichText text={e.description} />
            <div className="two-col-list">
              <div><h2 className="label">Included</h2><ul>{e.inclusions.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div>
                <h2 className="label">Availability</h2>
                <p className="prose">
                  {e.availableFrom || e.availableTo ? <>Offered {e.availableFrom ? `from ${date(e.availableFrom)}` : ""} {e.availableTo ? `until ${date(e.availableTo)}` : ""}. </> : null}
                  {e.capacityNote}
                </p>
              </div>
            </div>
          </div>
          <aside className="book-panel">
            <div className="book-panel__price">
              <span className="label">Adds to your booking</span>
              <strong><Price amount={e.price} /></strong>
              <ChargeNote amount={e.price} prefix="Fixed price. " />
            </div>
            <p className="prose" style={{ margin: 0, fontSize: "var(--sc-t-sm)" }}>Add it while booking one of these treks. You can also skip it.</p>
            <ul>
              {eligible.map((t) => (
                <li key={t.id}><Link href={`/book/${t.slug}?addon=${e.id}`}><span>{t.name}</span><span aria-hidden="true">→</span></Link></li>
              ))}
            </ul>
          </aside>
        </div>
      </section>
    </>
  );
}
