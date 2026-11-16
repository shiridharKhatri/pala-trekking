"use client";

import { useEffect, useRef, useState } from "react";
import type { ItineraryDay, StayPoint } from "@/lib/types";
import { metres } from "@/lib/format";
import { emitDayHover, scrollToDay, useDayHover } from "@/lib/day-sync";

/**
 * Route sketch: overnight stops plotted from their stored coordinates, joined
 * in itinerary order. No map tiles and no third-party provider (the map
 * provider is still an open decision); straight lines between stops, so it
 * explains the shape of the route, it is not a navigation map.
 */
export function RouteMap({ itinerary, stayPoints }: { itinerary: ItineraryDay[]; stayPoints: StayPoint[] }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [shown, setShown] = useState(false);
  useDayHover("map", setHoverDay);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const byId = new Map(stayPoints.map((s) => [s.id, s]));
  const days = [...itinerary].sort((a, b) => a.day - b.day);
  // Visit order: one entry per night, consecutive repeats (rest days) merged.
  const visits: { sp: StayPoint; days: number[] }[] = [];
  for (const d of days) {
    const sp = d.stayPointId ? byId.get(d.stayPointId) : undefined;
    if (!sp) continue;
    const last = visits[visits.length - 1];
    if (last && last.sp.id === sp.id) last.days.push(d.day);
    else visits.push({ sp, days: [d.day] });
  }
  // Long transfer legs at either end (flight or drive from the gateway city)
  // would squash the trail into a corner. Trim them and point off-map instead.
  const kmBetween = (a: StayPoint, b: StayPoint) => {
    const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  };
  const legs = visits.slice(1).map((v, i) => kmBetween(visits[i].sp, v.sp));
  const sorted = [...legs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const isTransfer = (k: number) => k > Math.max(25, median * 4);
  let from = 0, to = visits.length - 1;
  const startOff: StayPoint[] = [], endOff: StayPoint[] = [];
  while (from < to - 1 && isTransfer(legs[from])) startOff.push(visits[from++].sp);
  while (to > from + 1 && isTransfer(legs[to - 1])) endOff.unshift(visits[to--].sp);
  const shownVisits = visits.slice(from, to + 1);
  const unique = [...new Map(shownVisits.map((v) => [v.sp.id, v.sp])).values()];
  if (unique.length < 2) return null;

  // Equirectangular projection, equal scale on both axes.
  const W = 420, H = 300, PAD = 34;
  const meanLat = unique.reduce((s, p) => s + p.lat, 0) / unique.length;
  const kx = Math.cos((meanLat * Math.PI) / 180);
  const xs = unique.map((p) => p.lon * kx), ys = unique.map((p) => -p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY, 0.02);
  const s = Math.min((W - PAD * 2) / Math.max(maxX - minX, span * 0.35), (H - PAD * 2) / Math.max(maxY - minY, span * 0.35));
  const ox = (W - (maxX - minX) * s) / 2, oy = (H - (maxY - minY) * s) / 2;
  const px = (p: StayPoint) => ox + (p.lon * kx - minX) * s;
  const py = (p: StayPoint) => oy + (-p.lat - minY) * s;

  const path = shownVisits.map((v, i) => `${i ? "L" : "M"}${px(v.sp).toFixed(1)},${py(v.sp).toFixed(1)}`).join(" ");
  const highest = unique.reduce((m, p) => (p.elevationM > m.elevationM ? p : m));
  const nightsAt = (id: string) => shownVisits.filter((v) => v.sp.id === id).flatMap((v) => v.days);

  // Scale bar: a round distance near a quarter of the width (1 deg lat = 111.32 km).
  const kmPerUnit = 111.32 / s;
  const target = (W / 4) * kmPerUnit;
  const nice = [1, 2, 5, 10, 20, 25, 50, 100].reduce((b, n) => (Math.abs(n - target) < Math.abs(b - target) ? n : b), 1);
  const barW = nice / kmPerUnit;

  const offCities = [...new Map([...startOff, ...endOff].map((c) => [c.id, c])).values()];
  const offNote = offCities.length
    ? ` Dashed arrows: transfer to ${offCities.map((c) => `${c.name}, about ${Math.round(kmBetween(c, startOff.includes(c) ? shownVisits[0].sp : shownVisits[shownVisits.length - 1].sp))} km away`).join("; ")}, not drawn to scale.`
    : "";
  const activeStop = hoverDay != null ? visits.find((v) => v.days.includes(hoverDay))?.sp.id : undefined;

  return (
    <figure className="routemap" data-shown={shown || undefined}>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="routemap-title routemap-desc">
        <title id="routemap-title">Route sketch of overnight stops</title>
        <desc id="routemap-desc">
          {visits.map((v) => `Day ${v.days.join(", ")}: ${v.sp.name}, ${metres(v.sp.elevationM)}`).join(". ")}
        </desc>
        <g className="routemap__north" transform={`translate(${W - 18}, 20)`} aria-hidden="true">
          <path d="M0,-10 L5,4 L0,1 L-5,4 Z" />
          <text y={16} textAnchor="middle">N</text>
        </g>
        <path className="routemap__ghost" d={path} />
        <path className="routemap__line" d={path} pathLength={1} />
        {unique.map((p) => {
          const nights = nightsAt(p.id);
          const isHigh = p.id === highest.id;
          const isEnd = p.id === shownVisits[0].sp.id || p.id === shownVisits[shownVisits.length - 1].sp.id;
          const active = activeStop === p.id;
          const x = px(p), y = py(p);
          const label = `${p.name}, ${metres(p.elevationM)}. Night${nights.length > 1 ? "s" : ""} of day ${nights.join(", ")}`;
          const anchor = x > W - 110 ? "end" : x < 110 ? "start" : "middle";
          return (
            <g
              key={p.id}
              className="routemap__stop"
              data-active={active || undefined}
              data-high={isHigh || undefined}
              role="button"
              tabIndex={0}
              aria-label={`${label}. Show in itinerary`}
              onMouseEnter={() => { setHoverDay(nights[0]); emitDayHover(nights[0], "map"); }}
              onMouseLeave={() => { setHoverDay(null); emitDayHover(null, "map"); }}
              onFocus={() => { setHoverDay(nights[0]); emitDayHover(nights[0], "map"); }}
              onBlur={() => { setHoverDay(null); emitDayHover(null, "map"); }}
              onClick={() => scrollToDay(nights[0])}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); scrollToDay(nights[0]); } }}
            >
              <circle className="routemap__hit" cx={x} cy={y} r={14} />
              {isHigh ? <path className="routemap__pin" d={`M${x},${y - 8} L${x + 7},${y + 5} L${x - 7},${y + 5} Z`} /> : <circle className="routemap__pin" cx={x} cy={y} r={5} />}
              <text className="routemap__label" data-always={isHigh || isEnd || undefined} x={x} y={y - 13} textAnchor={anchor}>
                {p.name}{(active || isHigh) && <tspan className="routemap__alt"> {metres(p.elevationM)}</tspan>}
              </text>
            </g>
          );
        })}
        {[{ off: startOff, at: shownVisits[0].sp, word: "from" }, { off: endOff, at: shownVisits[shownVisits.length - 1].sp, word: "to" }].map(({ off, at, word }) => {
          if (!off.length) return null;
          const city = word === "from" ? off[0] : off[off.length - 1];
          // Arrow points along the real bearing towards the off-map city.
          const dx = city.lon * kx - at.lon * kx, dy = -city.lat + at.lat;
          const len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
          const x0 = px(at), y0 = py(at), x1 = x0 + ux * 44, y1 = y0 + uy * 44;
          const ang = Math.atan2(uy, ux);
          const head = (a: number) => `${(x1 - 7 * Math.cos(ang - a)).toFixed(1)},${(y1 - 7 * Math.sin(ang - a)).toFixed(1)}`;
          return (
            <g key={word} className="routemap__off" aria-hidden="true">
              <line x1={x0} y1={y0} x2={x1} y2={y1} />
              <path d={`M${x1.toFixed(1)},${y1.toFixed(1)} L${head(0.5)} M${x1.toFixed(1)},${y1.toFixed(1)} L${head(-0.5)}`} />
            </g>
          );
        })}
        <g className="routemap__scale" transform={`translate(${PAD - 20}, ${H - 14})`} aria-hidden="true">
          <line x1={0} x2={barW} y1={0} y2={0} />
          <line x1={0} x2={0} y1={-4} y2={4} />
          <line x1={barW} x2={barW} y1={-4} y2={4} />
          <text x={barW + 6} y={4}>{nice} km</text>
        </g>
      </svg>
      <figcaption className="label">Sketch from stop coordinates: straight lines between nights, not the trail. Not for navigation.{offNote}</figcaption>
    </figure>
  );
}
