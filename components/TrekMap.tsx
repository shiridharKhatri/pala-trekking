"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, Marker, LngLatBoundsLike } from "maplibre-gl";
import type { ItineraryDay, StayPoint } from "@/lib/types";
import { metres } from "@/lib/format";
import { routeVisits } from "@/lib/route-visits";
import { darkTerrainStyle } from "@/lib/map-style";
import { emitDayHover, scrollToDay, useDayHover } from "@/lib/day-sync";
import { RouteMap } from "./RouteMap";
import { RidgeLoader } from "./Skeletons";

type State = "idle" | "loading" | "ready" | "failed";

const hasWebGL = () => {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
};

/**
 * Interactive 3D route map: real terrain, the overnight stops joined in
 * itinerary order, and markers that sync with the itinerary and profile.
 * Loaded only when the section nears the viewport; the SVG sketch stays as
 * the fallback (no WebGL, tiles blocked, or the map fails to start).
 */
export function TrekMap({ itinerary, stayPoints, trekName }: { itinerary: ItineraryDay[]; stayPoints: StayPoint[]; trekName: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Map<number, { marker: Marker; el: HTMLElement }>>(new Map());
  const homeRef = useRef<() => void>(() => {});
  const [state, setState] = useState<State>("idle");
  const [is3d, setIs3d] = useState(true);
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  useDayHover("map3d", setHoverDay);

  const route = routeVisits(itinerary, stayPoints);
  const usable = route.shown.length >= 2;

  // Highlight the marker for the day pointed at elsewhere on the page.
  useEffect(() => {
    markersRef.current.forEach(({ el }, day) => {
      const v = route.shown.find((x) => x.days.includes(hoverDay ?? -1));
      el.dataset.active = v && v.days.includes(day) ? "true" : "false";
    });
  }, [hoverDay, route.shown]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || !usable) return;
    let cancelled = false;
    let map: MlMap | null = null;
    // Failure is final: tear the map down and keep the sketch, even if the
    // style finishes loading later.
    const fail = () => {
      if (cancelled) return;
      cancelled = true;
      try { map?.remove(); } catch {}
      map = null;
      mapRef.current = null;
      setState("failed");
    };
    const markers = markersRef.current;

    const start = async () => {
      if (!hasWebGL()) { fail(); return; }
      setState("loading");
      try {
        const ml = await import("maplibre-gl");
        if (cancelled) return;
        ml.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
        const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const pts = route.shown.map((v) => [v.sp.lon, v.sp.lat] as [number, number]);
        const lons = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
        const bounds: LngLatBoundsLike = [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
        const canvas = box.querySelector<HTMLDivElement>(".tmap__canvas")!;

        map = new ml.Map({
          container: canvas,
          style: darkTerrainStyle(),
          bounds,
          fitBoundsOptions: { padding: 60 },
          pitch: reduce ? 55 : 0,
          maxPitch: 80,
          cooperativeGestures: true,
          attributionControl: { compact: true },
          fadeDuration: reduce ? 0 : 300,
        });
        mapRef.current = map;
        map.addControl(new ml.NavigationControl({ visualizePitch: true }), "top-right");
        map.addControl(new ml.FullscreenControl({ container: box }), "top-right");

        // No style after 15 s (tiles blocked, offline): show the sketch instead.
        let loaded = false;
        const failTimer = setTimeout(() => { if (!loaded) fail(); }, 15000);

        map.on("load", () => {
          if (cancelled || !map) return;
          loaded = true;
          clearTimeout(failTimer);
          const m = map;
          // Transfer legs to the gateway city: dashed, leaving the frame.
          const transfer = [
            ...(route.startOff.length ? [[...route.startOff.map((s) => [s.lon, s.lat]), pts[0]]] : []),
            ...(route.endOff.length ? [[pts[pts.length - 1], ...route.endOff.map((s) => [s.lon, s.lat])]] : []),
          ];
          m.addSource("transfer", { type: "geojson", data: { type: "FeatureCollection", features: transfer.map((c) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: c } })) } });
          m.addLayer({ id: "transfer", type: "line", source: "transfer", paint: { "line-color": "#9fabad", "line-width": 1.5, "line-dasharray": [2, 3], "line-opacity": 0.7 } });
          m.addSource("route", { type: "geojson", lineMetrics: true, data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: reduce ? pts : pts.slice(0, 1) } } });
          m.addLayer({ id: "route-glow", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#e4583e", "line-width": 10, "line-blur": 8, "line-opacity": 0.45 } });
          m.addLayer({ id: "route", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#e4583e", "line-width": 3.2 } });

          // Markers: one per stop (rest nights merged), the highest as a summit.
          const highest = route.shown.reduce((a, b) => (b.sp.elevationM > a.sp.elevationM ? b : a));
          const seen = new Set<string>();
          route.shown.forEach((v) => {
            if (seen.has(v.sp.id)) return;
            seen.add(v.sp.id);
            const nights = route.shown.filter((x) => x.sp.id === v.sp.id).flatMap((x) => x.days);
            const el = document.createElement("button");
            el.type = "button";
            el.className = "tmap__pin";
            if (v.sp.id === highest.sp.id) el.dataset.high = "true";
            el.setAttribute("aria-label", `${v.sp.name}, ${metres(v.sp.elevationM)}, night of day ${nights.join(", ")}. Show in itinerary`);
            el.innerHTML = `<i></i><span><b></b><em></em></span>`;
            el.querySelector("b")!.textContent = v.sp.name;
            el.querySelector("em")!.textContent = `${metres(v.sp.elevationM)} · day ${nights.join(", ")}`;
            el.addEventListener("mouseenter", () => { setHoverDay(nights[0]); emitDayHover(nights[0], "map3d"); });
            el.addEventListener("mouseleave", () => { setHoverDay(null); emitDayHover(null, "map3d"); });
            el.addEventListener("focus", () => { setHoverDay(nights[0]); emitDayHover(nights[0], "map3d"); });
            el.addEventListener("blur", () => { setHoverDay(null); emitDayHover(null, "map3d"); });
            el.addEventListener("click", () => scrollToDay(nights[0]));
            const marker = new ml.Marker({ element: el, anchor: "bottom" }).setLngLat([v.sp.lon, v.sp.lat]).addTo(m);
            nights.forEach((d) => markers.set(d, { marker, el }));
          });

          const home = (animate: boolean) => {
            const cam = m.cameraForBounds(bounds, { padding: { top: 70, bottom: 50, left: 50, right: 70 } });
            const opts = { ...cam, pitch: 58, bearing: -18 };
            if (animate && !reduce) m.easeTo({ ...opts, duration: 2600, easing: (t: number) => 1 - Math.pow(1 - t, 3) });
            else m.jumpTo(opts);
          };
          homeRef.current = () => home(true);
          setState("ready");

          if (reduce) { home(false); return; }
          // Cinematic entrance: tilt into the terrain while the route draws.
          home(true);
          const t0 = performance.now(), dur = 2400;
          const total = pts.length - 1;
          const step = (t: number) => {
            if (cancelled) return;
            const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 2);
            const f = e * total, i = Math.floor(f), r = f - i;
            const coords = pts.slice(0, i + 1);
            if (i < total) coords.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r]);
            (m.getSource("route") as import("maplibre-gl").GeoJSONSource | undefined)?.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } });
            if (k < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
        // Basemap health: once one basemap tile arrives, later tile errors are
        // tolerable. A basemap error before any tile (hosts blocked, offline)
        // means the map would stay empty, so fall back to the sketch.
        let gotTile = false;
        map.on("data", (e) => { if ((e as { sourceId?: string; tile?: unknown }).sourceId === "omt" && (e as { tile?: unknown }).tile) gotTile = true; });
        map.on("error", (e) => {
          const src = (e as { sourceId?: string }).sourceId;
          if (!gotTile && (src === "omt" || !src)) { clearTimeout(failTimer); fail(); }
        });
      } catch {
        fail();
      }
    };

    // Load the library only when the map is about to be seen.
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); start(); } }, { rootMargin: "300px 0px" });
    io.observe(box);
    return () => {
      cancelled = true;
      io.disconnect();
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      map?.remove();
      mapRef.current = null;
    };
    // The route is derived from props that are fixed for the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usable]);

  const toggle3d = () => {
    const m = mapRef.current;
    if (!m) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = !is3d;
    setIs3d(next);
    m.setTerrain(next ? { source: "dem", exaggeration: 1.35 } : null);
    const opts = { pitch: next ? 58 : 0, bearing: next ? -18 : 0 };
    if (reduce) m.jumpTo(opts); else m.easeTo({ ...opts, duration: 900 });
  };

  if (!usable) return null;
  if (state === "failed") return <RouteMap itinerary={itinerary} stayPoints={stayPoints} />;

  return (
    <figure className="tmap" ref={boxRef} data-state={state}>
      <div className="tmap__canvas" role="region" aria-label={`Interactive 3D map of the ${trekName} route. Use the buttons on each stop to jump to its day.`} />
      {state !== "ready" && (
        <div className="tmap__loading"><RidgeLoader label="Loading terrain" /></div>
      )}
      <div className="tmap__tools">
        <button type="button" className="tmap__btn" onClick={toggle3d} aria-pressed={is3d} disabled={state !== "ready"}>{is3d ? "3D" : "2D"}</button>
        <button type="button" className="tmap__btn" onClick={() => homeRef.current()} disabled={state !== "ready"}>Reset view</button>
      </div>
      <figcaption className="label">
        Real terrain, the line joins each night&apos;s stop in order (not the exact trail).
        {(route.startOff.length > 0 || route.endOff.length > 0) && " Dashed: transfer to the gateway city."}
        <span className="tmap__hint-mouse"> Drag to pan, Ctrl or ⌘ + scroll to zoom, right-drag to tilt.</span>
        <span className="tmap__hint-touch"> Use two fingers to move, zoom and tilt.</span>
      </figcaption>
    </figure>
  );
}
