import type { ReactNode } from "react";

// Server-rendered SVG/HTML charts for the admin. No client JavaScript and no
// chart library. Marks follow the dataviz spec: thin bars with a 4px rounded
// data end, 2px lines, end-dots with a 2px surface ring, a legend whenever
// there are 2+ series, text in ink tokens (never the series colour), one axis,
// and a table view for every chart. Hover detail is native (<title>).

export const C = {
  blue: "#2a78d6", orange: "#eb6834", aqua: "#1baf7a", gray: "#898781", grayLight: "#c3c2b7",
  b250: "#86b6ef", b400: "#3987e5", b550: "#1c5cab",
};
export const STATUS_COLOR: Record<string, string> = { requested: C.blue, reviewing: C.orange, confirmed: C.aqua, declined: C.gray, cancelled: C.grayLight };

const nf = new Intl.NumberFormat("en-GB");
export const num = (n: number) => nf.format(Math.round(n));
export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e4) return `${Math.round(n / 1e3)}K`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return String(Math.round(n));
}
export const money = (n: number, cur: string, short = false) =>
  short && Math.abs(n) >= 1e4 ? `${new Intl.NumberFormat("en-GB", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(0).replace(/[\d.,\s]/g, "")}${compact(n)}` : new Intl.NumberFormat("en-GB", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);

function niceMax(v: number): number {
  if (v <= 0) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 4 ? 4 : f <= 5 ? 5 : 10;
  return n * p;
}

// ------------------------------------------------------------------ cards --
export function ChartCard({ title, sub, legend, children, table, className = "", wide = false }: {
  title: string; sub?: string; legend?: ReactNode; children: ReactNode; className?: string; wide?: boolean;
  table?: { head: string[]; rows: (string | number)[][] };
}) {
  return (
    <section className={`a-card a-chart ${wide ? "a-chart--wide" : ""} ${className}`}>
      <header className="a-chart__head">
        <div><h2>{title}</h2>{sub && <p className="a-hint">{sub}</p>}</div>
        {legend && <div className="a-legend">{legend}</div>}
      </header>
      <div className="a-chart__body">{children}</div>
      {table && (
        <details className="a-chart__table">
          <summary>View as table</summary>
          <div className="a-scroll">
            <table className="a-table">
              <thead><tr>{table.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
              <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j} className="a-num">{c}</td>))}</tr>)}</tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

export function Key({ color, children }: { color: string; children: ReactNode }) {
  return <span className="a-key"><i style={{ background: color }} />{children}</span>;
}

// -------------------------------------------------------------- stat tile --
export function StatTile({ label, value, delta, goodUp = true, spark, note, href, suffix }: {
  label: string; value: string; delta?: { pct: number | null; value: number; previous: number }; goodUp?: boolean;
  spark?: number[]; note?: string; href?: string; suffix?: string;
}) {
  const body = (
    <>
      <span className="a-stat__label">{label}</span>
      <span className="a-stat__value">{value}{suffix && <small>{suffix}</small>}</span>
      <span className="a-stat__foot">
        {delta && <DeltaChip delta={delta} goodUp={goodUp} />}
        {note && <span className="a-hint">{note}</span>}
        {spark && spark.length > 1 && <Spark values={spark} />}
      </span>
    </>
  );
  return href ? <a className="a-card a-stat a-stat--link" href={href}>{body}</a> : <div className="a-card a-stat">{body}</div>;
}

export function DeltaChip({ delta, goodUp = true }: { delta: { pct: number | null; value: number; previous: number }; goodUp?: boolean }) {
  if (delta.pct == null) return <span className="a-delta a-delta--flat">New this period</span>;
  const up = delta.pct > 0.5, down = delta.pct < -0.5;
  const good = up ? goodUp : down ? !goodUp : null;
  return (
    <span className={`a-delta ${good === null ? "a-delta--flat" : good ? "a-delta--good" : "a-delta--bad"}`} title={`Previous period: ${num(delta.previous)}`}>
      <span aria-hidden="true">{up ? "▲" : down ? "▼" : "▬"}</span>
      {Math.abs(delta.pct).toFixed(Math.abs(delta.pct) >= 10 ? 0 : 1)}%
      <span className="vh">{up ? " up" : down ? " down" : " unchanged"} on the previous period</span>
    </span>
  );
}

export function Spark({ values, color = C.blue }: { values: number[]; color?: string }) {
  const W = 84, H = 26, max = Math.max(...values, 1), min = Math.min(...values, 0);
  const pts = values.map((v, i) => [2 + (i / (values.length - 1)) * (W - 4), H - 3 - ((v - min) / (max - min || 1)) * (H - 8)] as const);
  const last = pts[pts.length - 1];
  return (
    <svg className="a-spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true" focusable="false">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeOpacity={0.55} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill={color} stroke="#fff" strokeWidth={2} />
    </svg>
  );
}

// ------------------------------------------------------------- area chart --
export function AreaChart({ data, color = C.blue, label, format = num, endLabel = true }: {
  data: { label: string; value: number }[]; color?: string; label: string; format?: (n: number) => string; endLabel?: boolean;
}) {
  const W = 480, H = 200, pl = 38, pr = 14, pt = 14, pb = 26;
  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const x = (i: number) => pl + (data.length < 2 ? 0 : (i / (data.length - 1)) * (W - pl - pr));
  const y = (v: number) => pt + (1 - v / max) * (H - pt - pb);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${H - pb} L${x(0)},${H - pb} Z`;
  const ticks = [0, 1, 2, 3, 4].map((t) => (max / 4) * t);
  const step = Math.max(1, Math.round(data.length / 5));
  const last = data[data.length - 1];
  const colW = (W - pl - pr) / Math.max(1, data.length - 1);
  return (
    <svg className="a-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#c3c2b7" : "#e1e0d9"} strokeWidth={1} />
          <text x={pl - 6} y={y(t) + 4} textAnchor="end" className="a-tick">{compact(t)}</text>
        </g>
      ))}
      {data.map((d, i) => (i % step === 0 || i === data.length - 1) && i !== data.length - 2 ? <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} className="a-tick">{d.label}</text> : null)}
      <path d={area} fill={color} fillOpacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {last && (
        <>
          <circle cx={x(data.length - 1)} cy={y(last.value)} r={4} fill={color} stroke="#fff" strokeWidth={2} />
          {endLabel && <text x={x(data.length - 1) - 8} y={Math.max(pt + 8, y(last.value) - 10)} textAnchor="end" className="a-endlabel">{format(last.value)}</text>}
        </>
      )}
      {data.map((d, i) => (
        <rect key={i} x={x(i) - colW / 2} y={pt} width={colW} height={H - pt - pb} fill="transparent"><title>{`${d.label}: ${format(d.value)}`}</title></rect>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------- column chart --
export function Columns({ data, color = C.blue, label, format = num }: { data: { label: string; value: number }[]; color?: string; label: string; format?: (n: number) => string }) {
  const W = 480, H = 190, pl = 30, pr = 10, pt = 22, pb = 28;
  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const slot = (W - pl - pr) / data.length, bw = Math.min(24, slot * 0.55);
  const y = (v: number) => pt + (1 - v / max) * (H - pt - pb);
  return (
    <svg className="a-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={pl} x2={W - pr} y1={y(max * t)} y2={y(max * t)} stroke={t === 0 ? "#c3c2b7" : "#e1e0d9"} strokeWidth={1} />
          <text x={pl - 6} y={y(max * t) + 4} textAnchor="end" className="a-tick">{compact(max * t)}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const cx = pl + slot * i + slot / 2, top = y(d.value), h = H - pb - top;
        const r = Math.min(4, bw / 2, h);
        return (
          <g key={d.label}>
            {h > 0 && <path d={`M${cx - bw / 2},${H - pb} V${top + r} Q${cx - bw / 2},${top} ${cx - bw / 2 + r},${top} H${cx + bw / 2 - r} Q${cx + bw / 2},${top} ${cx + bw / 2},${top + r} V${H - pb} Z`} fill={color} />}
            <text x={cx} y={Math.max(12, top - 6)} textAnchor="middle" className="a-endlabel">{format(d.value)}</text>
            <text x={cx} y={H - 9} textAnchor="middle" className="a-tick">{d.label}</text>
            <rect x={cx - slot / 2} y={pt} width={slot} height={H - pb - pt} fill="transparent"><title>{`${d.label}: ${format(d.value)}`}</title></rect>
          </g>
        );
      })}
    </svg>
  );
}

// ------------------------------------------------------ horizontal bars --
export function HBars({ items, color = C.blue, format = num, sub }: {
  items: { label: string; value: number; sub?: string; href?: string }[]; color?: string; format?: (n: number) => string; sub?: boolean;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  if (!items.length) return <p className="a-hint">No data in this period.</p>;
  return (
    <ul className="a-hbars">
      {items.map((it) => (
        <li key={it.label} title={`${it.label}: ${format(it.value)}${it.sub ? `, ${it.sub}` : ""}`}>
          <span className="a-hbars__label">{it.href ? <a href={it.href}>{it.label}</a> : it.label}{sub && it.sub && <small>{it.sub}</small>}</span>
          <span className="a-hbars__track"><i style={{ width: `${Math.max(1.5, (it.value / max) * 100)}%`, background: color }} /></span>
          <span className="a-hbars__value">{format(it.value)}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- donut --
export function Donut({ parts, centre, label }: { parts: { key: string; label: string; value: number; color: string }[]; centre: { big: string; small: string }; label: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const R = 62, r = 44, cx = 80, cy = 80, gap = total > 0 && parts.filter((p) => p.value > 0).length > 1 ? 0.03 : 0;
  const live = parts.filter((p) => p.value > 0);
  const paths = live.map((p, idx) => {
    const sweep = (p.value / total) * Math.PI * 2;
    const start = -Math.PI / 2 + live.slice(0, idx).reduce((s, q) => s + (q.value / total) * Math.PI * 2, 0);
    const a0 = start + gap / 2, a1 = start + sweep - gap / 2;
    const pt = (rad: number, ang: number) => `${(cx + rad * Math.cos(ang)).toFixed(2)},${(cy + rad * Math.sin(ang)).toFixed(2)}`;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return { p, d: `M${pt(R, a0)} A${R},${R} 0 ${large} 1 ${pt(R, a1)} L${pt(r, a1)} A${r},${r} 0 ${large} 0 ${pt(r, a0)} Z` };
  });
  return (
    <div className="a-donut">
      <svg viewBox="0 0 160 160" role="img" aria-label={label}>
        {total === 0 && <circle cx={cx} cy={cy} r={(R + r) / 2} fill="none" stroke="#e1e0d9" strokeWidth={R - r} />}
        {paths.map(({ p, d }) => <path key={p.key} d={d} fill={p.color}><title>{`${p.label}: ${num(p.value)} (${Math.round((p.value / total) * 100)}%)`}</title></path>)}
        <text x={cx} y={cy + 2} textAnchor="middle" className="a-donut__big">{centre.big}</text>
        <text x={cx} y={cy + 18} textAnchor="middle" className="a-tick">{centre.small}</text>
      </svg>
      <ul className="a-donut__legend">
        {parts.map((p) => (
          <li key={p.key}><Key color={p.color}>{p.label}</Key><b>{num(p.value)}</b><span className="a-hint">{total ? `${Math.round((p.value / total) * 100)}%` : "0%"}</span></li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------- segmented --
export function SegBar({ parts, format = num }: { parts: { label: string; value: number; color: string }[]; format?: (n: number) => string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div>
      <div className="a-seg" role="img" aria-label={parts.map((p) => `${p.label} ${format(p.value)}`).join(", ")}>
        {total > 0 ? parts.filter((p) => p.value > 0).map((p) => (
          <i key={p.label} style={{ flexGrow: p.value, background: p.color }} title={`${p.label}: ${format(p.value)} (${Math.round((p.value / total) * 100)}%)`}>
            {p.value / total > 0.14 ? <span>{Math.round((p.value / total) * 100)}%</span> : null}
          </i>
        )) : <i style={{ flexGrow: 1, background: "#e1e0d9" }} />}
      </div>
      <ul className="a-seg__legend">{parts.map((p) => <li key={p.label}><Key color={p.color}>{p.label}</Key><b>{format(p.value)}</b></li>)}</ul>
    </div>
  );
}

// ---------------------------------------------------------------- funnel --
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = Math.max(steps[0]?.value ?? 0, 1);
  const shades = [C.b250, C.b400, C.b550];
  return (
    <ol className="a-funnel">
      {steps.map((s, i) => (
        <li key={s.label} title={`${s.label}: ${num(s.value)}`}>
          <span className="a-funnel__label">{s.label}</span>
          <span className="a-funnel__bar"><i style={{ width: `${Math.max(2, (s.value / top) * 100)}%`, background: shades[Math.min(i, shades.length - 1)] }} /></span>
          <b>{num(s.value)}</b>
          <span className="a-hint">{i === 0 ? "" : `${Math.round((s.value / top) * 100)}% of requests`}</span>
        </li>
      ))}
    </ol>
  );
}

// -------------------------------------------------------- capacity meter --
export function Meter({ web, offline, capacity }: { web: number; offline: number; capacity: number }) {
  const cap = Math.max(capacity, 1);
  const w = Math.min(100, (web / cap) * 100), o = Math.min(100 - w, (offline / cap) * 100);
  return (
    <span className="a-meter" role="img" aria-label={`${web + offline} of ${capacity} seats taken (${web} website, ${offline} offline)`} title={`${web} website + ${offline} offline of ${capacity}`}>
      <i style={{ width: `${o}%`, background: C.orange }} />
      <i style={{ width: `${w}%`, background: C.blue }} />
    </span>
  );
}
