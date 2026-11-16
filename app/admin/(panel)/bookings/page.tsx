import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db, C } from "@/lib/db";
import { plain } from "@/lib/serialize";
import { BOOKING_STATUSES, type Booking } from "@/lib/types";
import { date, dateTime } from "@/lib/format";
import { STATUS_COLOR, StatTile, money, num } from "@/components/admin/charts";
import { Pagination } from "@/components/Pagination";
import { paginate, parsePage } from "@/lib/pagination";

const PAGE_SIZE = 25;

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default async function Bookings({ searchParams }: PageProps<"/admin/bookings">) {
  await requireAdmin(["admin"]);
  const sp = (await searchParams) as SP;
  const database = await db();
  const coll = database.collection(C.bookings);

  const treks = await database.collection(C.treks).find({}, { projection: { name: 1 } }).sort({ name: 1 }).toArray();
  const status = BOOKING_STATUSES.includes(one(sp.status) as never) ? one(sp.status) : "";
  const source = ["website", "offline"].includes(one(sp.source)) ? one(sp.source) : "";
  const trek = treks.some((t) => t._id.toHexString() === one(sp.trek)) ? one(sp.trek) : "";
  const q = one(sp.q).trim().slice(0, 100);

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (source) filter.source = source;
  if (trek) filter.trekId = trek;
  if (q) { const rx = new RegExp(esc(q), "i"); filter.$or = [{ ref: rx }, { "lead.name": rx }, { "lead.email": rx }, { trekName: rx }]; }

  // Counts for the chips respect every filter except the status itself.
  const { status: _s, ...rest } = filter;
  const total = await coll.countDocuments(filter);
  const pg = paginate(total, parsePage(sp.page), PAGE_SIZE);
  const [rows, grouped] = await Promise.all([
    coll.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(PAGE_SIZE).toArray(),
    coll.aggregate<{ _id: string; n: number; value: number }>([{ $match: rest }, { $group: { _id: "$status", n: { $sum: 1 }, value: { $sum: "$total" } } }]).toArray(),
  ]);
  void _s;
  const list = plain<Booking[]>(rows);
  const counts = Object.fromEntries(grouped.map((g) => [g._id, g.n]));
  const totalAll = grouped.reduce((s, g) => s + g.n, 0);
  const openValue = grouped.filter((g) => ["requested", "reviewing", "confirmed"].includes(g._id)).reduce((s, g) => s + g.value, 0);
  const base = list[0]?.currency ?? "USD";
  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams(); const m = { status, source, trek, q, ...over };
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, v);
    const s = p.toString(); return s ? `?${s}` : "";
  };

  return (
    <>
      <header className="a-head">
        <div><h1>Bookings</h1><p className="a-hint">Requests from the website and bookings recorded by the team.</p></div>
        <div className="a-pagehead-tools">
          <a className="a-btn" href={`/admin/bookings/export${qs({})}`} download>Export CSV</a>
          <Link className="a-btn a-btn--primary" href="/admin/bookings/new">Record offline booking</Link>
        </div>
      </header>
      {sp.created && <p className="a-flash a-flash--ok" role="status">Offline booking recorded.</p>}

      <div className="a-statstrip">
        <StatTile label="Matching bookings" value={num(totalAll)} note={status ? `all statuses` : undefined} />
        <StatTile label="Awaiting review" value={num((counts.requested ?? 0) + (counts.reviewing ?? 0))} note="requested + reviewing" href="/admin/bookings?status=requested" />
        <StatTile label="Confirmed" value={num(counts.confirmed ?? 0)} />
        <StatTile label="Value, not declined" value={money(openValue, base, true)} note={base} />
      </div>

      <nav className="a-chips" aria-label="Filter by status">
        <Link className="a-chip" href={`/admin/bookings${qs({ status: "" })}`} aria-current={!status}>All <b>{num(totalAll)}</b></Link>
        {BOOKING_STATUSES.map((s) => (
          <Link key={s} className="a-chip" href={`/admin/bookings${qs({ status: s })}`} aria-current={status === s}>
            <i className="a-dot" style={{ background: STATUS_COLOR[s] }} />{s[0].toUpperCase() + s.slice(1)} <b>{num(counts[s] ?? 0)}</b>
          </Link>
        ))}
      </nav>

      <form className="a-filters" method="get">
        {status && <input type="hidden" name="status" value={status} />}
        <label>Trek
          <select className="a-input" name="trek" defaultValue={trek}><option value="">All treks</option>{treks.map((t) => <option key={t._id.toHexString()} value={t._id.toHexString()}>{t.name}</option>)}</select>
        </label>
        <label>Channel
          <select className="a-input" name="source" defaultValue={source}><option value="">All</option><option value="website">Website</option><option value="offline">Offline</option></select>
        </label>
        <label>Search <input className="a-input" type="search" name="q" defaultValue={q} placeholder="Reference, name, email or trek" /></label>
        <button className="a-btn" type="submit">Apply</button>
        {(trek || source || q) && <Link className="a-btn" href={`/admin/bookings${qs({ trek: "", source: "", q: "" })}`}>Clear</Link>}
      </form>

      <div className="a-card a-scroll">
        <table className="a-table">
          <thead><tr><th>Reference</th><th>Received</th><th>Lead traveller</th><th>Trek</th><th>Start</th><th className="a-num">Pax</th><th className="a-num">Total</th><th>Channel</th><th>Status</th></tr></thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id}>
                <td><Link className="a-mono" href={`/admin/bookings/${b.id}`}>{b.ref}</Link></td>
                <td>{dateTime(b.createdAt)}</td>
                <td>{b.lead.name}<br /><span className="a-hint">{b.lead.email}</span></td>
                <td>{b.trekName}</td>
                <td>{b.departureDate ? date(b.departureDate) : `Pref. ${date(b.preferredDate)}`}</td>
                <td className="a-num">{b.travellers}</td>
                <td className="a-num">{money(b.total, b.currency)}</td>
                <td>{b.source}</td>
                <td><span className={`a-status a-status--${b.status}`}>{b.status}</span></td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={9}>No bookings match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination p={pg} path="/admin/bookings" params={sp} noun="bookings" variant="admin" />
    </>
  );
}
