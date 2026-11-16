import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db, C as COLL } from "@/lib/db";
import { plain } from "@/lib/serialize";
import { setStatus } from "@/lib/actions/admin";
import { difficultyLabel, gatewayLabel } from "@/lib/format";
import type { Trek } from "@/lib/types";
import { StatTile, money, num } from "@/components/admin/charts";
import { Pagination } from "@/components/Pagination";
import { parsePage, slicePage } from "@/lib/pagination";


export const metadata: Metadata = { title: "Treks" };

export default async function TreksAdmin({ searchParams }: PageProps<"/admin/treks">) {
  const user = await requireAdmin(["admin", "content"]);
  const sp = await searchParams;
  const database = await db();
  const isAdmin = user.role === "admin";
  const since = new Date(new Date().getTime() - 90 * 86400000);
  const today = new Date().toISOString().slice(0, 10);

  const [rows, perf, deps, settings] = await Promise.all([
    database.collection(COLL.treks).find({}).sort({ status: -1, name: 1 }).toArray(),
    isAdmin ? database.collection(COLL.bookings).aggregate<{ _id: string; n: number; value: number }>([
      { $match: { createdAt: { $gte: since }, status: { $in: ["requested", "reviewing", "confirmed"] } } },
      { $group: { _id: "$trekId", n: { $sum: 1 }, value: { $sum: "$total" } } },
    ]).toArray() : Promise.resolve([]),
    database.collection(COLL.departures).aggregate<{ _id: string; n: number }>([{ $match: { startDate: { $gte: today }, isPublic: true } }, { $group: { _id: "$trekId", n: { $sum: 1 } } }]).toArray(),
    database.collection(COLL.settings).findOne({ _id: "site" as never }),
  ]);
  const base = (settings?.currency?.base as string) ?? "USD";
  const treks = plain<(Trek & { sample?: boolean })[]>(rows);
  const perfBy = new Map(perf.map((p) => [String(p._id), p]));
  const depBy = new Map(deps.map((d) => [String(d._id), d.n]));
  const published = treks.filter((t) => t.status === "published");
  const { items: pageTreks, p: pg } = slicePage(treks, parsePage(sp.page), 15);
  const avgPrice = published.length ? published.reduce((s, t) => s + t.basePrice, 0) / published.length : 0;

  return (
    <>
      <header className="a-head">
        <div><h1>Treks</h1><p className="a-hint">Packages, publication status and how each is performing (last 90 days).</p></div>
        <Link className="a-btn a-btn--primary" href="/admin/treks/new">New trek</Link>
      </header>
      {sp.deleted && <p className="a-flash a-flash--ok" role="status">Deleted.</p>}
      <div className="a-statstrip">
        <StatTile label="Published" value={num(published.length)} />
        <StatTile label="Drafts" value={num(treks.filter((t) => t.status === "draft").length)} />
        <StatTile label="Average base price" value={money(avgPrice, base)} note={`${base} per person`} />
        <StatTile label="Upcoming departures" value={num([...depBy.values()].reduce((s, n) => s + n, 0))} href={isAdmin ? "/admin/departures" : undefined} />
      </div>
      <div className="a-card a-scroll">
        <table className="a-table">
          <thead><tr><th>Trek</th><th>Gateway</th><th className="a-num">Days</th><th>Grade</th><th className="a-num">From</th>{isAdmin && <><th className="a-num">Requests</th><th className="a-num">Pipeline</th></>}<th className="a-num">Departures</th><th>Status</th><th><span className="vh">Actions</span></th></tr></thead>
          <tbody>
            {pageTreks.map((t) => {
              const p = perfBy.get(t.id);
              return (
                <tr key={t.id}>
                  <td>
                    <div className="a-cell-trek">
                      {t.heroImage ? <Image className="a-thumb" src={t.heroImage.src} alt="" width={112} height={80} quality={60} /> : <span className="a-thumb" />}
                      <span><Link href={`/admin/treks/${t.id}`}><b>{t.name}</b></Link>{t.sample && <span className="a-tag a-tag--warn">sample</span>}<br /><span className="a-hint a-mono">/treks/{t.slug}</span></span>
                    </div>
                  </td>
                  <td>{gatewayLabel[t.gateway]}</td>
                  <td className="a-num">{t.durationDays}</td>
                  <td>{difficultyLabel[t.difficulty]}</td>
                  <td className="a-num">{money(t.basePrice, base)}</td>
                  {isAdmin && <><td className="a-num">{p?.n ?? 0}</td><td className="a-num">{p ? money(p.value, base, true) : "–"}</td></>}
                  <td className="a-num">{depBy.get(t.id) ?? 0}</td>
                  <td><span className={`a-status a-status--${t.status}`}>{t.status}</span></td>
                  <td className="a-row-actions">
                    {isAdmin && t.status !== "published" && <form action={setStatus.bind(null, "treks", t.id, "published")}><button className="a-btn a-btn--small">Publish</button></form>}
                    {isAdmin && t.status === "published" && <form action={setStatus.bind(null, "treks", t.id, "draft")}><button className="a-btn a-btn--small">Unpublish</button></form>}
                    {isAdmin && t.status !== "archived" && <form action={setStatus.bind(null, "treks", t.id, "archived")}><button className="a-btn a-btn--small">Archive</button></form>}
                    {t.status === "published" && <Link className="a-btn a-btn--small" href={`/treks/${t.slug}`} target="_blank">View</Link>}
                  </td>
                </tr>
              );
            })}
            {!treks.length && <tr><td colSpan={10}>No treks yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination p={pg} path="/admin/treks" params={sp} noun="treks" variant="admin" />
    </>
  );
}
