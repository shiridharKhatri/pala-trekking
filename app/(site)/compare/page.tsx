import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { getPublishedExperiences, getPublishedTreks, getRegions, getSettings, getTreksBySlugs } from "@/lib/data/public";
import { Price } from "@/components/CurrencyProvider";
import { CompareSync } from "@/components/CompareSync";
import { difficultyLabel, feet, gatewayLabel, metres } from "@/lib/format";
import { CompareSkeleton } from "@/components/Skeletons";
import { ProfileOverlay } from "@/components/ProfileOverlay";

export const metadata: Metadata = {
  title: "Compare treks",
  description: "Compare up to three Pala Trekking treks side by side: duration, price, difficulty, altitude, season, walking time, accommodation and optional experiences.",
  alternates: { canonical: "/compare" },
};

type SP = Record<string, string | string[] | undefined>;

export default function ComparePage({ searchParams }: PageProps<"/compare">) {
  return (
    <>
      <header className="page-head wrap">
        <ol className="crumbs"><li><Link href="/">Home</Link></li><li><Link href="/treks">Treks</Link></li><li>Compare</li></ol>
        <h1 className="display display--lg">Compare treks</h1>
        <p className="lede">Choose two or three Pala Trekking treks. Every value comes from the same structured fields.</p>
      </header>
      <section className="wrap" style={{ paddingBottom: "var(--sc-section)" }}>
        <Suspense fallback={<CompareSkeleton />}>
          <Comparison searchParams={searchParams as Promise<SP>} />
        </Suspense>
      </section>
    </>
  );
}

async function Comparison({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.treks) ? sp.treks.join(",") : sp.treks ?? "";
  const slugs = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 3);
  const [selected, all, regions, experiences, settings] = await Promise.all([
    getTreksBySlugs(slugs), getPublishedTreks(), getRegions(), getPublishedExperiences(), getSettings(),
  ]);
  const regionName = (id: string) => regions.find((r) => r.id === id)?.name ?? "";

  const rows: { label: string; cell: (t: (typeof selected)[number]) => React.ReactNode }[] = [
    { label: "Gateway", cell: (t) => gatewayLabel[t.gateway] },
    { label: "Starting point", cell: (t) => t.trailhead },
    { label: "Region", cell: (t) => regionName(t.regionId) },
    { label: "Duration", cell: (t) => `${t.durationDays} days` },
    { label: "Price per person", cell: (t) => <><Price amount={t.basePrice} /> <span className="label">({settings.currency.base} base)</span></> },
    { label: "Difficulty", cell: (t) => difficultyLabel[t.difficulty] },
    { label: "Maximum altitude", cell: (t) => <>{metres(t.maxAltitudeM)} <span className="label">{feet(t.maxAltitudeM)}</span></> },
    { label: "Best season", cell: (t) => t.bestSeason },
    { label: "Daily walking", cell: (t) => `${t.walkingHoursMin} to ${t.walkingHoursMax} hours` },
    { label: "Accommodation", cell: (t) => t.accommodation },
    { label: "Meals", cell: (t) => t.meals },
    { label: "Optional experiences", cell: (t) => {
      const ex = experiences.filter((e) => e.eligibleTrekIds.includes(t.id));
      return ex.length ? <ul style={{ margin: 0, paddingLeft: "1em" }}>{ex.map((e) => <li key={e.id}><Link href={`/experiences/${e.slug}`}>{e.name}</Link></li>)}</ul> : "None";
    } },
  ];

  return (
    <div style={{ display: "grid", gap: "var(--sc-7)", gridTemplateColumns: "minmax(0, 1fr)" }}>
      <CompareSync slugs={selected.map((t) => t.slug)} />
      <form method="get" action="/compare" className="notice-box" style={{ display: "grid", gap: "var(--sc-4)" }}>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, marginBottom: "0.75rem", color: "var(--sc-ink)" }}>Treks to compare (up to three)</legend>
          <div className="seg">
            {all.map((t) => (
              <label key={t.id}><input type="checkbox" name="treks" value={t.slug} defaultChecked={slugs.includes(t.slug)} /><span>{t.name}</span></label>
            ))}
          </div>
        </fieldset>
        <div><button className="btn btn--small" type="submit">Update comparison</button></div>
      </form>

      {selected.length < 2 ? (
        <p className="empty">Select at least two treks to see them side by side.{raw.split(",").filter(Boolean).length > 3 && " Only the first three are compared."}</p>
      ) : (
        <>
        <section aria-labelledby="overlay-title" style={{ display: "grid", gap: "var(--sc-4)", minWidth: 0 }}>
          <h2 id="overlay-title" className="display display--sm" style={{ margin: 0 }}>Where you sleep, night by night</h2>
          <ProfileOverlay
            series={selected.map((t) => ({
              slug: t.slug,
              name: t.name,
              points: [...t.itinerary].sort((a, b) => a.day - b.day)
                .filter((d) => d.elevationM != null)
                .map((d) => ({ day: d.day, elevationM: d.elevationM as number, place: d.destination })),
            }))}
          />
        </section>
        <p className="compare-hint" aria-hidden="true">Swipe sideways to see all {selected.length} treks →</p>
        <div className="scroll-x" tabIndex={0} aria-label="Comparison table, scrolls sideways on small screens">
          <table className="compare-table" data-cols={selected.length}>
            <caption className="vh">Side-by-side comparison of {selected.map((t) => t.name).join(", ")}</caption>
            <colgroup>
              <col className="compare-table__labelcol" />
              {selected.map((t) => <col key={t.id} />)}
            </colgroup>
            <thead>
              <tr>
                <td className="compare-table__corner" />
                {selected.map((t) => {
                  const rest = selected.filter((x) => x.id !== t.id).map((x) => x.slug).join(",");
                  return (
                    <th key={t.id} scope="col">
                      <Link href={`/treks/${t.slug}`} className="compare-table__head">
                        {t.heroImage && <Image src={t.heroImage.src} alt="" width={480} height={360} sizes="(max-width: 760px) 70vw, 22rem" quality={60} />}
                        <span className="trek-card__title">{t.name}</span>
                      </Link>
                      <Link className="compare-table__remove" href={rest ? `/compare?treks=${rest}` : "/compare"}>Remove<span className="vh"> {t.name} from the comparison</span></Link>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  {selected.map((t) => <td key={t.id}>{r.cell(t)}</td>)}
                </tr>
              ))}
              <tr className="compare-table__actionrow">
                <th scope="row"><span className="vh">Actions</span></th>
                {selected.map((t) => (
                  <td key={t.id}>
                    <div className="compare-table__actions">
                      <Link className="btn btn--small" href={`/book/${t.slug}`}>Request booking<span className="vh"> for {t.name}</span></Link>
                      <Link className="link-arrow" href={`/treks/${t.slug}`}>View details<span className="vh"> of {t.name}</span></Link>
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
