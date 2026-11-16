"use client";

import { useRef, useState } from "react";
import { metres } from "@/lib/format";

type Series = { slug: string; name: string; points: { day: number; elevationM: number; place: string }[] };

// Ordinal palette from the dataviz skill: distinct hues, readable on both grounds.
const COLORS = ["#2a78d6", "#eb6834", "#1baf7a"];

/**
 * Compare page: every selected trek's sleeping altitude by day on one chart.
 * Pointing (or arrow keys) moves a day cursor and reads all treks at once;
 * pointing at a legend entry brings that trek forward.
 */
export function ProfileOverlay({ series }: { series: Series[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [day, setDay] = useState<number | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  const W = 760, H = 300, L = 48, R = 18, T = 18, B = 34;
  const maxDay = Math.max(...series.flatMap((s) => s.points.map((p) => p.day)), 2);
  const maxE = Math.max(...series.flatMap((s) => s.points.map((p) => p.elevationM)), 1000);
  const top = Math.ceil((maxE + 300) / 1000) * 1000;
  const x = (d: number) => L + ((d - 1) / (maxDay - 1)) * (W - L - R);
  const y = (e: number) => T + (1 - e / top) * (H - T - B);
  const ticks = Array.from({ length: top / 1000 + 1 }, (_, k) => k * 1000);
  const dayTicks = Array.from({ length: maxDay }, (_, k) => k + 1).filter((d) => maxDay <= 16 || d % 2 === 1);

  const pick = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * W;
    setDay(Math.min(maxDay, Math.max(1, Math.round(1 + ((vx - L) / (W - L - R)) * (maxDay - 1)))));
  };
  const reading = (s: Series, d: number) => s.points.find((p) => p.day === d);

  return (
    <figure className="overlay">
      <ul className="overlay__legend" aria-label="Treks on the chart">
        {series.map((s, i) => (
          <li key={s.slug}>
            <button
              type="button"
              aria-pressed={focus === s.slug}
              onMouseEnter={() => setFocus(s.slug)} onMouseLeave={() => setFocus(null)}
              onFocus={() => setFocus(s.slug)} onBlur={() => setFocus(null)}
              onClick={() => setFocus((f) => (f === s.slug ? null : s.slug))}
              style={{ ["--c" as string]: COLORS[i] }}
            >
              <i aria-hidden="true" />{s.name}
            </button>
          </li>
        ))}
      </ul>
      <svg
        ref={svgRef}
        className="overlay__chart"
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        tabIndex={0}
        aria-label="Sleeping altitude by day for the compared treks. Use left and right arrow keys to read each day."
        onPointerMove={(e) => pick(e.clientX)}
        onPointerLeave={() => setDay(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); setDay((d) => Math.min(maxDay, (d ?? 0) + 1)); }
          if (e.key === "ArrowLeft") { e.preventDefault(); setDay((d) => Math.max(1, (d ?? 2) - 1)); }
          if (e.key === "Escape") setDay(null);
        }}
        onBlur={() => setDay(null)}
      >
        <g className="overlay__grid">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
              <text x={L - 8} y={y(t) + 4} textAnchor="end">{t === 0 ? "0" : `${t / 1000}k m`}</text>
            </g>
          ))}
          {dayTicks.map((d) => <text key={d} x={x(d)} y={H - 12} textAnchor="middle">{d}</text>)}
          <text x={W - R} y={H - 0} textAnchor="end" className="overlay__axis">day</text>
        </g>
        {series.map((s, i) => {
          const d = s.points.map((p, j) => `${j ? "L" : "M"}${x(p.day).toFixed(1)},${y(p.elevationM).toFixed(1)}`).join(" ");
          const last = s.points[s.points.length - 1];
          return (
            <g key={s.slug} className="overlay__series" data-dim={(focus && focus !== s.slug) || undefined} style={{ ["--c" as string]: COLORS[i] }}>
              <path d={d} />
              {s.points.map((p) => <circle key={p.day} cx={x(p.day)} cy={y(p.elevationM)} r={day === p.day ? 5 : 2.5} />)}
              {last && <circle className="overlay__end" cx={x(last.day)} cy={y(last.elevationM)} r={4} />}
            </g>
          );
        })}
        {day != null && <line className="overlay__cursor" x1={x(day)} x2={x(day)} y1={T} y2={H - B} />}
      </svg>
      <div className="overlay__read" aria-live="polite">
        {day == null ? (
          <p className="label" style={{ margin: 0 }}>Point at the chart, or focus it and use the arrow keys, to read a day.</p>
        ) : (
          <>
            <strong>Day {day}</strong>
            {series.map((s, i) => {
              const r = reading(s, day);
              return (
                <span key={s.slug} style={{ ["--c" as string]: COLORS[i] }}>
                  <i aria-hidden="true" />{s.name}: {r ? `${r.place}, ${metres(r.elevationM)}` : "trek finished"}
                </span>
              );
            })}
          </>
        )}
      </div>
    </figure>
  );
}
