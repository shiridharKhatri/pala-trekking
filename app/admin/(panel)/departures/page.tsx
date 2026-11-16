import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db, C as COLL } from "@/lib/db";
import { plain } from "@/lib/serialize";
import { departureState, departureStatusLabel, SEAT_HOLDING } from "@/lib/departures";
import type { Departure } from "@/lib/types";
import { addDays, date } from "@/lib/format";
import { ChartCard, Columns, Key, Meter, StatTile, C, num } from "@/components/admin/charts";
import { Pagination } from "@/components/Pagination";
import { parsePage, slicePage } from "@/lib/pagination";


export const metadata: Metadata = { title: "Departures" };

export default async function Departures({ searchParams }: PageProps<"/admin/departures">) {
  await requireAdmin(["admin"]);
  const sp = await searchParams;
  const view = sp.view === "past" ? "past" : "upcoming";
  const database = await db();
  const today = new Date().toISOString().slice(0, 10);

  const [deps, treks, held] = await Promise.all([
    database.collection(COLL.departures).find({}).sort({ startDate: 1 }).limit(500).toArray(),
    database.collection(COLL.treks).find({}, { projection: { name: 1, durationDays: 1 } }).toArray(),
    database.collection(COLL.bookings).aggregate<{ _id: string; n: number }>([
      { $match: { departureId: { $ne: null }, status: { $in: SEAT_HOLDING } } }, { $group: { _id: "$departureId", n: { $sum: "$travellers" } } },
    ]).toArray(),
  ]);
  const trekById = new Map(treks.map((t) => [t._id.toHexString(), { name: String(t.name), days: Number(t.durationDays) }]));
  const heldBy = new Map(held.map((h) => [String(h._id), h.n]));
  const all = plain<(Departure & { sample?: boolean })[]>(deps).map((d) => {
    const web = heldBy.get(d.id) ?? 0;
    const st = departureState(d, web, today);
    return { ...d, web, offline: d.offlineBooked ?? 0, ...st, trek: trekById.get(d.trekId)?.name ?? "Unknown trek", days: trekById.get(d.trekId)?.days ?? 1 };
  });
  const upcoming = all.filter((d) => d.startDate >= today);
  const past = all.filter((d) => d.startDate < today).reverse();
  const { items: list, p: pg } = slicePage(view === "past" ? past : upcoming, parsePage(sp.page), 20);

  const cap = upcoming.reduce((s, d) => s + d.capacity, 0);
  const sold = upcoming.reduce((s, d) => s + Math.min(d.capacity, d.web + d.offline), 0);
  const months = new Map<string, number>();
  for (const d of upcoming) { const k = d.startDate.slice(0, 7); months.set(k, (months.get(k) ?? 0) + d.web + d.offline); }
  const monthSeries = [...months.entries()].slice(0, 8).map(([k, v]) => ({ label: new Date(`${k}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }), value: v }));

  return (
    <>
      <header className="a-head">
        <div><h1>Departures</h1><p className="a-hint">Group dates, capacity and what the public board shows.</p></div>
        <Link className="a-btn a-btn--primary" href="/admin/departures/new">New departure</Link>
      </header>
      {sp.deleted && <p className="a-flash a-flash--ok" role="status">Departure deleted.</p>}

      <div className="a-statstrip">
        <StatTile label="Upcoming departures" value={num(upcoming.length)} />
        <StatTile label="Seats sold" value={`${num(sold)}`} suffix={`of ${num(cap)}`} note={cap ? `${Math.round((sold / cap) * 100)}% full` : undefined} />
        <StatTile label="Still forming" value={num(upcoming.filter((d) => d.status === "forming").length)} note="below minimum group" />
        <StatTile label="Almost full or full" value={num(upcoming.filter((d) => d.status === "almost-full" || d.status === "full").length)} />
      </div>

      {monthSeries.length > 0 && (
        <ChartCard title="Seats sold by departure month" sub="Website and offline travellers on upcoming departures" table={{ head: ["Month", "Seats sold"], rows: monthSeries.map((m) => [m.label, m.value]) }}>
          <Columns data={monthSeries} label="Seats sold by departure month" />
        </ChartCard>
      )}

      <nav className="a-chips" aria-label="View">
        <Link className="a-chip" href="/admin/departures" aria-current={view === "upcoming"}>Upcoming <b>{upcoming.length}</b></Link>
        <Link className="a-chip" href="/admin/departures?view=past" aria-current={view === "past"}>Past <b>{past.length}</b></Link>
      </nav>

      <section className="a-card">
        <div className="a-chart__head" style={{ marginBottom: "0.5rem" }}><h2 style={{ margin: 0, fontSize: "1rem" }}>{view === "past" ? "Past departures" : "Upcoming departures"}</h2><div className="a-legend"><Key color={C.blue}>Website</Key><Key color={C.orange}>Offline</Key></div></div>
        <div className="a-scroll">
          <table className="a-table">
            <thead><tr><th>Trek</th><th>Dates</th><th>Seats</th><th className="a-num">Taken</th><th>Status</th><th>Public</th></tr></thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id}>
                  <td><Link href={`/admin/departures/${d.id}`}><b>{d.trek}</b></Link>{d.sample && <span className="a-tag a-tag--warn">sample</span>}</td>
                  <td>{date(d.startDate)} to {date(addDays(d.startDate, d.days - 1), { year: undefined })}</td>
                  <td className="a-row-meter"><Meter web={d.web} offline={d.offline} capacity={d.capacity} /></td>
                  <td className="a-num">{d.web + d.offline}/{d.capacity}</td>
                  <td><span className={`a-status a-status--dep-${d.status}`}>{departureStatusLabel[d.status]}{d.statusOverride ? " (manual)" : ""}</span></td>
                  <td>{d.isPublic ? "Yes" : "Hidden"}</td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={6}>{view === "past" ? "No past departures." : "No upcoming departures. Create one to show it on the public board."}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <Pagination p={pg} path="/admin/departures" params={sp} noun="departures" variant="admin" />
    </>
  );
}
