import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { dashboardCounts } from "@/lib/admin/data";
import { db, C } from "@/lib/db";
import { plain } from "@/lib/serialize";
import type { Booking } from "@/lib/types";
import { date, money } from "@/lib/format";

export default async function Dashboard({ searchParams }: PageProps<"/admin">) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const c = await dashboardCounts();
  const recent = user.role === "admin"
    ? plain<Booking[]>(await (await db()).collection(C.bookings).find({}, { projection: { lead: 0, travellerNames: 0, message: 0 } }).sort({ createdAt: -1 }).limit(6).toArray())
    : [];
  const tiles = [
    { label: "New booking requests", n: c.newBookings, href: "/admin/bookings?status=requested", admin: true },
    { label: "Bookings under review", n: c.reviewing, href: "/admin/bookings?status=reviewing", admin: true },
    { label: "New inquiries", n: c.inquiries, href: "/admin/inquiries", admin: true },
    { label: "Upcoming departures", n: c.upcoming, href: "/admin/departures", admin: true },
    { label: "Published treks", n: c.published, href: "/admin/treks" },
    { label: "Draft treks", n: c.drafts, href: "/admin/treks" },
    { label: "Active advisories", n: c.advisories, href: "/admin/advisories", admin: true },
  ].filter((t) => user.role === "admin" || !t.admin);
  return (
    <>
      <header className="a-head"><h1>Dashboard</h1></header>
      {sp.denied && <p className="a-flash a-flash--err" role="alert">Your role does not include that section.</p>}
      {c.sampleTreks > 0 && (
        <p className="a-flash a-flash--warn">
          {c.sampleTreks} treks still contain <strong>sample data</strong> (prices, dates, capacities and exchange rates are placeholders; route altitudes and coordinates need verification). Replace them and untick “Sample data” before launch, then turn off the preview notice in Settings.
        </p>
      )}
      <div className="a-tiles">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="a-tile"><span className="a-tile__n">{t.n}</span><span>{t.label}</span></Link>
        ))}
      </div>
      {recent.length > 0 && (
        <section className="a-card">
          <h2>Latest bookings</h2>
          <table className="a-table">
            <thead><tr><th>Reference</th><th>Trek</th><th>Start</th><th>Travellers</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {recent.map((b) => (
                <tr key={b.id}>
                  <td><Link href={`/admin/bookings/${b.id}`} className="a-mono">{b.ref}</Link></td>
                  <td>{b.trekName}</td>
                  <td>{b.departureDate ? date(b.departureDate) : `Pref. ${date(b.preferredDate)}`}</td>
                  <td>{b.travellers}</td>
                  <td>{money(b.total, b.currency)}</td>
                  <td><span className={`a-status a-status--${b.status}`}>{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
