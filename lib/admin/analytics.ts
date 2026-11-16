import "server-only";
import { db, C } from "../db";
import { departureState, SEAT_HOLDING } from "../departures";
import type { BookingStatus, Departure } from "../types";
import { plain } from "../serialize";

export const RANGES = [30, 90, 365] as const;
export type Range = (typeof RANGES)[number];
export function parseRange(v: unknown): Range {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return (RANGES as readonly number[]).includes(n) ? (n as Range) : 90;
}

const DAY = 86400000;
const OPEN: BookingStatus[] = ["requested", "reviewing"];
const LIVE: BookingStatus[] = ["requested", "reviewing", "confirmed"]; // not declined/cancelled

interface B {
  ref: string; createdAt: string; status: BookingStatus; total: number; travellers: number; trekId: string; trekName: string;
  source: string; addOns: { name: string; price: number }[]; lead: { country: string }; currency: string;
  departureDate: string | null; preferredDate: string | null; demo?: boolean;
}

export type Point = { label: string; value: number; start: string };
export interface Delta { value: number; previous: number; pct: number | null }

function delta(value: number, previous: number): Delta {
  return { value, previous, pct: previous === 0 ? (value === 0 ? 0 : null) : ((value - previous) / previous) * 100 };
}

/** Bucket timestamps into day (≤ 90 d) or ISO-week (365 d) bins ending today. */
function bins(days: number, now: number) {
  const step = days > 30 ? 7 : 1;
  const count = Math.ceil(days / step);
  const end = new Date(now); end.setUTCHours(0, 0, 0, 0);
  const endMs = end.getTime() + DAY; // exclusive end
  return Array.from({ length: count }, (_, i) => {
    const start = endMs - (count - i) * step * DAY;
    return { start, end: start + step * DAY, label: new Date(start).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }), iso: new Date(start).toISOString().slice(0, 10) };
  });
}

export async function getAnalytics(range: Range) {
  const database = await db();
  const nowMs = new Date().getTime();
  const since = nowMs - range * DAY;
  const prevSince = since - range * DAY;

  const [rows, trekRows, inqRows, depRows, settings] = await Promise.all([
    database.collection(C.bookings).find({ createdAt: { $gte: new Date(prevSince) } }, {
      projection: { ref: 1, createdAt: 1, status: 1, total: 1, travellers: 1, trekId: 1, trekName: 1, source: 1, addOns: 1, "lead.country": 1, currency: 1, departureDate: 1, preferredDate: 1, demo: 1 },
    }).limit(8000).toArray(),
    database.collection(C.treks).find({}, { projection: { name: 1, gateway: 1, status: 1, basePrice: 1 } }).toArray(),
    database.collection(C.inquiries).find({ createdAt: { $gte: new Date(prevSince) } }, { projection: { createdAt: 1, status: 1, demo: 1 } }).limit(8000).toArray(),
    database.collection(C.departures).find({ isPublic: true, startDate: { $gte: new Date(nowMs).toISOString().slice(0, 10) } }).sort({ startDate: 1 }).limit(40).toArray(),
    database.collection(C.settings).findOne({ _id: "site" as never }),
  ]);

  const all = plain<B[]>(rows);
  const cur = all.filter((b) => new Date(b.createdAt).getTime() >= since);
  const prev = all.filter((b) => new Date(b.createdAt).getTime() < since);
  const base = (settings?.currency?.base as string) ?? "USD";
  const trekMeta = new Map(plain<{ id: string; name: string; gateway: string }[]>(trekRows).map((t) => [t.id, t]));
  const sum = (a: B[], f: (b: B) => number) => a.reduce((s, b) => s + f(b), 0);
  const live = (a: B[]) => a.filter((b) => LIVE.includes(b.status));

  // ------- KPIs (each with the same measure for the previous period) -------
  const decided = (a: B[]) => a.filter((b) => ["confirmed", "declined", "cancelled"].includes(b.status));
  const rate = (a: B[]) => (decided(a).length ? (a.filter((b) => b.status === "confirmed").length / decided(a).length) * 100 : 0);
  const inqCur = plain<{ createdAt: string; status: string }[]>(inqRows).filter((i) => new Date(i.createdAt).getTime() >= since);
  const inqPrev = plain<{ createdAt: string; status: string }[]>(inqRows).filter((i) => new Date(i.createdAt).getTime() < since);

  const kpis = {
    requests: delta(cur.length, prev.length),
    pipeline: delta(sum(live(cur), (b) => b.total), sum(live(prev), (b) => b.total)),
    confirmedValue: delta(sum(cur.filter((b) => b.status === "confirmed"), (b) => b.total), sum(prev.filter((b) => b.status === "confirmed"), (b) => b.total)),
    travellers: delta(sum(live(cur), (b) => b.travellers), sum(live(prev), (b) => b.travellers)),
    conversion: delta(rate(cur), rate(prev)),
    avgBooking: delta(live(cur).length ? sum(live(cur), (b) => b.total) / live(cur).length : 0, live(prev).length ? sum(live(prev), (b) => b.total) / live(prev).length : 0),
    inquiries: delta(inqCur.length, inqPrev.length),
    addOnRate: delta(live(cur).length ? (live(cur).filter((b) => b.addOns?.length).length / live(cur).length) * 100 : 0, live(prev).length ? (live(prev).filter((b) => b.addOns?.length).length / live(prev).length) * 100 : 0),
  };

  // ------- time series -------
  const buckets = bins(range, nowMs);
  const series = (src: { createdAt: string }[], f: (x: never) => number = () => 1): Point[] =>
    buckets.map((bk) => ({
      label: bk.label, start: bk.iso,
      value: src.filter((x) => { const t = new Date(x.createdAt).getTime(); return t >= bk.start && t < bk.end; }).reduce((s, x) => s + f(x as never), 0),
    }));
  const requestsSeries = series(cur);
  const valueSeries = series(live(cur), ((b: B) => b.total) as never);
  const inquirySeries = series(inqCur);
  const confirmedSeries = series(cur.filter((b) => b.status === "confirmed"));

  // ------- breakdowns -------
  const statusOrder: BookingStatus[] = ["requested", "reviewing", "confirmed", "declined", "cancelled"];
  const status = statusOrder.map((s) => ({ key: s, value: cur.filter((b) => b.status === s).length }));

  const byTrekMap = new Map<string, { name: string; bookings: number; value: number; travellers: number; confirmed: number; decided: number }>();
  for (const b of cur) {
    const e = byTrekMap.get(b.trekId) ?? { name: b.trekName, bookings: 0, value: 0, travellers: 0, confirmed: 0, decided: 0 };
    e.bookings++;
    if (LIVE.includes(b.status)) { e.value += b.total; e.travellers += b.travellers; }
    if (["confirmed", "declined", "cancelled"].includes(b.status)) { e.decided++; if (b.status === "confirmed") e.confirmed++; }
    byTrekMap.set(b.trekId, e);
  }
  const byTrek = [...byTrekMap.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.value - a.value);

  const gw = { kathmandu: 0, pokhara: 0 } as Record<string, number>;
  for (const b of live(cur)) { const g = trekMeta.get(b.trekId)?.gateway; if (g) gw[g] = (gw[g] ?? 0) + b.total; }

  const cm = new Map<string, number>();
  for (const b of live(cur)) cm.set(b.lead?.country || "??", (cm.get(b.lead?.country || "??") ?? 0) + 1);
  const dn = new Intl.DisplayNames(["en"], { type: "region" });
  const countryAll = [...cm.entries()].sort((a, b) => b[1] - a[1]).map(([code, value]) => ({ label: code === "??" ? "Not recorded" : (dn.of(code) ?? code), value }));
  const countries = countryAll.length > 8 ? [...countryAll.slice(0, 7), { label: "Other", value: countryAll.slice(7).reduce((s, c) => s + c.value, 0) }] : countryAll;

  const groupBands: [string, (n: number) => boolean][] = [["1", (n) => n === 1], ["2", (n) => n === 2], ["3 to 4", (n) => n >= 3 && n <= 4], ["5 or more", (n) => n >= 5]];
  const groupSize = groupBands.map(([label, f]) => ({ label, value: live(cur).filter((b) => f(b.travellers)).length }));

  const leadBands: [string, (d: number) => boolean][] = [["Under 30 days", (d) => d < 30], ["30 to 60", (d) => d >= 30 && d < 60], ["60 to 120", (d) => d >= 60 && d < 120], ["120 to 180", (d) => d >= 120 && d < 180], ["180 or more", (d) => d >= 180]];
  const leadDays = live(cur).map((b) => { const start = b.departureDate ?? b.preferredDate; return start ? Math.round((new Date(start).getTime() - new Date(b.createdAt).getTime()) / DAY) : null; }).filter((d): d is number => d != null && d >= 0);
  const leadTime = leadBands.map(([label, f]) => ({ label, value: leadDays.filter(f).length }));

  const addMap = new Map<string, { n: number; value: number }>();
  for (const b of live(cur)) for (const a of b.addOns ?? []) { const e = addMap.get(a.name) ?? { n: 0, value: 0 }; e.n++; e.value += a.price; addMap.set(a.name, e); }
  const addOns = [...addMap.entries()].map(([label, v]) => ({ label, value: v.n, sub: v.value })).sort((a, b) => b.value - a.value);

  const source = { website: live(cur).filter((b) => b.source === "website").length, offline: live(cur).filter((b) => b.source === "offline").length };

  // Funnel: everything that arrived, then how far each got.
  const reachedReview = cur.filter((b) => b.status !== "requested").length;
  const funnel = [
    { label: "Requested", value: cur.length },
    { label: "Reviewed by the team", value: reachedReview },
    { label: "Confirmed", value: cur.filter((b) => b.status === "confirmed").length },
  ];

  // ------- upcoming departures: capacity -------
  const deps = plain<Departure[]>(depRows);
  const ids = deps.map((d) => d.id);
  const held = ids.length ? await database.collection(C.bookings).aggregate<{ _id: string; n: number }>([
    { $match: { departureId: { $in: ids }, status: { $in: SEAT_HOLDING } } }, { $group: { _id: "$departureId", n: { $sum: "$travellers" } } },
  ]).toArray() : [];
  const heldBy = new Map(held.map((h) => [String(h._id), h.n]));
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const departures = deps.slice(0, 10).map((d) => {
    const web = heldBy.get(d.id) ?? 0;
    const st = departureState(d, web, today);
    return { id: d.id, trek: trekMeta.get(d.trekId)?.name ?? "Unknown", startDate: d.startDate, capacity: d.capacity, offline: d.offlineBooked ?? 0, web, status: st.status, spacesLeft: st.spacesLeft, isPublic: d.isPublic };
  });

  const openRequests = await database.collection(C.bookings).countDocuments({ status: { $in: OPEN } });
  const oldestOpen = await database.collection(C.bookings).find({ status: "requested" }, { projection: { createdAt: 1 } }).sort({ createdAt: 1 }).limit(1).toArray();

  return {
    base, range, kpis, requestsSeries, valueSeries, inquirySeries, confirmedSeries, status, byTrek, gateways: gw, countries, groupSize, leadTime, addOns,
    source, funnel, departures, openRequests, oldestOpenDays: oldestOpen[0] ? Math.floor((nowMs - new Date(oldestOpen[0].createdAt as Date).getTime()) / DAY) : null,
    hasDemo: all.some((b) => b.demo),
  };
}

export type Analytics = Awaited<ReturnType<typeof getAnalytics>>;
