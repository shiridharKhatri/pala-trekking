import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getAnalytics, parseRange, RANGES } from "@/lib/admin/analytics";
import { AreaChart, ChartCard, Columns, Funnel, HBars, Key, SegBar, StatTile, C, money, num } from "@/components/admin/charts";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  await requireAdmin(["admin"]);
  const range = parseRange((await searchParams).range);
  const a = await getAnalytics(range);
  const cur = a.base;
  const sourceTotal = a.source.website + a.source.offline;

  return (
    <>
      <header className="a-head">
        <div><h1>Analytics</h1><p className="a-hint">Booking requests received in the last {range} days. Amounts in {cur}.</p></div>
        <nav className="a-seg-ctl" aria-label="Date range">
          {RANGES.map((r) => <Link key={r} href={`/admin/analytics?range=${r}`} aria-current={r === range}>{r === 365 ? "12 months" : `${r} days`}</Link>)}
        </nav>
      </header>
      {a.hasDemo && <p className="a-flash a-flash--warn">Includes <strong>demo bookings</strong>. <code className="a-mono">npm run seed:demo -- --remove</code> deletes them.</p>}

      <div className="a-statstrip">
        <StatTile label="Booking requests" value={num(a.kpis.requests.value)} delta={a.kpis.requests} note={`vs previous ${range} days`} />
        <StatTile label="Pipeline value" value={money(a.kpis.pipeline.value, cur, true)} delta={a.kpis.pipeline} note="excl. declined" />
        <StatTile label="Confirmation rate" value={`${Math.round(a.kpis.conversion.value)}%`} delta={a.kpis.conversion} note="of decided requests" />
        <StatTile label="Average booking" value={money(a.kpis.avgBooking.value, cur)} delta={a.kpis.avgBooking} />
      </div>

      <div className="a-grid12">
        <div className="a-span-6">
          <ChartCard title="Pipeline value over time" sub={`${range > 30 ? "Per week" : "Per day"}, ${cur}, requests not declined or cancelled`}
            table={{ head: ["Period starting", `Value (${cur})`], rows: a.valueSeries.map((p) => [p.label, num(p.value)]) }}>
            <AreaChart data={a.valueSeries} color={C.orange} label={`Pipeline value over the last ${range} days`} format={(n) => money(n, cur, true)} />
          </ChartCard>
        </div>
        <div className="a-span-6">
          <ChartCard title="Inquiries over time" sub={`${range > 30 ? "Per week" : "Per day"}, contact form messages`}
            table={{ head: ["Period starting", "Inquiries"], rows: a.inquirySeries.map((p) => [p.label, p.value]) }}>
            <AreaChart data={a.inquirySeries} color={C.aqua} label={`Inquiries over the last ${range} days`} />
          </ChartCard>
        </div>

        <div className="a-span-6">
          <ChartCard title="From request to confirmation" sub="How far requests received in this period have progressed"
            table={{ head: ["Stage", "Requests"], rows: a.funnel.map((f) => [f.label, f.value]) }}>
            <Funnel steps={a.funnel} />
            <p className="a-hint">Declined and cancelled requests are counted as reviewed but never reach Confirmed.</p>
          </ChartCard>
        </div>
        <div className="a-span-6">
          <ChartCard title="How far ahead people book" sub="Days between the request and the trek start" table={{ head: ["Lead time", "Requests"], rows: a.leadTime.map((l) => [l.label, l.value]) }}>
            <Columns data={a.leadTime} label="Requests by lead time" />
          </ChartCard>
        </div>

        <div className="a-span-6">
          <ChartCard title="Group size" sub="Travellers per request" table={{ head: ["Travellers", "Requests"], rows: a.groupSize.map((g) => [g.label, g.value]) }}>
            <Columns data={a.groupSize} color={C.blue} label="Requests by group size" />
          </ChartCard>
        </div>
        <div className="a-span-6">
          <ChartCard title="Booking channel" sub="Website requests and bookings recorded by the team">
            <SegBar parts={[{ label: "Website", value: a.source.website, color: C.blue }, { label: "Offline", value: a.source.offline, color: C.orange }]} />
            <p className="a-hint" style={{ margin: 0 }}>{sourceTotal ? `${Math.round((a.source.website / sourceTotal) * 100)}% of bookings arrive through the website.` : "No bookings in this period."}</p>
          </ChartCard>
          <ChartCard title="Value by gateway" sub={cur}>
            <SegBar parts={[{ label: "Kathmandu", value: a.gateways.kathmandu ?? 0, color: C.blue }, { label: "Pokhara", value: a.gateways.pokhara ?? 0, color: C.orange }]} format={(n) => money(n, cur, true)} />
          </ChartCard>
        </div>

        <div className="a-span-12">
          <section className="a-card">
            <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Trek performance</h2>
            <div className="a-scroll">
              <table className="a-table">
                <thead><tr><th>Trek</th><th className="a-num">Requests</th><th className="a-num">Travellers</th><th className="a-num">Pipeline ({cur})</th><th className="a-num">Avg per request</th><th className="a-num">Confirmed</th></tr></thead>
                <tbody>
                  {a.byTrek.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 600 }}>{t.name}</td>
                      <td className="a-num">{t.bookings}</td><td className="a-num">{t.travellers}</td><td className="a-num">{num(t.value)}</td>
                      <td className="a-num">{t.bookings ? num(t.value / t.bookings) : "–"}</td>
                      <td className="a-num">{t.decided ? `${Math.round((t.confirmed / t.decided) * 100)}%` : "–"}</td>
                    </tr>
                  ))}
                  {!a.byTrek.length && <tr><td colSpan={6}>No requests in this period.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="a-hint" style={{ margin: "0.6rem 0 0" }}>Confirmed = share of decided requests (confirmed, declined or cancelled) that were confirmed.</p>
          </section>
        </div>

        <div className="a-span-7">
          <ChartCard title="Countries" sub="Lead traveller's country of residence" table={{ head: ["Country", "Requests"], rows: a.countries.map((c) => [c.label, c.value]) }}>
            <HBars items={a.countries} color={C.blue} />
          </ChartCard>
        </div>
        <div className="a-span-5">
          <ChartCard title="Optional experiences" sub="Extras added to bookings in this period" legend={<Key color={C.aqua}>Times added</Key>}
            table={{ head: ["Experience", "Times added", `Added value (${cur})`], rows: a.addOns.map((e) => [e.label, e.value, num(e.sub)]) }}>
            <div className="a-headfig">
              <div><b>{Math.round(a.kpis.addOnRate.value)}%</b><span>of bookings added an extra</span></div>
              <div><b>{money(a.addOns.reduce((s, e) => s + e.sub, 0), cur, true)}</b><span>added value</span></div>
            </div>
            <HBars items={a.addOns.map((e) => ({ label: e.label, value: e.value, sub: `${money(e.sub, cur)} total` }))} color={C.aqua} sub />
          </ChartCard>
        </div>
      </div>
    </>
  );
}
