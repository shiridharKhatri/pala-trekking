import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db, C } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { Pagination } from "@/components/Pagination";
import { paginate, parsePage } from "@/lib/pagination";

const PAGE_SIZE = 50;

export const metadata: Metadata = { title: "Activity log" };

const GROUPS = [
  { key: "", label: "All" }, { key: "login", label: "Sign-ins" }, { key: "booking", label: "Bookings" }, { key: "update", label: "Edits" },
  { key: "status", label: "Publishing" }, { key: "user", label: "Users" }, { key: "media", label: "Media" },
];

export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  await requireAdmin(["admin"]);
  const sp = await searchParams;
  const group = GROUPS.some((g) => g.key === sp.group) ? String(sp.group) : "";
  const filter = group ? { action: { $regex: `^${group}` } } : {};
  const coll = (await db()).collection(C.audit);
  const pg = paginate(await coll.countDocuments(filter), parsePage(sp.page), PAGE_SIZE);
  const rows = await coll.find(filter).sort({ at: -1 }).skip(pg.skip).limit(PAGE_SIZE).toArray();
  return (
    <>
      <header className="a-head"><div><h1>Activity log</h1><p className="a-hint">Sign-ins and every change made in the admin. Newest first.</p></div></header>
      <nav className="a-chips" aria-label="Filter activity">
        {GROUPS.map((g) => <Link key={g.key} className="a-chip" href={g.key ? `/admin/activity?group=${g.key}` : "/admin/activity"} aria-current={g.key === group}>{g.label}</Link>)}
      </nav>
      <section className="a-card a-scroll">
        <table className="a-table">
          <thead><tr><th>When (Nepal time)</th><th>Who</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id.toHexString()}>
                <td>{dateTime(new Date(r.at).toISOString())}</td>
                <td>{String(r.email ?? "")}</td>
                <td><span className={`a-status ${String(r.action).endsWith("failed") ? "a-status--requested" : ""}`}>{String(r.action)}</span></td>
                <td className="a-mono">{String(r.target ?? "")}</td>
                <td className="a-hint">{r.detail ? JSON.stringify(r.detail).slice(0, 140) : ""}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5}>No activity recorded.</td></tr>}
          </tbody>
        </table>
      </section>
      <Pagination p={pg} path="/admin/activity" params={sp} noun="entries" variant="admin" />
    </>
  );
}
