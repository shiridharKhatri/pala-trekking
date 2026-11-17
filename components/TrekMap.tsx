"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { Map as MlMap, Marker, LngLatBoundsLike, GeoJSONSource } from "maplibre-gl";
import type { ItineraryDay, PublicDeparture, RouteTrack, StayPoint } from "@/lib/types";
import { date, metres } from "@/lib/format";
import { setWeatherMode, stopReading, useWeatherState } from "@/lib/weather-sync";
import { WeatherIcon } from "./WeatherIcon";
import { routeVisits, trailLegs, type TrailLeg } from "@/lib/route-visits";
import { darkTerrainStyle } from "@/lib/map-style";
import { emitDayHover, scrollToDay, useDayHover } from "@/lib/day-sync";
import { RouteMap } from "./RouteMap";
import { RidgeLoader } from "./Skeletons";

type State = "idle" | "loading" | "ready" | "failed";
type Pin = { sp: StayPoint; nights: number[]; slot: HTMLElement };
type Tour = { i: number; playing: boolean };

/** Compass bearing (degrees) from a to b, so the camera faces the way you walk. */
const bearingTo = (a: StayPoint, b: StayPoint) => {
  const r = Math.PI / 180;
  const y = Math.sin((b.lon - a.lon) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lon - a.lon) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The trail revealed up to `n` legs (fractional = part of a leg), one feature per leg. */
function legsUpTo(legs: TrailLeg[], n: number) {
  const features = [];
  for (let j = 0; j < legs.length && n > j; j++) {
    const c = legs[j].coords, frac = Math.min(1, n - j);
    const coords = frac >= 1 ? c : c.slice(0, Math.max(2, Math.ceil(c.length * frac)));
    features.push({ type: "Feature" as const, properties: { approx: legs[j].approx }, geometry: { type: "LineString" as const, coordinates: coords } });
  }
  return { type: "FeatureCollection" as const, features };
}

/** Live or forecast weather for one stop, inside its map marker. */
function PinWeather({ sp, night }: { sp: StayPoint; night: number }) {
  const wx = stopReading(sp, night, useWeatherState());
  if (!wx.ok) return null;
  return (
    <span className="tmap__wxbadge" title={`${wx.label}, ${wx.when === "now" ? "now (not a forecast)" : `forecast ${wx.when}`}`}>
      <WeatherIcon kind={wx.icon} label={wx.label} className="tmap__wxicon" />
      {wx.temp}
    </span>
  );
}

const hasWebGL = () => {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
};

/**
 * Interactive 3D route map: real terrain, the overnight stops joined in
 * itinerary order, and markers that sync with the itinerary and profile.
 * Loaded only when the section nears the viewport; the SVG sketch stays as
 * the fallback (no WebGL, tiles blocked, or the map fails to start).
 */
export function TrekMap({ itinerary, stayPoints, trekName, departures = [], track = null }: { itinerary: ItineraryDay[]; stayPoints: StayPoint[]; trekName: string; departures?: PublicDeparture[]; track?: RouteTrack | null }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Map<number, { marker: Marker; el: HTMLElement }>>(new Map());
  const homeRef = useRef<() => void>(() => { });
  const [state, setState] = useState<State>("idle");
  const [is3d, setIs3d] = useState(true);
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [tour, setTour] = useState<Tour | null>(null);
  const tourToken = useRef(0);
  const reduce = useSyncExternalStore(
    (cb) => { const mq = matchMedia("(prefers-reduced-motion: reduce)"); mq.addEventListener("change", cb); return () => mq.removeEventListener("change", cb); },
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const weather = useWeatherState();
  useDayHover("map3d", setHoverDay);

  const route = routeVisits(itinerary, stayPoints);
  const legs = trailLegs(route.shown, track);
  const traced = legs.some((l) => !l.approx);
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
      try { map?.remove(); } catch { }
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
        const all = legs.flatMap((l) => l.coords).concat(pts);
        const lons = all.map((p) => p[0]), lats = all.map((p) => p[1]);
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
          // Traced legs are drawn as the trail; untraced legs only as a thin
          // dashed join, so a guessed line never looks like a real path.
          const isTrail: ["!=", ["get", string], boolean] = ["!=", ["get", "approx"], true];
          m.addSource("route", { type: "geojson", data: legsUpTo(legs, reduce ? legs.length : 0) });
          m.addLayer({ id: "route-glow", type: "line", source: "route", filter: isTrail, layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#e4583e", "line-width": 9, "line-blur": 7, "line-opacity": 0.4 } });
          m.addLayer({ id: "route", type: "line", source: "route", filter: isTrail, layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#e4583e", "line-width": 3 } });
          m.addLayer({ id: "route-approx", type: "line", source: "route", filter: ["==", ["get", "approx"], true], paint: { "line-color": "#e4583e", "line-width": 1.6, "line-dasharray": [1.5, 2.5], "line-opacity": 0.85 } });

          // Markers: one per stop (rest nights merged), the highest as a summit.
          const highest = route.shown.reduce((a, b) => (b.sp.elevationM > a.sp.elevationM ? b : a));
          const seen = new Set<string>();
          const pinList: Pin[] = [];
          route.shown.forEach((v) => {
            if (seen.has(v.sp.id)) return;
            seen.add(v.sp.id);
            const nights = route.shown.filter((x) => x.sp.id === v.sp.id).flatMap((x) => x.days);
            const el = document.createElement("button");
            el.type = "button";
            el.className = "tmap__pin";
            if (v.sp.id === highest.sp.id) el.dataset.high = "true";
            el.setAttribute("aria-label", `${v.sp.name}, ${metres(v.sp.elevationM)}, night of day ${nights.join(", ")}. Show in itinerary`);
            el.innerHTML = `<i></i><span><b></b><em></em></span><span class="tmap__wx"></span>`;
            el.querySelector("b")!.textContent = v.sp.name;
            el.querySelector("em")!.textContent = `${metres(v.sp.elevationM)} · day ${nights.join(", ")}`;
            el.addEventListener("mouseenter", () => { setHoverDay(nights[0]); emitDayHover(nights[0], "map3d"); });
            el.addEventListener("mouseleave", () => { setHoverDay(null); emitDayHover(null, "map3d"); });
            el.addEventListener("focus", () => { setHoverDay(nights[0]); emitDayHover(nights[0], "map3d"); });
            el.addEventListener("blur", () => { setHoverDay(null); emitDayHover(null, "map3d"); });
            el.addEventListener("click", () => scrollToDay(nights[0]));
            const marker = new ml.Marker({ element: el, anchor: "bottom" }).setLngLat([v.sp.lon, v.sp.lat]).addTo(m);
            nights.forEach((d) => markers.set(d, { marker, el }));
            pinList.push({ sp: v.sp, nights, slot: el.querySelector<HTMLElement>(".tmap__wx")! });
          });
          setPins(pinList);
          // The walked part of the route, lit up during the fly-through.
          m.addSource("walked", { type: "geojson", data: legsUpTo(legs, 0) });
          m.addLayer({ id: "walked", type: "line", source: "walked", filter: isTrail, layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#ffb39e", "line-width": 4.5, "line-opacity": 0.95 } });
          // Any manual drag or zoom pauses the tour.
          const pause = () => { tourToken.current++; setTour((t) => (t ? { ...t, playing: false } : t)); };
          m.on("dragstart", pause);
          m.on("wheel", pause);

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
          let t0: number | null = null;
          const dur = traced ? 3200 : 2400;
          const step = (t: number) => {
            if (cancelled) return;
            if (t0 === null) t0 = t;
            const k = Math.min(1, Math.max(0, (t - t0) / dur)), e = 1 - Math.pow(1 - k, 2);
            (m.getSource("route") as GeoJSONSource | undefined)?.setData(legsUpTo(legs, e * legs.length));
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

  // ---- Fly the route ------------------------------------------------------
  // One step per night stop (rest nights merged), in itinerary order.
  const stops = route.shown;
  const showStop = async (i: number, animate: boolean) => {
    const m = mapRef.current;
    if (!m) return;
    const v = stops[i];
    // Face the way the trail arrives: from a point a little back along the leg.
    const leg = i > 0 ? legs[i - 1].coords : null;
    const from = leg && leg.length > 1 ? leg[Math.max(0, leg.length - 12)] : null;
    const bearing = from && (from[0] !== v.sp.lon || from[1] !== v.sp.lat)
      ? bearingTo({ lon: from[0], lat: from[1] } as StayPoint, v.sp)
      : m.getBearing();
    (m.getSource("walked") as GeoJSONSource | undefined)?.setData(legsUpTo(legs, i));
    setHoverDay(v.days[0]);
    emitDayHover(v.days[0], "map3d");
    // Frame the stop in the space above the tour card, never under it.
    const narrow = m.getContainer().clientWidth < 600;
    const padding = narrow ? { top: 60, bottom: 190, left: 20, right: 20 } : { top: 70, bottom: 150, left: 60, right: 60 };
    const cam = { center: [v.sp.lon, v.sp.lat] as [number, number], zoom: 14.6, pitch: 62, bearing, padding }; // village scale: OSM buildings and named lodges show
    if (!animate) { m.jumpTo(cam); return; }
    m.flyTo({ ...cam, duration: 3200, essential: true });
    await new Promise<void>((res) => m.once("moveend", () => res()));
  };
  const play = async (from: number) => {
    const token = ++tourToken.current;
    for (let i = from; i < stops.length; i++) {
      if (tourToken.current !== token) return;
      setTour({ i, playing: true });
      await showStop(i, true);
      if (tourToken.current !== token) return;
      await sleep(1800);
    }
    if (tourToken.current === token) setTour({ i: stops.length - 1, playing: false });
  };
  const startTour = () => {
    if (reduce) { setTour({ i: 0, playing: false }); showStop(0, false); return; }
    play(tour && tour.i < stops.length - 1 ? tour.i : 0);
  };
  const pauseTour = () => { tourToken.current++; setTour((t) => (t ? { ...t, playing: false } : t)); };
  const stepTour = (d: number) => {
    tourToken.current++;
    const i = Math.min(stops.length - 1, Math.max(0, (tour?.i ?? -1) + d));
    setTour({ i, playing: false });
    showStop(i, !reduce);
  };
  const goTo = (i: number) => {
    tourToken.current++;
    setTour({ i, playing: false });
    showStop(i, !reduce);
  };
  const replay = () => (reduce ? goTo(0) : play(0));
  const endTour = () => {
    tourToken.current++;
    setTour(null);
    setHoverDay(null);
    emitDayHover(null, "map3d");
    (mapRef.current?.getSource("walked") as GeoJSONSource | undefined)?.setData(legsUpTo(legs, 0));
    homeRef.current();
  };
  const cur = tour ? stops[tour.i] : null;
  const curWx = cur ? stopReading(cur.sp, cur.days[0], weather) : null;

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
    <figure className="tmap" ref={boxRef} data-state={state} data-touring={tour ? "" : undefined}>
      <div className="tmap__stage">
        <div className="tmap__canvas" role="region" aria-label={`Interactive 3D map of the ${trekName} route. Use the buttons on each stop to jump to its day.`} />
        {state !== "ready" && (
          <div className="tmap__loading"><RidgeLoader label="Loading terrain" /></div>
        )}
        <div className="tmap__tools">
          <button type="button" className="tmap__btn" onClick={toggle3d} aria-pressed={is3d} disabled={state !== "ready"}>{is3d ? "3D" : "2D"}</button>
          <button type="button" className="tmap__btn" onClick={() => (tour ? endTour() : homeRef.current())} disabled={state !== "ready"}>Reset view</button>
          {departures.length > 0 && (
            <select
              className="tmap__btn tmap__select"
              aria-label="Weather on the map"
              value={weather.mode.kind === "now" ? "" : weather.mode.start}
              onChange={(e) => setWeatherMode(e.target.value ? { kind: "departure", start: e.target.value } : { kind: "now" })}
              disabled={state !== "ready"}
            >
              <option value="">Weather now</option>
              {departures.map((d) => <option key={d.id} value={d.startDate}>Forecast: {date(d.startDate, { year: undefined })} departure</option>)}
            </select>
          )}
        </div>
        {state === "ready" && (
          <div className="tmap__play">
            {!tour ? (
              <button type="button" className="tmap__fly" onClick={startTour}>
                <span aria-hidden="true">▶</span> {reduce ? "Step through the route" : "Fly the route"}
              </button>
            ) : (
              <div className="tmap__tour" role="group" aria-label="Route tour">
                <div className="tmap__tourhead">
                  <span className="tmap__tourday">Day {cur!.days.join("–")}</span>
                  <button type="button" className="tmap__tourclose" onClick={endTour} aria-label="End tour">✕</button>
                </div>
                <div aria-live="polite">
                  <strong className="tmap__tourname">{cur!.sp.name}</strong>
                  <span className="tmap__tourmeta">
                    <span>{metres(cur!.sp.elevationM)}</span>
                  {tour.i > 0 && (legs[tour.i - 1].approx
                    ? <span className="tmap__tourmuted" title="No mapped path between these stops in OpenStreetMap">route not mapped</span>
                    : <span title={`Walking distance from ${stops[tour.i - 1].sp.name}, along mapped paths`}>{legs[tour.i - 1].km} km walk</span>)}
                    {curWx?.ok && (
                      <span className="tmap__tourwx" title={curWx.when === "now" ? "Current conditions, not a forecast for your dates" : `Forecast for ${curWx.when}`}>
                        <WeatherIcon kind={curWx.icon} label={curWx.label} className="tmap__wxicon" />
                        {curWx.temp} {curWx.label.toLowerCase()}
                        <em>{curWx.when === "now" ? "now" : curWx.when}</em>
                      </span>
                    )}
                    {curWx && !curWx.ok && <span className="tmap__tourmuted">{curWx.reason}</span>}
                  </span>
                </div>
                <div className="tmap__tourfoot">
                  <ol className="tmap__dots" aria-label="Stops">
                    {stops.map((s, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          data-state={i < tour.i ? "done" : i === tour.i ? "here" : undefined}
                          aria-current={i === tour.i ? "step" : undefined}
                          aria-label={`Day ${s.days.join("–")}: ${s.sp.name}`}
                          title={s.sp.name}
                          onClick={() => goTo(i)}
                        />
                      </li>
                    ))}
                  </ol>
                  <div className="tmap__tourctl">
                    <button type="button" onClick={() => stepTour(-1)} aria-label="Previous stop" data-hidden={tour.i === 0 || undefined}>‹</button>
                    {tour.i === stops.length - 1 && !tour.playing ? (
                      <button type="button" className="tmap__tourmain" onClick={replay} aria-label="Replay the route">↺</button>
                    ) : !reduce ? (
                      tour.playing
                        ? <button type="button" className="tmap__tourmain" onClick={pauseTour} aria-label="Pause">❚❚</button>
                        : <button type="button" className="tmap__tourmain" onClick={startTour} aria-label="Play">▶</button>
                    ) : null}
                    <button type="button" onClick={() => stepTour(1)} aria-label="Next stop" data-hidden={tour.i === stops.length - 1 || undefined}>›</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {pins.map((p) => createPortal(<PinWeather sp={p.sp} night={p.nights[0]} />, p.slot, p.sp.id))}
    </figure>
  );
}
