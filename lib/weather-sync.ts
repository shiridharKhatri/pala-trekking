"use client";

import { useSyncExternalStore } from "react";
import type { PointWeather } from "./weather";
import type { StayPoint } from "./types";
import { describe, type WeatherIcon } from "./weather-codes";
import { addDays, date } from "./format";

// One weather state for the whole trek page. The itinerary (Ascent) publishes
// the route weather it loaded and the mode the visitor picked; the 3D map
// reads the same state, so both always show the same conditions.

export type WxMode = { kind: "now" } | { kind: "departure"; start: string };
type RouteWx = { fetchedAt: string; points: Record<string, PointWeather> } | null;
type State = { weather: RouteWx; disabled: string[]; mode: WxMode; loading: boolean };

const INITIAL: State = { weather: null, disabled: [], mode: { kind: "now" }, loading: true };
let state: State = INITIAL;
const listeners = new Set<() => void>();

export function setWeatherState(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export function setWeatherMode(mode: WxMode) {
  setWeatherState({ mode });
}
export function useWeatherState(): State {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => state,
    () => INITIAL,
  );
}

export type StopReading =
  | { ok: true; icon: WeatherIcon; label: string; temp: string; when: string }
  | { ok: false; reason: string };

/**
 * What to show for one overnight stop on a given itinerary day, honestly:
 * current conditions are labelled "now", forecasts carry their date, and
 * anything missing says why instead of guessing (PRD 7.1).
 */
export function stopReading(sp: StayPoint, day: number, s: State): StopReading {
  if (s.disabled.includes(sp.id) || !sp.weatherEnabled) return { ok: false, reason: "Weather off for this stop" };
  if (s.loading) return { ok: false, reason: "Loading weather" };
  const pw = s.weather?.points[sp.id];
  if (!pw) return { ok: false, reason: "Weather unavailable" };
  const r = (n: number | null) => (n == null ? "?" : Math.round(n));
  if (s.mode.kind === "now") {
    if (!pw.current) return { ok: false, reason: "No current reading" };
    const d = describe(pw.current.code);
    return { ok: true, icon: d.icon, label: d.label, temp: `${r(pw.current.temp)}°`, when: "now" };
  }
  const target = addDays(s.mode.start, day - 1);
  const f = pw.daily.find((x) => x.date === target);
  if (!f) return { ok: false, reason: `No forecast for ${date(target, { year: undefined })} yet` };
  const d = describe(f.code);
  return { ok: true, icon: d.icon, label: d.label, temp: `${r(f.tMin)}°/${r(f.tMax)}°`, when: date(target, { year: undefined }) };
}
