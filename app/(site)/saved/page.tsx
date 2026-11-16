import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getPublishedTreks, getRegions } from "@/lib/data/public";
import { TrekCard } from "@/components/TrekCard";
import { SavedList } from "@/components/Saved";
import { TrekCardSkeleton } from "@/components/Skeletons";

export const metadata: Metadata = { title: "Saved treks", robots: { index: false } };

export default function SavedPage() {
  return (
    <>
      <header className="page-head wrap">
        <ol className="crumbs"><li><Link href="/">Home</Link></li><li>Saved</li></ol>
        <h1 className="display display--lg">Saved treks</h1>
      </header>
      <section className="wrap" style={{ paddingBottom: "var(--sc-section)", display: "grid", gap: "var(--sc-5)" }}>
        <Suspense fallback={<div className="catalogue__grid">{Array.from({ length: 3 }, (_, i) => <TrekCardSkeleton key={i} />)}</div>}>
          <Saved />
        </Suspense>
      </section>
    </>
  );
}

async function Saved() {
  const [treks, regions] = await Promise.all([getPublishedTreks(), getRegions()]);
  return (
    <SavedList slugs={treks.map((t) => t.slug)}>
      {treks.map((t) => (
        <div key={t.id} data-saved-slug={t.slug}>
          <TrekCard trek={t} regionName={regions.find((r) => r.id === t.regionId)?.name} />
        </div>
      ))}
    </SavedList>
  );
}
