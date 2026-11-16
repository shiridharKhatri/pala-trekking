import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db, C } from "@/lib/db";
import { plain } from "@/lib/serialize";
import { BOOKING_STATUSES, type Booking } from "@/lib/types";
import { date, dateTime, money } from "@/lib/format";

export default async function Bookings({ searchParams }: PageProps<"/admin/bookings">) {
  await requireAdmin(["admin"]);
  const sp = await searchParams;
  const status = typeof sp.status === "string" && BOOKING_STATUSES.includes(sp.status as never) ? sp.status : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ ref: rx }, { "lead.name": rx }, { "lead.email": rx }, { trekName: rx }];
  }
  const rows = plain<Booking[]>(await (await db()).collection(C.bookings).find(filter).sort({ createdAt: -1 }).limit(300).toArray());
  return (
    <>
      <header className="a-head"><h1>Bookings</h1><Link className="a-btn a-btn--primary" href="/admin/bookings/new">Record offline booking</Link></header>
      {sp.created && <p className="a-flash a-flash--ok" role="status">Offline booking recorded.</p>}
      <form className="a-filters" method="get">
        <label>Status
          <select className="a-input" name="status" defaultValue={status}><option value="">All</option>{BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        </label>
        <label>Search <input className="a-input" type="search" name="q" defaultValue={q} placeholder="Reference, name, email or trek" /></label>
        <button className="a-btn" type="submit">Filter</button>
      </form>
      <div className="a-card a-scroll">
        <table className="a-table">
          <thead><tr><th>Reference</th><th>Received</th><th>Lead traveller</th><th>Trek</th><th>Start</th><th>Pax</th><th>Total</th><th>Source</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td><Link className="a-mono" href={`/admin/bookings/${b.id}`}>{b.ref}</Link></td>
                <td>{dateTime(b.createdAt)}</td>
                <td>{b.lead.name}<br /><span className="a-hint">{b.lead.email}</span></td>
                <td>{b.trekName}</td>
                <td>{b.departureDate ? date(b.departureDate) : `Pref. ${date(b.preferredDate)}`}</td>
                <td>{b.travellers}</td>
                <td>{money(b.total, b.currency)}</td>
                <td>{b.source}</td>
                <td><span className={`a-status a-status--${b.status}`}>{b.status}</span></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9}>No bookings match.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
