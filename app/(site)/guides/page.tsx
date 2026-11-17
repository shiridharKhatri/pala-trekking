import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getPublishedGuides, getPublishedTreks } from "@/lib/data/public";
import { GuideCard } from "@/components/GuideCard";
import { TableSkeleton } from "@/components/Skeletons";

export const metadata: Metadata = {
  title: "Our guides",
  description: "The Pala Trekking guides who lead each trek: experience, languages, licences and the routes they know.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  return (
    <>
      <header className="page-head wrap">
        <ol className="crumbs"><li><Link href="/">Home</Link></li><li>Guides</li></ol>
        <h1 className="display display--lg">Our guides</h1>
        <p className="lede">The people who walk with you. Every profile is published with that guide&apos;s consent.</p>
      </header>
      <section className="wrap" style={{ paddingBottom: "var(--sc-section)" }}>
        <Suspense fallback={<TableSkeleton rows={4} cols={2} label="Loading guides" />}>
          <List />
        </Suspense>
      </section>
    </>
  );
}

async function List() {
  const [guides, treks] = await Promise.all([getPublishedGuides(), getPublishedTreks()]);
  if (!guides.length) return <p className="empty">Guide profiles are on their way. Each one is published only with that guide&apos;s consent.</p>;
  return (
    <div className="guide-grid">
      {guides.map((g) => (
        <GuideCard key={g.id} guide={g} treks={treks.filter((t) => g.trekIds.includes(t.id))} />
      ))}
    </div>
  );
}
