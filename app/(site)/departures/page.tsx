import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getPublicDepartures, getPublishedTreks } from "@/lib/data/public";
import { DepartureBoard } from "@/components/DepartureBoard";
import { AutoSubmit } from "@/components/AutoSubmit";
import { gatewayLabel } from "@/lib/format";
import { departureStatusLabel } from "@/lib/departures";
import { DEPARTURE_STATUSES } from "@/lib/types";
import { Pagination } from "@/components/Pagination";
import { parsePage, slicePage } from "@/lib/pagination";
import { BoardSkeleton } from "@/components/Skeletons";


export const metadata: Metadata = {
  title: "Departure board",
  description: "Upcoming Pala Trekking group departures with status and spaces remaining. Traveller details are never shown.",
  alternates: { canonical: "/departures" },
};

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default function DeparturesPage({ searchParams }: PageProps<"/departures">) {
  return (
    <div className="ground-paper" style={{ minHeight: "100vh" }}>
      <header className="page-head wrap">
        <ol className="crumbs"><li><Link href="/">Home</Link></li><li>Departures</li></ol>
        <h1 className="display display--lg">Departure board</h1>
        <p className="lede">Upcoming Pala Trekking groups only. We show how many people are going and how many spaces remain. Names, nationalities, photos and contact details are never published.</p>
      </header>
      <section className="wrap" style={{ paddingBottom: "var(--sc-section)" }}>
        <Suspense fallback={<BoardSkeleton />}>
          <Board searchParams={searchParams as Promise<SP>} />
        </Suspense>
      </section>
    </div>
  );
}

async function Board({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [deps, treks] = await Promise.all([getPublicDepartures(), getPublishedTreks()]);
  const f = { trek: one(sp.trek), gateway: one(sp.gateway), status: one(sp.status), month: one(sp.month) };
  const months = [...new Set(deps.map((d) => d.startDate.slice(0, 7)))];
  const list = deps.filter((d) =>
    (!f.trek || d.trekSlug === f.trek) && (!f.gateway || d.gateway === f.gateway) &&
    (!f.status || d.status === f.status) && (!f.month || d.startDate.startsWith(f.month)));
  return (
    <>
      <form method="get" action="/departures" className="grid-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))", marginBottom: "var(--sc-6)" }} aria-label="Filter departures">
        <AutoSubmit />
        <label className="field"><span>Trek</span>
          <select className="input" name="trek" defaultValue={f.trek}><option value="">All treks</option>{treks.map((t) => <option key={t.id} value={t.slug}>{t.name}</option>)}</select>
        </label>
        <label className="field"><span>Gateway</span>
          <select className="input" name="gateway" defaultValue={f.gateway}><option value="">Both</option>{Object.entries(gatewayLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
        <label className="field"><span>Month</span>
          <select className="input" name="month" defaultValue={f.month}><option value="">Any month</option>{months.map((m) => <option key={m} value={m}>{new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</option>)}</select>
        </label>
        <label className="field"><span>Status</span>
          <select className="input" name="status" defaultValue={f.status}><option value="">Any status</option>{DEPARTURE_STATUSES.map((s) => <option key={s} value={s}>{departureStatusLabel[s]}</option>)}</select>
        </label>
        <div data-nojs-submit><button className="btn btn--small" type="submit">Filter</button></div>
      </form>
      {(() => {
        const { items, p } = slicePage(list, parsePage(sp.page), 15);
        return (
          <>
            <DepartureBoard departures={items} caption="Upcoming Pala Trekking departures" />
            <Pagination p={p} path="/departures" params={sp} noun="departures" />
          </>
        );
      })()}
      <p className="label" style={{ marginTop: "var(--sc-5)" }}>Status: forming (needs more travellers), confirmed (will run), almost full, full, closed (no longer taking bookings).</p>
    </>
  );
}
