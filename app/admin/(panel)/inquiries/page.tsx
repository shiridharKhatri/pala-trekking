import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db, C as COLL } from "@/lib/db";
import { setInquiryStatus } from "@/lib/actions/admin";
import { dateTime } from "@/lib/format";
import { AreaChart, ChartCard, StatTile, num } from "@/components/admin/charts";
import { Pagination } from "@/components/Pagination";
import { paginate, parsePage } from "@/lib/pagination";

const PAGE_SIZE = 10;

export const metadata: Metadata = { title: "Inquiries" };
const STATUSES = ["new", "answered", "closed"] as const;

export default async function Inquiries({ searchParams }: PageProps<"/admin/inquiries">) {
  await requireAdmin(["admin"]);
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as never) ? String(sp.status) : "";
  const coll = (await db()).collection(COLL.inquiries);
  const now = new Date().getTime();
  const since = new Date(now - 90 * 86400000);

  const filter = status ? { status } : {};
  const pg = paginate(await coll.countDocuments(filter), parsePage(sp.page), PAGE_SIZE);
  const [rows, grouped, recent] = await Promise.all([
    coll.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(PAGE_SIZE).toArray(),
    coll.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]).toArray(),
    coll.find({ createdAt: { $gte: since } }, { projection: { createdAt: 1 } }).toArray(),
  ]);
  const counts = Object.fromEntries(grouped.map((g) => [g._id, g.n]));
  const total = grouped.reduce((s, g) => s + g.n, 0);

  // Weekly series for the last 13 weeks.
  const weeks = Array.from({ length: 13 }, (_, i) => {
    const end = now - (12 - i) * 7 * 86400000;
    return { start: end - 7 * 86400000, end, label: new Date(end - 7 * 86400000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) };
  });
  const series = weeks.map((w) => ({ label: w.label, value: recent.filter((r) => { const t = new Date(r.createdAt).getTime(); return t >= w.start && t < w.end; }).length }));

  return (
    <>
      <header className="a-head"><div><h1>Inquiries</h1><p className="a-hint">Messages from the contact form.</p></div></header>
      <div className="a-statstrip">
        <StatTile label="Total received" value={num(total)} />
        <StatTile label="Unanswered" value={num(counts.new ?? 0)} href="/admin/inquiries?status=new" />
        <StatTile label="Answered" value={num(counts.answered ?? 0)} />
        <StatTile label="Last 90 days" value={num(recent.length)} />
      </div>
      <ChartCard title="Inquiries per week" sub="Last 13 weeks" table={{ head: ["Week starting", "Inquiries"], rows: series.map((s) => [s.label, s.value]) }}>
        <AreaChart data={series} label="Inquiries per week, last 13 weeks" />
      </ChartCard>
      <nav className="a-chips" aria-label="Filter by status">
        <Link className="a-chip" href="/admin/inquiries" aria-current={!status}>All <b>{num(total)}</b></Link>
        {STATUSES.map((s) => <Link key={s} className="a-chip" href={`/admin/inquiries?status=${s}`} aria-current={status === s}>{s[0].toUpperCase() + s.slice(1)} <b>{num(counts[s] ?? 0)}</b></Link>)}
      </nav>
      <div className="a-stack">
        {rows.map((r) => {
          const id = r._id.toHexString();
          return (
            <article key={id} className="a-card">
              <div className="a-head" style={{ margin: 0 }}>
                <h2 style={{ margin: 0 }}>{r.name} <span className="a-hint">{r.email}{r.phone ? ` · ${r.phone}` : ""}</span></h2>
                <span className={`a-status a-status--${r.status}`}>{r.status}</span>
              </div>
              <p className="a-hint">{dateTime(new Date(r.createdAt).toISOString())}</p>
              <p style={{ whiteSpace: "pre-wrap" }}>{r.message}</p>
              <div className="a-row-actions">
                <a className="a-btn a-btn--small" href={`mailto:${r.email}?subject=${encodeURIComponent("Your Pala Trekking inquiry")}`}>Reply by email</a>
                {r.status !== "answered" && <form action={setInquiryStatus.bind(null, id, "answered")}><button className="a-btn a-btn--small">Mark answered</button></form>}
                {r.status !== "closed" && <form action={setInquiryStatus.bind(null, id, "closed")}><button className="a-btn a-btn--small">Close</button></form>}
              </div>
            </article>
          );
        })}
        {!rows.length && <p>No inquiries{status ? " with this status" : " yet"}.</p>}
      </div>
      <Pagination p={pg} path="/admin/inquiries" params={sp} noun="inquiries" variant="admin" />
    </>
  );
}
