"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ItineraryDay, PublicDeparture, StayPoint } from "@/lib/types";
import type { DailyWeather, PointWeather } from "@/lib/weather";
import { describe, compass } from "@/lib/weather-codes";
import { addDays, date, feet, km, metres, dateTime } from "@/lib/format";
import { WeatherIcon } from "./WeatherIcon";

interface Props {
  itinerary: ItineraryDay[];
  stayPoints: StayPoint[];
  weather: { fetchedAt: string; points: Record<string, PointWeather> } | null;
  weatherDisabled: string[]; // stay point ids switched off by admin or advisory
  departures: PublicDeparture[];
  attribution: string;
  loading?: boolean;
}

type Mode = { kind: "now" } | { kind: "departure"; start: string };

/**
 * The ascent: day-by-day itinerary with a sticky elevation profile built from
 * the stored stage elevations. Scrolling through the days draws the profile
 * and stamps each overnight stop. Weather for each stop is shown as current
 * conditions, or as the forecast for the matching day of a chosen departure
 * when that date is inside the provider's window (PRD 7.1).
 */
export function Ascent({ itinerary, stayPoints, weather, weatherDisabled, departures, attribution, loading = false }: Props) {
  const days = useMemo(() => [...itinerary].sort((a, b) => a.day - b.day), [itinerary]);
  const spById = useMemo(() => new Map(stayPoints.map((s) => [s.id, s])), [stayPoints]);
  const listRef = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const reduce = useSyncExternalStore(
    (cb) => { const mq = matchMedia("(prefers-reduced-motion: reduce)"); mq.addEventListener("change", cb); return () => mq.removeEventListener("change", cb); },
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const [mode, setMode] = useState<Mode>({ kind: "now" });
  const forecastDates = useMemo(() => {
    const first = weather && Object.values(weather.points)[0];
    return first ? first.daily.map((d) => d.date) : [];
  }, [weather]);

  // Active day + continuous draw progress from the list's position.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = Array.from(list.querySelectorAll<HTMLElement>("[data-day-index]"));
    let raf = 0;
    const update = () => {
      raf = 0;
      const mid = innerHeight * 0.5;
      let idx = 0;
      let frac = 0;
      for (let i = 0; i < items.length; i++) {
        const r = items[i].getBoundingClientRect();
        if (r.top <= mid) {
          idx = i;
          frac = Math.min(1, Math.max(0, (mid - r.top) / Math.max(1, r.height)));
        }
      }
      setActive(idx);
      const n = Math.max(1, items.length - 1);
      setProgress(Math.min(1, (idx + (idx < items.length - 1 ? frac : 0)) / n));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    return () => { removeEventListener("scroll", on); removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, [days.length]);

  // ---- chart geometry ----------------------------------------------------
  const W = 600, H = 300, padL = 44, padR = 16, padT = 24, padB = 28;
  const pts = days.map((d, i) => ({ i, d, e: d.elevationM }));
  const known = pts.filter((p) => p.e != null) as { i: number; d: ItineraryDay; e: number }[];
  const maxE = Math.max(1000, ...known.map((p) => p.e));
  const top = Math.ceil((maxE + 300) / 1000) * 1000;
  const x = (i: number) => padL + (days.length <= 1 ? 0 : (i / (days.length - 1)) * (W - padL - padR));
  const y = (e: number) => padT + (1 - e / top) * (H - padT - padB);
  const path = known.map((p, j) => `${j ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.e).toFixed(1)}`).join(" ");
  const area = known.length ? `${path} L${x(known[known.length - 1].i)},${H - padB} L${x(known[0].i)},${H - padB} Z` : "";
  const peak = known.reduce<typeof known[number] | null>((m, p) => (!m || p.e > m.e ? p : m), null);
  const ticks = Array.from({ length: top / 1000 + 1 }, (_, k) => k * 1000);
  const drawn = reduce ? 1 : progress;
  const cur = days[active];

  // The walker: rides the drawn line, interpolating the stored elevations
  // between known stages. Reduced motion parks it on the active day.
  const n = Math.max(1, days.length - 1);
  const t = reduce ? active : drawn * n;
  const before = [...known].reverse().find((p) => p.i <= t) ?? known[0];
  const after = known.find((p) => p.i >= t) ?? known[known.length - 1];
  const walkerE = before && after
    ? (after.i === before.i ? before.e : before.e + ((t - before.i) / (after.i - before.i)) * (after.e - before.e))
    : null;
  const walkerX = known.length ? x(Math.min(Math.max(t, known[0].i), known[known.length - 1].i)) : 0;
  const curWx = cur ? stopIcon(cur, spById, weather, weatherDisabled, mode) : null;
  const o2 = cur?.elevationM != null ? oxygenPct(cur.elevationM) : null;

  return (
    <div className="ascent">
      <div className="ascent__chart">
        <svg className="profile" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="profile-title profile-desc">
          <title id="profile-title">Elevation profile by day</title>
          <desc id="profile-desc">
            {known.map((p) => `Day ${p.d.day}: ${p.d.destination}, ${metres(p.e)}`).join(". ")}
          </desc>
          <defs>
            <linearGradient id="profile-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g className="profile__grid">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} />
                <text x={padL - 8} y={y(t) + 4} textAnchor="end">{t === 0 ? "0" : `${t / 1000}k`}</text>
              </g>
            ))}
          </g>
          <path className="profile__area" d={area} style={{ color: "var(--sc-ink)" }} />
          <path className="profile__line" d={path} opacity={0.35} />
          <path className="profile__line profile__line--draw" d={path} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - drawn} />
          {known.map((p) => {
            const passed = reduce || p.i <= active;
            const isActive = p.i === active;
            const isPeak = peak?.i === p.i;
            const anchor = x(p.i) > W - 120 ? "end" : x(p.i) < padL + 60 ? "start" : "middle";
            return (
              <g key={p.i} className="profile__stop" data-passed={passed} data-active={isActive} data-peak={isPeak && !isActive}>
                <circle cx={x(p.i)} cy={y(p.e)} r={isActive ? 7 : 4.5} />
                <text x={x(p.i)} y={y(p.e) - 13} textAnchor={anchor}>
                  {isActive ? `${p.d.destination} ${metres(p.e)}` : `${metres(p.e)}`}
                </text>
              </g>
            );
          })}
          {walkerE != null && (
            <g className="profile__walker" style={{ transform: `translate(${walkerX.toFixed(1)}px, ${y(walkerE).toFixed(1)}px)` }} aria-hidden="true">
              <line className="profile__walker-drop" x1={0} x2={0} y1={0} y2={H - padB - y(walkerE)} />
              <circle className="profile__walker-halo" r={11} />
              <circle className="profile__walker-dot" r={5} />
            </g>
          )}
          {curWx && cur?.elevationM != null && (() => {
            // Weather for tonight's stop pops in above the active stop's label.
            const sx = x(active), sz = 24;
            const ix = sx > W - 120 ? sx - sz : sx < padL + 60 ? sx : sx - sz / 2;
            return (
              <g className="profile__wx" key={`${active}-${curWx.kind}`}>
                <WeatherIcon kind={curWx.kind} label={curWx.label} className="profile__wx-icon" x={ix} y={y(cur.elevationM) - 13 - 14 - sz} size={sz} />
              </g>
            );
          })()}
        </svg>
        {cur && (
          <div className="profile-readout" aria-live="polite">
            <span className="profile-readout__day">Day {cur.day}</span>
            <span className="profile-readout__place">{cur.destination}</span>
            <span className="profile-readout__alt">{metres(cur.elevationM)}</span>
            {o2 != null && (
              <span className="profile-readout__o2" title="Estimate from the standard atmosphere. Real values shift with weather and season.">
                <span className="o2-meter" aria-hidden="true"><span style={{ transform: `scaleX(${(o2 / 100).toFixed(3)})` }} /></span>
                <span>Oxygen ≈ <b>{Math.round(o2)}%</b> of sea level</span>
              </span>
            )}
            <span className="profile-readout__wx">{readoutWeather(cur, spById, weather, weatherDisabled, mode)}</span>
          </div>
        )}
      </div>

      <div>
        <div className="wx-controls">
          <label className="field" style={{ minWidth: "16rem" }}>
            <span>Weather shown for</span>
            <select
              className="input"
              value={mode.kind === "now" ? "" : mode.start}
              onChange={(e) => setMode(e.target.value ? { kind: "departure", start: e.target.value } : { kind: "now" })}
            >
              <option value="">Current conditions at each stop</option>
              {departures.map((d) => <option key={d.id} value={d.startDate}>Departure on {date(d.startDate)}</option>)}
            </select>
          </label>
          <p className="label" style={{ margin: 0, alignSelf: "end" }}>
            {loading ? "Loading weather for each stop…" : weather ? <>Updated {dateTime(weather.fetchedAt)}. {attribution}</> : "Live weather is unavailable right now."}
          </p>
        </div>
        <ol className="days" ref={listRef}>
          {days.map((d, i) => {
            const sp = d.stayPointId ? spById.get(d.stayPointId) : undefined;
            return (
              <li
                key={d.day}
                className="day"
                id={`day-${d.day}`}
                data-day-index={i}
                data-active={i === active}
                data-alt={d.elevationM ?? undefined}
                data-alt-label={d.destination}
              >
                <div className="day__num">Day {d.day}</div>
                <div>
                  <h3>{d.start === d.destination ? d.destination : `${d.start} to ${d.destination}`}</h3>
                  <p>{d.activities}</p>
                  <ul className="day__meta">
                    {d.walkingHours && <li>Walking <b>{d.walkingHours}</b></li>}
                    {d.distanceKm != null && <li>Distance <b>{km(d.distanceKm, true)}</b></li>}
                    {d.elevationM != null && <li>Sleep at <b>{metres(d.elevationM)}</b> ({feet(d.elevationM)})</li>}
                  </ul>
                  {sp && (
                    <StopWeather
                      sp={sp}
                      dayOffset={d.day - 1}
                      weather={weather?.points[sp.id] ?? null}
                      disabled={weatherDisabled.includes(sp.id) || !sp.weatherEnabled}
                      mode={mode}
                      forecastDates={forecastDates}
                      loading={loading}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function readoutWeather(day: ItineraryDay, spById: Map<string, StayPoint>, weather: Props["weather"], disabled: string[], mode: Mode): string {
  const sp = day.stayPointId ? spById.get(day.stayPointId) : undefined;
  if (!sp) return "No overnight stop on this day.";
  if (disabled.includes(sp.id) || !sp.weatherEnabled) return `${sp.name}: weather not shown for this stop.`;
  const pw = weather?.points[sp.id];
  if (!pw) return `${sp.name}: live weather unavailable.`;
  if (mode.kind === "now" && pw.current) {
    const c = pw.current;
    return `${sp.name} now: ${describe(c.code).label}, ${Math.round(c.temp ?? 0)}°C, wind ${Math.round(c.wind ?? 0)} km/h`;
  }
  if (mode.kind === "departure") {
    const target = addDays(mode.start, day.day - 1);
    const f = pw.daily.find((x) => x.date === target);
    if (f) return `${sp.name}, forecast ${date(target)}: ${describe(f.code).label}, ${fmt(f.tMin)} to ${fmt(f.tMax)}°C`;
    return `${sp.name}: forecast for ${date(target)} not yet available.`;
  }
  return sp.name;
}

/** Share of sea-level oxygen per breath: air pressure ratio from the ICAO standard atmosphere. */
function oxygenPct(m: number): number {
  return 100 * Math.pow(Math.max(0, 1 - 2.25577e-5 * m), 5.25588);
}

/** Icon for the active day's stop in the chosen weather mode, or null when there is nothing honest to show. */
function stopIcon(day: ItineraryDay, spById: Map<string, StayPoint>, weather: Props["weather"], disabled: string[], mode: Mode) {
  const sp = day.stayPointId ? spById.get(day.stayPointId) : undefined;
  if (!sp || disabled.includes(sp.id) || !sp.weatherEnabled) return null;
  const pw = weather?.points[sp.id];
  if (!pw) return null;
  const code = mode.kind === "now" ? pw.current?.code : pw.daily.find((f) => f.date === addDays(mode.start, day.day - 1))?.code;
  if (code == null) return null;
  const d = describe(code);
  return { kind: d.icon, label: `${sp.name}: ${d.label}` };
}

const fmt = (n: number | null) => (n == null ? "?" : Math.round(n));

function StopWeather({ sp, dayOffset, weather, disabled, mode, forecastDates, loading }: {
  sp: StayPoint; dayOffset: number; weather: PointWeather | null; disabled: boolean; mode: Mode; forecastDates: string[]; loading: boolean;
}) {
  const head = <span className="wx__kind">{sp.name} · {metres(sp.elevationM)}</span>;
  if (loading && !disabled) return (
    <div className="wx wx--loading" aria-busy="true">
      <span className="skel" style={{ width: 34, height: 34, borderRadius: "50%" }} />
      <div className="wx__lines">
        <span className="skel" style={{ width: "9rem", height: 18 }} />
        <span className="skel" style={{ width: "min(16rem, 90%)", height: 10 }} />
        <span className="vh">Loading weather for {sp.name}</span>
      </div>
    </div>
  );
  if (disabled) {
    return (
      <div className="wx wx--fallback">
        {head}
        <p>Live weather is switched off for this stop. {sp.seasonalGuidance}</p>
      </div>
    );
  }
  if (!weather) {
    return (
      <div className="wx wx--fallback">
        {head}
        <p>Weather data is unavailable at the moment. {sp.seasonalGuidance && <>Seasonal guidance: {sp.seasonalGuidance}</>}</p>
      </div>
    );
  }
  if (mode.kind === "now") {
    const c = weather.current;
    if (!c) return <div className="wx wx--fallback">{head}<p>No current conditions reported.</p></div>;
    const d = describe(c.code);
    return (
      <div className="wx">
        <WeatherIcon kind={d.icon} label={d.label} />
        <div className="wx__main">
          <strong>{fmt(c.temp)}°C</strong>
          <span>{d.label}</span>
          <span className="wx__kind">Current, not a forecast for your dates</span>
        </div>
        <div className="wx__detail">
          {head}
          {c.feels != null && <span>Feels like {fmt(c.feels)}°C</span>}
          {c.wind != null && <span>Wind {fmt(c.wind)} km/h {compass(c.windDir)}</span>}
          {c.gust != null && <span>Gusts {fmt(c.gust)} km/h</span>}
          {c.humidity != null && <span>Humidity {fmt(c.humidity)}%</span>}
          {weather.daily[0]?.sunrise && <span>Sunrise {weather.daily[0].sunrise.slice(11)} · Sunset {weather.daily[0].sunset?.slice(11)}</span>}
        </div>
      </div>
    );
  }
  const target = addDays(mode.start, dayOffset);
  const f: DailyWeather | undefined = weather.daily.find((x) => x.date === target);
  if (!f) {
    const last = forecastDates[forecastDates.length - 1];
    const availableFrom = last ? addDays(target, -(forecastDates.length - 1)) : null;
    return (
      <div className="wx wx--fallback">
        {head}
        <p>
          A forecast for {date(target)} is not available yet{availableFrom && target > last ? <>; it should appear from about {date(availableFrom)}</> : ""}.
          {sp.seasonalGuidance && <> Seasonal guidance: {sp.seasonalGuidance}</>}
        </p>
      </div>
    );
  }
  const d = describe(f.code);
  return (
    <div className="wx">
      <WeatherIcon kind={d.icon} label={d.label} />
      <div className="wx__main">
        <strong>{fmt(f.tMin)} to {fmt(f.tMax)}°C</strong>
        <span>{d.label}</span>
        <span className="wx__kind">Forecast for {date(target)}</span>
      </div>
      <div className="wx__detail">
        {head}
        {f.feelsMin != null && <span>Feels like {fmt(f.feelsMin)}°C at coldest</span>}
        {f.precipProb != null && <span>Precipitation {fmt(f.precipProb)}%</span>}
        {f.snowfallCm != null && f.snowfallCm > 0 && <span>Snow {f.snowfallCm} cm</span>}
        {f.windMax != null && <span>Wind up to {fmt(f.windMax)} km/h {compass(f.windDir)}</span>}
        {f.gustMax != null && <span>Gusts {fmt(f.gustMax)} km/h</span>}
        {f.sunrise && <span>Sunrise {f.sunrise.slice(11)} · Sunset {f.sunset?.slice(11)}</span>}
      </div>
    </div>
  );
}
