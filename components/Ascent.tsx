"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ItineraryDay, PublicDeparture, StayPoint } from "@/lib/types";
import type { DailyWeather, PointWeather } from "@/lib/weather";
import { describe, compass } from "@/lib/weather-codes";
import { addDays, date, feet, km, metres, dateTime } from "@/lib/format";
import { WeatherIcon } from "./WeatherIcon";
import { emitDayHover, scrollToDay, useDayHover } from "@/lib/day-sync";
import { setWeatherMode, setWeatherState, useWeatherState, type WxMode } from "@/lib/weather-sync";

interface Props {
  itinerary: ItineraryDay[];
  stayPoints: StayPoint[];
  weather: { fetchedAt: string; points: Record<string, PointWeather> } | null;
  weatherDisabled: string[]; // stay point ids switched off by admin or advisory
  departures: PublicDeparture[];
  attribution: string;
  loading?: boolean;
}

type Mode = WxMode;

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
  const tiltRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const reduce = useSyncExternalStore(
    (cb) => { const mq = matchMedia("(prefers-reduced-motion: reduce)"); mq.addEventListener("change", cb); return () => mq.removeEventListener("change", cb); },
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  // Weather mode is shared with the 3D map, so both show the same conditions.
  const { mode } = useWeatherState();
  const setMode = setWeatherMode;
  useEffect(() => { setWeatherMode({ kind: "now" }); }, []);
  useEffect(() => { setWeatherState({ weather, disabled: weatherDisabled, loading }); }, [weather, weatherDisabled, loading]);
  // Day the visitor is pointing at (chart, list or route map), by day number.
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  useDayHover("profile", setHoverDay);
  const point = (day: number | null) => { setHoverDay(day); emitDayHover(day, "profile"); };
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
  const W = 600, H = 300, padL = 44, padR = 30, padT = 34, padB = 34;
  const DX = 14, DY = -12; // extrusion depth of the 3D ribbon
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
  // Acclimatisation: a rise of more than 500 m in sleeping altitude above
  // 3,000 m, computed from the stored stage elevations.
  const gain = new Map<number, number>();
  known.forEach((p, j) => {
    const prev = known[j - 1];
    if (prev && p.e >= 3000 && p.e - prev.e > 500) gain.set(p.i, p.e - prev.e);
  });
  const curWx = cur ? stopIcon(cur, spById, weather, weatherDisabled, mode) : null;
  const o2 = cur?.elevationM != null ? oxygenPct(cur.elevationM) : null;

  return (
    <div className="ascent">
      <div className="ascent__chart">
        {/* 3D profile: an extruded ribbon with slope-shaded faces and pins
            rising from the ground plane. Pointer movement tilts it. */}
        <div
          className="profile3d"
          ref={tiltRef}
          onPointerMove={(e) => {
            const el = tiltRef.current;
            if (!el || reduce || e.pointerType !== "mouse") return;
            const r = el.getBoundingClientRect();
            el.style.setProperty("--ry", (((e.clientX - r.left) / r.width - 0.5) * 14).toFixed(2));
            el.style.setProperty("--rx", (((e.clientY - r.top) / r.height - 0.5) * -10 + 10).toFixed(2));
          }}
          onPointerLeave={() => { tiltRef.current?.style.removeProperty("--ry"); tiltRef.current?.style.removeProperty("--rx"); }}
        >
        <svg className="profile" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="profile-title profile-desc">
          <title id="profile-title">Elevation profile by day</title>
          <desc id="profile-desc">
            {known.map((p) => `Day ${p.d.day}: ${p.d.destination}, ${metres(p.e)}`).join(". ")}
          </desc>
          <defs>
            <linearGradient id="profile-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {/* Ground plane, receding into depth */}
          <path className="profile__ground" d={`M${padL},${H - padB} L${W - padR},${H - padB} l${DX},${DY} L${padL + DX},${H - padB + DY} Z`} />
          <g className="profile__grid">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL + DX} x2={W - padR + DX} y1={y(t) + DY} y2={y(t) + DY} />
                <text x={padL - 8} y={y(t) + 4} textAnchor="end">{t === 0 ? "0" : `${t / 1000}k`}</text>
              </g>
            ))}
          </g>
          {/* Back edge of the ribbon */}
          <path className="profile__back" d={path} transform={`translate(${DX} ${DY})`} />
          {/* Ribbon top faces: lighter going up, darker going down; walked ones glow. */}
          {known.slice(1).map((q, j) => {
            const p0 = known[j];
            const up = q.e >= p0.e;
            const walked = reduce || q.i <= t;
            return (
              <path
                key={`f${q.i}`}
                className="profile__face"
                data-up={up || undefined}
                data-walked={walked || undefined}
                d={`M${x(p0.i)},${y(p0.e)} L${x(q.i)},${y(q.e)} l${DX},${DY} L${x(p0.i) + DX},${y(p0.e) + DY} Z`}
              />
            );
          })}
          <path className="profile__area" d={area} style={{ color: "var(--sc-ink)" }} />
          <path className="profile__line" d={path} opacity={0.35} />
          <path className="profile__line profile__line--draw" d={path} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - drawn} />
          {known.map((p) => {
            const passed = reduce || p.i <= active;
            const isActive = p.i === active;
            const isPeak = peak?.i === p.i;
            const isHover = hoverDay === p.d.day;
            const anchor = x(p.i) > W - 120 ? "end" : x(p.i) < padL + 60 ? "start" : "middle";
            return (
              <g
                key={p.i}
                className="profile__stop"
                data-passed={passed}
                data-active={isActive}
                data-peak={isPeak && !isActive}
                data-hover={isHover || undefined}
                onMouseEnter={() => point(p.d.day)}
                onMouseLeave={() => point(null)}
                onClick={() => scrollToDay(p.d.day)}
              >
                <ellipse className="profile__shadow" cx={x(p.i) + DX / 2} cy={H - padB + DY / 2} rx={5} ry={2} />
                <line className="profile__stake" x1={x(p.i)} x2={x(p.i)} y1={H - padB} y2={y(p.e)} />
                <circle className="profile__hit" cx={x(p.i)} cy={y(p.e)} r={14} />
                <circle cx={x(p.i)} cy={y(p.e)} r={isActive ? 7 : 4.5} />
                {(isActive || isHover || isPeak) && (
                  <text x={x(p.i)} y={y(p.e) - 13} textAnchor={anchor}>
                    {isActive || isHover ? `${p.d.destination} ${metres(p.e)}` : metres(p.e)}
                  </text>
                )}
              </g>
            );
          })}
          {[...gain].map(([i, g]) => (
            <path key={`g${i}`} className="profile__gain" d={`M${x(i)},${H - padB - 12} l5,8 h-10 z`}>
              <title>{`+${g} m in one night above 3,000 m: plan acclimatisation`}</title>
            </path>
          ))}
          {walkerE != null && (
            <g className="profile__walker" style={{ transform: `translate(${walkerX.toFixed(1)}px, ${y(walkerE).toFixed(1)}px)` }} aria-hidden="true">
              <line className="profile__walker-drop" x1={0} x2={0} y1={0} y2={H - padB - y(walkerE)} />
              <circle className="profile__walker-halo" r={11} />
              <circle className="profile__walker-dot" r={5} />
            </g>
          )}
          {curWx && cur?.elevationM != null && (() => {
            const sx = x(active), sz = 24;
            const ix = sx > W - 120 ? sx - sz : sx < padL + 60 ? sx : sx - sz / 2;
            return (
              <g className="profile__wx" key={`${active}-${curWx.kind}`}>
                <WeatherIcon kind={curWx.kind} label={curWx.label} className="profile__wx-icon" x={ix} y={y(cur.elevationM) - 13 - 14 - sz} size={sz} />
              </g>
            );
          })()}
        </svg>
        </div>
        {cur && (
          <div className="profile-readout" aria-live="polite">
            <span className="profile-readout__day">Day {cur.day}</span>
            <span className="profile-readout__place">{cur.destination}</span>
            <span className="profile-readout__alt">{metres(cur.elevationM)}</span>
            {o2 != null && (
              <span className="profile-readout__o2" title="Oxygen per breath compared with sea level (standard atmosphere estimate)">
                <span className="o2-meter" aria-hidden="true"><span style={{ transform: `scaleX(${(o2 / 100).toFixed(3)})` }} /></span>
                <span>O<sub>2</sub> <b>{Math.round(o2)}%</b><span className="vh"> of sea level</span></span>
                {gain.has(active) && <span className="profile-readout__gain" title="Big rise in sleeping altitude: plan acclimatisation">▲ +{metres(gain.get(active)!)}</span>}
              </span>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="wx-controls">
          <label className="field" style={{ minWidth: "16rem" }}>
            <span>Weather</span>
            <select
              className="input"
              value={mode.kind === "now" ? "" : mode.start}
              onChange={(e) => setMode(e.target.value ? { kind: "departure", start: e.target.value } : { kind: "now" })}
            >
              <option value="">Now</option>
              {departures.map((d) => <option key={d.id} value={d.startDate}>Forecast for {date(d.startDate)} departure</option>)}
            </select>
          </label>
          <p className="label" style={{ margin: 0, alignSelf: "end" }}>
            {loading ? "Loading weather…" : weather ? <>Updated {dateTime(weather.fetchedAt)} · {attribution}</> : "Live weather unavailable."}
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
                data-hover={hoverDay === d.day || undefined}
                onMouseEnter={() => point(d.day)}
                onMouseLeave={() => point(null)}
                data-alt={d.elevationM ?? undefined}
                data-alt-label={d.destination}
              >
                <div className="day__num">Day {d.day}</div>
                <div>
                  <h3>{d.start === d.destination ? d.destination : `${d.start} to ${d.destination}`}</h3>
                  <p>{d.activities}</p>
                  <ul className="day__meta">
                    {d.walkingHours && <li title="Walking time"><b>{d.walkingHours}</b> walk</li>}
                    {d.distanceKm != null && <li title={km(d.distanceKm, true)}><b>{km(d.distanceKm)}</b></li>}
                    {d.elevationM != null && <li title={feet(d.elevationM)}>sleep <b>{metres(d.elevationM)}</b></li>}
                    {gain.has(i) && <li className="day__gain" title="Big rise in sleeping altitude: plan acclimatisation">▲ <b>+{metres(gain.get(i)!)}</b></li>}
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
  if (loading && !disabled) return (
    <div className="wx wx--loading" aria-busy="true">
      <span className="skel" style={{ width: 34, height: 34, borderRadius: "50%" }} />
      <div className="wx__lines">
        <span className="skel" style={{ width: "9rem", height: 18 }} />
        <span className="vh">Loading weather for {sp.name}</span>
      </div>
    </div>
  );
  // Fallbacks (PRD 7, FR 08): say plainly why there is no data, then the guidance.
  const fallback = (why: string) => (
    <div className="wx wx--fallback">
      <p><b>{why}</b>{sp.seasonalGuidance && <> {sp.seasonalGuidance}</>}</p>
    </div>
  );
  if (disabled) return fallback("Live weather off for this stop.");
  if (!weather) return fallback("Weather unavailable.");

  const more = (items: (string | null | false)[]) => {
    const list = items.filter(Boolean) as string[];
    return list.length ? (
      <details className="wx__more">
        <summary>More</summary>
        <p>{list.join(" · ")}</p>
      </details>
    ) : null;
  };

  if (mode.kind === "now") {
    const c = weather.current;
    if (!c) return fallback("No current reading.");
    const d = describe(c.code);
    const sun = weather.daily[0]?.sunrise ? `Sun ${weather.daily[0].sunrise.slice(11)}–${weather.daily[0].sunset?.slice(11) ?? ""}` : null;
    return (
      <div className="wx">
        <div className="wx__row">
        <WeatherIcon kind={d.icon} label={d.label} />
        <div className="wx__main">
          <strong>{fmt(c.temp)}°</strong>
          <span>{d.label}</span>
          {c.wind != null && <span className="wx__sub">wind {fmt(c.wind)} km/h</span>}
          <span className="wx__kind" title="Conditions right now, not a forecast for your travel dates">Now, not a forecast</span>
        </div>
        </div>
        {more([c.feels != null && `Feels ${fmt(c.feels)}°`, c.gust != null && `Gusts ${fmt(c.gust)} km/h ${compass(c.windDir)}`, c.humidity != null && `Humidity ${fmt(c.humidity)}%`, sun])}
      </div>
    );
  }
  const target = addDays(mode.start, dayOffset);
  const f: DailyWeather | undefined = weather.daily.find((x) => x.date === target);
  if (!f) {
    const last = forecastDates[forecastDates.length - 1];
    const availableFrom = last ? addDays(target, -(forecastDates.length - 1)) : null;
    return fallback(`No forecast for ${date(target)} yet${availableFrom && target > last ? `; expected from ${date(availableFrom)}` : ""}.`);
  }
  const d = describe(f.code);
  return (
    <div className="wx">
      <div className="wx__row">
      <WeatherIcon kind={d.icon} label={d.label} />
      <div className="wx__main">
        <strong>{fmt(f.tMin)}° / {fmt(f.tMax)}°</strong>
        <span>{d.label}</span>
        {f.precipProb != null && <span className="wx__sub">{fmt(f.precipProb)}% precip.</span>}
        <span className="wx__kind">Forecast {date(target, { year: undefined })}</span>
      </div>
      </div>
      {more([f.feelsMin != null && `Feels ${fmt(f.feelsMin)}° at coldest`, f.snowfallCm != null && f.snowfallCm > 0 && `Snow ${f.snowfallCm} cm`, f.windMax != null && `Wind to ${fmt(f.windMax)} km/h ${compass(f.windDir)}`, f.gustMax != null && `Gusts ${fmt(f.gustMax)} km/h`, f.sunrise && `Sun ${f.sunrise.slice(11)}–${f.sunset?.slice(11) ?? ""}`])}
    </div>
  );
}
