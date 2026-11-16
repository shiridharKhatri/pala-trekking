import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { dashboardCounts } from "@/lib/admin/data";
import { getAnalytics, parseRange, RANGES } from "@/lib/admin/analytics";
import { db, C as COLL } from "@/lib/db";
import { plain } from "@/lib/serialize";
import type { Booking } from "@/lib/types";
import { date, dateTime } from "@/lib/format";
import { departureStatusLabel } from "@/lib/departures";
import { AreaChart, ChartCard, Donut, HBars, Key, Meter, SegBar, StatTile, STATUS_COLOR, C, money, num } from "@/components/admin/charts";

export default async function Dashboard({ searchParams }: PageProps<"/admin">) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const counts = await dashboardCounts();

  if (user.role !== "admin") {
    const tiles = [
      { label: "Published treks", n: counts.published, href: "/admin/treks" },
      { label: "Draft treks", n: counts.drafts, href: "/admin/treks" },
    ];
    return (
      <>
        <header className="a-head"><h1>Dashboard</h1></header>
        {sp.denied && <p className="a-flash a-flash--err" role="alert">Your role does not include that section.</p>}
        <div className="a-tiles">{tiles.map((t) => <Link key={t.label} href={t.href} className="a-tile"><span className="a-tile__n">{t.n}</span><span>{t.label}</span></Link>)}</div>
        <p className="a-hint">Booking and customer data is visible to administrators only.</p>
      </>
    );
  }

  const range = parseRange(sp.range);
  const a = await getAnalytics(range);
  const database = await db();
  const [recent, activity] = await Promise.all([
    database.collection(COLL.bookings).find({}, { projection: { lead: 0, travellerNames: 0, message: 0 } }).sort({ createdAt: -1 }).limit(7).toArray(),
    database.collection(COLL.audit).find({}).sort({ at: -1 }).limit(7).toArray(),
  ]);
  const recentRows = plain<Booking[]>(recent);
  const cur = a.base;
  const per = `vs previous ${range} days`;
  const spark = (pts: { value: number }[]) => pts.map((p) => p.value);
  const DEP_ROWS = 8;
  const deps = a.departures.slice(0, DEP_ROWS);

  const lowSeats = a.departures.filter((d) => d.status !== "closed" && d.spacesLeft <= 2).length;
  const forming = a.departures.filter((d) => d.status === "forming" && new Date(d.startDate).getTime() - new Date().getTime() < 30 * 86400000).length;
  const queue = [
    { n: counts.newBookings, text: "New booking requests to review", href: "/admin/bookings?status=requested" },
    { n: counts.reviewing, text: "Bookings under review", href: "/admin/bookings?status=reviewing" },
    { n: counts.inquiries, text: "Unanswered inquiries", href: "/admin/inquiries" },
    { n: forming, text: "Departures within 30 days still forming", href: "/admin/departures" },
    { n: lowSeats, text: "Departures with 2 or fewer seats left", href: "/admin/departures" },
    { n: counts.drafts, text: "Draft treks not yet published", href: "/admin/treks" },
  ];

  return (
    <>
      <header className="a-head">
        <div><h1>Dashboard</h1><p className="a-hint">Last {range} days, compared with the {range} days before.</p></div>
        <div className="a-pagehead-tools">
          <nav className="a-seg-ctl" aria-label="Date range">
            {RANGES.map((r) => <Link key={r} href={`/admin?range=${r}`} aria-current={r === range}>{r === 365 ? "12 months" : `${r} days`}</Link>)}
          </nav>
          <Link className="a-btn" href="/admin/analytics">Full analytics</Link>
        </div>
      </header>
      {sp.denied && <p className="a-flash a-flash--err" role="alert">Your role does not include that section.</p>}
      {counts.sampleTreks > 0 && (
        <p className="a-flash a-flash--warn">
          Treks still contain <strong>sample data</strong> (prices, dates, capacities and exchange rates are placeholders). Replace it and untick “Sample data” before launch.
          {a.hasDemo && <> This dashboard also includes <strong>demo bookings</strong> (<code className="a-mono">npm run seed:demo -- --remove</code> deletes them).</>}
        </p>
      )}

      <div className="a-statstrip">
        <StatTile label="Booking requests" value={num(a.kpis.requests.value)} delta={a.kpis.requests} note={per} spark={spark(a.requestsSeries)} />
        <StatTile label="Pipeline value" value={money(a.kpis.pipeline.value, cur, true)} delta={a.kpis.pipeline} note={`${cur}, excl. declined`} spark={spark(a.valueSeries)} />
        <StatTile label="Confirmed value" value={money(a.kpis.confirmedValue.value, cur, true)} delta={a.kpis.confirmedValue} note={cur} spark={spark(a.confirmedSeries)} />
        <StatTile label="Confirmation rate" value={`${Math.round(a.kpis.conversion.value)}%`} delta={a.kpis.conversion} note="of decided requests" />
        <StatTile label="Travellers" value={num(a.kpis.travellers.value)} delta={a.kpis.travellers} note="excl. declined" />
        <StatTile label="Average booking" value={money(a.kpis.avgBooking.value, cur)} delta={a.kpis.avgBooking} note={cur} />
        <StatTile label="Inquiries" value={num(a.kpis.inquiries.value)} delta={a.kpis.inquiries} note={per} href="/admin/inquiries" />
        <StatTile label="Add-on take rate" value={`${Math.round(a.kpis.addOnRate.value)}%`} delta={a.kpis.addOnRate} note="bookings with an extra" />
      </div>

      <div className="a-grid12">
        <div className="a-span-8">
          <ChartCard
            title="Booking requests over time" sub={`${range > 30 ? "Per week" : "Per day"}, last ${range} days`}
            table={{ head: ["Period starting", "Requests"], rows: a.requestsSeries.map((p) => [p.label, p.value]) }}
          >
            <AreaChart data={a.requestsSeries} label={`Booking requests over the last ${range} days`} />
          </ChartCard>
        </div>
        <div className="a-span-4">
          <ChartCard title="Where requests stand" sub="Status of requests received in this period" table={{ head: ["Status", "Requests"], rows: a.status.map((s) => [s.key, s.value]) }}>
            <Donut label="Booking requests by status" centre={{ big: num(a.kpis.requests.value), small: "requests" }}
              parts={a.status.map((s) => ({ key: s.key, label: s.key[0].toUpperCase() + s.key.slice(1), value: s.value, color: STATUS_COLOR[s.key] }))} />
          </ChartCard>
        </div>

        <div className="a-span-5">
          <ChartCard title="Top treks by pipeline value" sub={`${cur}, requests not declined or cancelled`}
            table={{ head: ["Trek", "Requests", "Travellers", `Value (${cur})`], rows: a.byTrek.map((t) => [t.name, t.bookings, t.travellers, num(t.value)]) }}>
            <HBars items={a.byTrek.slice(0, 6).map((t) => ({ label: t.name, value: t.value, sub: `${t.bookings} requests, ${t.travellers} travellers` }))} format={(n) => money(n, cur, true)} sub />
          </ChartCard>
          <ChartCard title="Revenue by gateway" sub={`${cur}, pipeline value`}>
            <SegBar parts={[{ label: "Kathmandu", value: a.gateways.kathmandu ?? 0, color: C.blue }, { label: "Pokhara", value: a.gateways.pokhara ?? 0, color: C.orange }]} format={(n) => money(n, cur, true)} />
            <dl className="a-gwstats">
              {a.gatewayRows.map((g) => (
                <div key={g.key}>
                  <dt><Key color={g.key === "kathmandu" ? C.blue : C.orange}>{g.key === "kathmandu" ? "Kathmandu" : "Pokhara"}</Key></dt>
                  <dd><b>{num(g.requests)}</b> requests</dd>
                  <dd><b>{num(g.travellers)}</b> travellers</dd>
                  <dd><b>{num(g.treks)}</b> {g.treks === 1 ? "trek" : "treks"} booked</dd>
                </div>
              ))}
            </dl>
          </ChartCard>
        </div>
        <div className="a-span-7">
          <ChartCard title="Upcoming departure capacity" sub={`Public departures, next ${DEP_ROWS}`}
            legend={<><Key color={C.blue}>Website</Key><Key color={C.orange}>Offline</Key></>}
            table={{ head: ["Trek", "Start", "Website", "Offline", "Capacity", "Status"], rows: deps.map((d) => [d.trek, date(d.startDate), d.web, d.offline, d.capacity, departureStatusLabel[d.status]]) }}>
            {deps.length ? (
              <div>
                {deps.map((d) => (
                  <div key={d.id} className="a-dep">
                    <span className="a-dep__trek"><Link href={`/admin/departures/${d.id}`}>{d.trek}</Link></span>
                    <span className="a-mono">{date(d.startDate, { year: undefined })}</span>
                    <Meter web={d.web} offline={d.offline} capacity={d.capacity} />
                    <span className="a-dep__seats">{d.web + d.offline}/{d.capacity} seats</span>
                    <span className={`a-status a-status--dep-${d.status}`}>{departureStatusLabel[d.status]}</span>
                  </div>
                ))}
                <p className="a-hint" style={{ margin: "0.6rem 0 0" }}><Link href="/admin/departures">All departures</Link></p>
              </div>
            ) : <p className="a-hint">No upcoming public departures. <Link href="/admin/departures/new">Create one</Link>.</p>}
          </ChartCard>
        </div>

        <div className="a-span-4">
          <ChartCard title="Where travellers come from" sub="Lead traveller's country" table={{ head: ["Country", "Requests"], rows: a.countries.map((c) => [c.label, c.value]) }}>
            <HBars items={a.countries} color={C.aqua} />
          </ChartCard>
        </div>
        <div className="a-span-4">
          <section className="a-card a-chart">
            <header className="a-chart__head"><div><h2>Needs attention</h2><p className="a-hint">Work waiting for the team</p></div></header>
            <div className="a-chart__body">
              <ul className="a-queue">
                {queue.map((q) => (
                  <li key={q.text}><span className="a-queue__n" data-zero={q.n === 0}>{q.n}</span><Link href={q.href}>{q.text}</Link><span aria-hidden="true">→</span></li>
                ))}
              </ul>
            </div>
            {a.oldestOpenDays != null && a.oldestOpenDays > 2 && <p className="a-hint" style={{ margin: 0 }}>The oldest unreviewed request is {a.oldestOpenDays} days old.</p>}
          </section>
        </div>
        <div className="a-span-4">
          <section className="a-card a-chart">
            <header className="a-chart__head"><div><h2>Recent activity</h2><p className="a-hint">Admin actions</p></div><Link href="/admin/activity" className="a-hint">All activity</Link></header>
            <div className="a-chart__body">
              <ul className="a-feed">
                {activity.map((e) => (
                  <li key={e._id.toHexString()}>
                    <time dateTime={new Date(e.at).toISOString()}>{new Date(e.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kathmandu" })}</time>
                    <span><b>{String(e.action)}</b> <span className="a-hint">{String(e.email ?? "")}</span></span>
                  </li>
                ))}
                {!activity.length && <li><span /><span className="a-hint">No activity yet.</span></li>}
              </ul>
            </div>
          </section>
        </div>

        <div className="a-span-12">
          <section className="a-card">
            <header className="a-chart__head" style={{ marginBottom: "0.75rem" }}><div><h2>Latest booking requests</h2></div><Link className="a-btn a-btn--small" href="/admin/bookings">All bookings</Link></header>
            <div className="a-scroll">
              <table className="a-table">
                <thead><tr><th>Reference</th><th>Received</th><th>Trek</th><th>Start</th><th className="a-num">Pax</th><th className="a-num">Total</th><th>Status</th></tr></thead>
                <tbody>
                  {recentRows.map((b) => (
                    <tr key={b.id}>
                      <td><Link href={`/admin/bookings/${b.id}`} className="a-mono">{b.ref}</Link></td>
                      <td>{dateTime(b.createdAt)}</td>
                      <td>{b.trekName}</td>
                      <td>{b.departureDate ? date(b.departureDate) : `Pref. ${date(b.preferredDate)}`}</td>
                      <td className="a-num">{b.travellers}</td>
                      <td className="a-num">{money(b.total, b.currency)}</td>
                      <td><span className={`a-status a-status--${b.status}`}>{b.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
      <p className="a-hint">All figures are computed from the booking database when you open this page. Amounts are in the base currency ({cur}); converted display prices are never summed.</p>
    </>
  );
}
