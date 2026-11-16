import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getGateways, getPublishedTreks, getRegions } from "@/lib/data/public";
import { TrekCard } from "@/components/TrekCard";
import { AutoSubmit } from "@/components/AutoSubmit";
import { DIFFICULTIES } from "@/lib/types";
import { difficultyLabel } from "@/lib/format";
import { Pagination } from "@/components/Pagination";
import { parsePage, slicePage } from "@/lib/pagination";
import { CatalogueSkeleton } from "@/components/Skeletons";


export const metadata: Metadata = {
  title: "Treks in Nepal",
  description: "Browse and filter Pala Trekking treks by gateway city, region, duration, difficulty and price.",
  alternates: { canonical: "/treks" },
};

const DURATIONS = [
  { v: "short", label: "Up to 7 days", test: (d: number) => d <= 7 },
  { v: "mid", label: "8 to 12 days", test: (d: number) => d >= 8 && d <= 12 },
  { v: "long", label: "13 days or more", test: (d: number) => d >= 13 },
];

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default function TreksPage({ searchParams }: PageProps<"/treks">) {
  return (
    <>
      <header className="page-head wrap">
        <ol className="crumbs"><li><Link href="/">Home</Link></li><li>Treks</li></ol>
        <h1 className="display display--lg">Treks in Nepal</h1>
        <p className="lede">Every trek starts from Kathmandu or Pokhara. Filter by what matters to you, then compare up to three.</p>
      </header>
      <section className="wrap" style={{ paddingBottom: "var(--sc-section)" }}>
        <Suspense fallback={<CatalogueSkeleton />}>
          <Catalogue searchParams={searchParams as Promise<SP>} />
        </Suspense>
      </section>
    </>
  );
}

async function Catalogue({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [treks, regions, gateways] = await Promise.all([getPublishedTreks(), getRegions(), getGateways()]);
  const f = {
    gateway: one(sp.gateway), region: one(sp.region), duration: one(sp.duration),
    difficulty: one(sp.difficulty), min: Number(one(sp.min)) || 0, max: Number(one(sp.max)) || 0, q: one(sp.q).trim().toLowerCase(),
  };
  const region = regions.find((r) => r.slug === f.region);
  const dur = DURATIONS.find((d) => d.v === f.duration);
  const results = treks.filter((t) =>
    (!f.gateway || t.gateway === f.gateway) &&
    (!region || t.regionId === region.id) &&
    (!dur || dur.test(t.durationDays)) &&
    (!f.difficulty || t.difficulty === f.difficulty) &&
    (!f.min || t.basePrice >= f.min) &&
    (!f.max || t.basePrice <= f.max) &&
    (!f.q || `${t.name} ${t.summary} ${t.destination} ${t.trailhead}`.toLowerCase().includes(f.q)),
  );
  const active = Object.values(f).some(Boolean);
  const { items: pageItems, p: pg } = slicePage(results, parsePage(sp.page), 9);
  const regionName = (id: string) => regions.find((r) => r.id === id)?.name;
  const prices = treks.map((t) => t.basePrice);

  return (
    <div className="catalogue">
      <details className="filters-panel" open>
        <summary className="btn btn--ghost btn--small">Filters</summary>
        <form className="filters" method="get" action="/treks" role="search" aria-label="Filter treks">
          <AutoSubmit />
          <label className="field">
            <span>Search</span>
            <input className="input" type="search" name="q" defaultValue={one(sp.q)} placeholder="Trek or place" />
          </label>
          <fieldset>
            <legend>Gateway</legend>
            <div className="seg">
              <label><input type="radio" name="gateway" value="" defaultChecked={!f.gateway} /><span>Any</span></label>
              {gateways.map((g) => (
                <label key={g.id}><input type="radio" name="gateway" value={g.slug} defaultChecked={f.gateway === g.slug} /><span>{g.name}</span></label>
              ))}
            </div>
          </fieldset>
          <label className="field">
            <span>Region</span>
            <select className="input" name="region" defaultValue={f.region}>
              <option value="">Any region</option>
              {regions.map((r) => <option key={r.id} value={r.slug}>{r.name}</option>)}
            </select>
          </label>
          <fieldset>
            <legend>Duration</legend>
            <div className="seg">
              <label><input type="radio" name="duration" value="" defaultChecked={!f.duration} /><span>Any</span></label>
              {DURATIONS.map((d) => (
                <label key={d.v}><input type="radio" name="duration" value={d.v} defaultChecked={f.duration === d.v} /><span>{d.label}</span></label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Difficulty</legend>
            <div className="seg">
              <label><input type="radio" name="difficulty" value="" defaultChecked={!f.difficulty} /><span>Any</span></label>
              {DIFFICULTIES.map((d) => (
                <label key={d}><input type="radio" name="difficulty" value={d} defaultChecked={f.difficulty === d} /><span>{difficultyLabel[d]}</span></label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Price per person (USD base)</legend>
            <div className="grid-2">
              <label className="field"><small>Min</small><input className="input" type="number" name="min" min={0} step={50} inputMode="numeric" defaultValue={f.min || ""} placeholder={prices.length ? String(Math.min(...prices)) : ""} /></label>
              <label className="field"><small>Max</small><input className="input" type="number" name="max" min={0} step={50} inputMode="numeric" defaultValue={f.max || ""} placeholder={prices.length ? String(Math.max(...prices)) : ""} /></label>
            </div>
          </fieldset>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button className="btn btn--small" type="submit">Apply filters</button>
            {active && <Link className="btn btn--ghost btn--small" href="/treks">Clear</Link>}
          </div>
        </form>
      </details>
      <div>
        <div className="result-bar">
          <p className="label" role="status" aria-live="polite" style={{ margin: 0 }}>
            {results.length} {results.length === 1 ? "trek" : "treks"}{active ? " match your filters" : ""}
          </p>
        </div>
        {results.length ? (
          <>
          <div className="catalogue__grid">
            {pageItems.map((t, i) => <TrekCard key={t.id} trek={t} regionName={regionName(t.regionId)} priority={i < 2 && pg.page === 1} />)}
          </div>
          <Pagination p={pg} path="/treks" params={sp} noun="treks" />
          </>
        ) : (
          <div className="empty">
            <p>No treks match these filters.</p>
            <Link className="link-arrow" href="/treks">Show all treks</Link>
          </div>
        )}
      </div>
    </div>
  );
}
