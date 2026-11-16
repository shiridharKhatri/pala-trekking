import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getPublishedExperiences, getPublishedTreks } from "@/lib/data/public";
import { Price } from "@/components/CurrencyProvider";
import { ScrollStage } from "@/components/ScrollStage";

export const metadata: Metadata = {
  title: "Optional experiences",
  description: "Optional destination and night-stay experiences you can add to a Pala Trekking trek at a fixed stated price.",
  alternates: { canonical: "/experiences" },
};

export default async function ExperiencesPage() {
  const [experiences, treks] = await Promise.all([getPublishedExperiences(), getPublishedTreks()]);
  return (
    <ScrollStage>
      <header className="page-head wrap">
        <ol className="crumbs"><li><Link href="/">Home</Link></li><li>Experiences</li></ol>
        <h1 className="display display--lg">Optional experiences</h1>
        <p className="lede">Places off your trekking route, for a night or two before or after the trail. Each one adds a fixed price, and none is required.</p>
      </header>
      <section className="wrap" style={{ paddingBottom: "var(--sc-section)" }}>
        {experiences.length === 0 && <p className="empty">No optional experiences are published yet.</p>}
        {experiences.map((e, i) => {
          const eligible = treks.filter((t) => e.eligibleTrekIds.includes(t.id));
          return (
            <article className="exp" key={e.id} aria-labelledby={`e-${e.slug}`}>
              <div className="exp__media" data-sc-reveal={i % 2 ? "left" : "right"} data-sc-reveal-at="0.08 0.45">
                {e.image && <Image src={e.image.src} alt={e.image.alt} width={1200} height={960} sizes="(max-width: 860px) 92vw, 50vw" quality={72} priority={i === 0} />}
              </div>
              <div className="exp__body" data-sc-in data-sc-stagger="60">
                <p className="label">{e.location} · {e.durationNights} {e.durationNights === 1 ? "night" : "nights"}</p>
                <h2 id={`e-${e.slug}`} className="display display--md"><Link href={`/experiences/${e.slug}`} style={{ textDecoration: "none" }}>{e.name}</Link></h2>
                <p className="prose" style={{ margin: 0 }}>{e.summary}</p>
                <p style={{ margin: 0 }}>Adds <strong><Price amount={e.price} /></strong> to the booking total.</p>
                {eligible.length > 0 && <p className="label" style={{ margin: 0 }}>Available with: {eligible.map((t) => t.name).join(", ")}</p>}
                <Link className="link-arrow" href={`/experiences/${e.slug}`}>Details</Link>
              </div>
            </article>
          );
        })}
      </section>
    </ScrollStage>
  );
}
