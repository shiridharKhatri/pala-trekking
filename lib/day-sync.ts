"use client";

import { useEffect } from "react";

// Tiny cross-component channel: the route map and the elevation profile both
// highlight the itinerary day the visitor is pointing at, whichever one they
// point at. Day numbers are the itinerary's own day values; null clears it.

const EVENT = "pt:day-hover";
type Detail = { day: number | null; source: string };

export function emitDayHover(day: number | null, source: string) {
  dispatchEvent(new CustomEvent<Detail>(EVENT, { detail: { day, source } }));
}

export function useDayHover(source: string, onDay: (day: number | null) => void) {
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<Detail>).detail;
      if (d.source !== source) onDay(d.day);
    };
    addEventListener(EVENT, on);
    return () => removeEventListener(EVENT, on);
  }, [source, onDay]);
}

/** Scroll the itinerary to a day, centred, respecting reduced motion. */
export function scrollToDay(day: number) {
  const el = document.getElementById(`day-${day}`);
  if (!el) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
}
