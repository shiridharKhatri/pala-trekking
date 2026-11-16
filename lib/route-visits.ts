import type { ItineraryDay, StayPoint } from "./types";

export type Visit = { sp: StayPoint; days: number[] };

export function kmBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/**
 * Overnight stops in itinerary order (rest days merged), with long transfer
 * legs at either end (flight or drive from the gateway city) split off so the
 * trail itself can be framed.
 */
export function routeVisits(itinerary: ItineraryDay[], stayPoints: StayPoint[]) {
  const byId = new Map(stayPoints.map((s) => [s.id, s]));
  const visits: Visit[] = [];
  for (const d of [...itinerary].sort((a, b) => a.day - b.day)) {
    const sp = d.stayPointId ? byId.get(d.stayPointId) : undefined;
    if (!sp) continue;
    const last = visits[visits.length - 1];
    if (last && last.sp.id === sp.id) last.days.push(d.day);
    else visits.push({ sp, days: [d.day] });
  }
  const legs = visits.slice(1).map((v, i) => kmBetween(visits[i].sp, v.sp));
  const sorted = [...legs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const isTransfer = (k: number) => k > Math.max(25, median * 4);
  let from = 0, to = visits.length - 1;
  const startOff: StayPoint[] = [], endOff: StayPoint[] = [];
  while (from < to - 1 && isTransfer(legs[from])) startOff.push(visits[from++].sp);
  while (to > from + 1 && isTransfer(legs[to - 1])) endOff.unshift(visits[to--].sp);
  const shown = visits.slice(Math.max(0, from), to + 1);
  return { visits, shown, startOff, endOff };
}
