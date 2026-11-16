"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const MAX = 6000;
const TICKS = [0, 1000, 2000, 3000, 4000, 5000, 6000];
const nf = new Intl.NumberFormat("en-GB");

// Altitude bands as commonly used in mountain medicine.
const ZONES = [
  { id: "low", name: "Low", from: 0, to: 1500, note: "Little effect for most people" },
  { id: "high", name: "High", from: 1500, to: 3500, note: "Breathlessness on effort, mild symptoms possible" },
  { id: "very", name: "Very high", from: 3500, to: 5500, note: "Acclimatisation days matter here" },
  { id: "extreme", name: "Extreme", from: 5500, to: 9000, note: "Short stays only, even when acclimatised" },
] as const;
const zoneOf = (m: number) => ZONES.find((z) => m < z.to) ?? ZONES[ZONES.length - 1];

/** Share of sea-level air pressure (and so oxygen per breath), ICAO standard atmosphere. */
const oxygenPct = (m: number) => 100 * Math.pow(Math.max(0, 1 - 2.25577e-5 * m), 5.25588);
/** Water boils roughly 1 °C lower per 300 m of altitude. */
const boilC = (m: number) => 100 - m / 300;

/**
 * Signature chrome: a fixed instrument that reads the elevation (from the
 * database) of whatever holds the centre of the screen. Any element with
 * data-alt="<metres>" data-alt-label="<place>" reports; data-rail-hide
 * elements (full-bleed heroes) slide the column away.
 *
 * The gauge is a glass tube that fills to the current altitude, coloured by
 * altitude band, in front of mountain ridges that part in depth as you climb.
 * Every frame is written straight to the DOM (no React render per frame).
 * Opening the gauge shows the bands, live oxygen and boiling point, and jumps
 * to places on the page in each band.
 */
export function Altimeter() {
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLElement>(null);
  const [label, setLabel] = useState("");
  const [zone, setZone] = useState<(typeof ZONES)[number]["id"]>("low");
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const readRef = useRef<{ o2: HTMLElement | null; boil: HTMLElement | null }>({ o2: null, boil: null });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const setActive = (on: boolean) => { root.dataset.active = on ? "true" : "false"; };
    setActive(false);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let markers: HTMLElement[] = [];
    let hiders: HTMLElement[] = [];
    let target: number | null = null;
    let shown = 0;
    let lastLabel = "";
    let lastZone = "";
    let hidden = true;
    let raf = 0;

    const collect = () => {
      markers = Array.from(document.querySelectorAll<HTMLElement>("[data-alt]"));
      hiders = Array.from(document.querySelectorAll<HTMLElement>("[data-rail-hide]"));
      const c: Record<string, number> = {};
      for (const el of markers) {
        const m = Number(el.dataset.alt);
        if (Number.isFinite(m) && !el.closest("[data-rail-hide]")) c[zoneOf(m).id] = (c[zoneOf(m).id] ?? 0) + 1;
      }
      setCounts(c);
    };

    const paint = () => {
      const k = Math.min(Math.max(shown, 0), MAX) / MAX;
      // CSS reads --alt-k (0..1) for the fill, surface and ridge parallax.
      root.style.setProperty("--alt-k", k.toFixed(4));
      if (valueRef.current) valueRef.current.textContent = `${nf.format(Math.round(shown))} m`;
      const { o2, boil } = readRef.current;
      if (o2) o2.textContent = `${Math.round(oxygenPct(shown))}%`;
      if (boil) boil.textContent = `${Math.round(boilC(shown))} °C`;
      const z = zoneOf(shown).id;
      if (z !== lastZone) { lastZone = z; root.dataset.zone = z; setZone(z); }
    };

    const pick = () => {
      const mid = innerHeight * 0.5;
      const railW = root.getBoundingClientRect().width;
      const cx = railW + (innerWidth - railW) / 2;
      let best: HTMLElement | null = null;
      let bestD = Infinity;
      for (const el of markers) {
        const r = el.getBoundingClientRect();
        if (r.top > mid || r.bottom < mid) continue;
        if (r.right < railW + 40 || r.left > innerWidth - 40) continue;
        const d = Math.abs((Math.max(r.left, railW) + Math.min(r.right, innerWidth)) / 2 - cx);
        if (d < bestD) { bestD = d; best = el; }
      }
      const hide = hiders.some((el) => { const r = el.getBoundingClientRect(); return r.top < mid && r.bottom > mid; });
      return { best, hide };
    };

    const frame = () => {
      raf = 0;
      const { best, hide } = pick();
      if (best) {
        const m = Number(best.dataset.alt);
        if (Number.isFinite(m)) {
          if (target == null) shown = m;
          target = m;
          const l = best.dataset.altLabel ?? "";
          if (l !== lastLabel) { lastLabel = l; setLabel(l); }
        }
      }
      const nextHidden = hide || target == null;
      if (nextHidden !== hidden) { hidden = nextHidden; setActive(!hidden); if (hidden) setOpen(false); }
      else if ((root.dataset.active === "true") === hidden) setActive(!hidden);
      if (target != null) {
        const diff = target - shown;
        shown = reduce || Math.abs(diff) < 0.5 ? target : shown + diff * 0.12;
        paint();
        if (shown !== target) raf = requestAnimationFrame(frame);
      }
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

    collect();
    kick();
    const mo = new MutationObserver(() => { collect(); kick(); });
    mo.observe(document.body, { childList: true, subtree: true });
    addEventListener("scroll", kick, { passive: true });
    addEventListener("resize", kick);
    return () => {
      setActive(false);
      mo.disconnect();
      removeEventListener("scroll", kick);
      removeEventListener("resize", kick);
      cancelAnimationFrame(raf);
    };
  }, [pathname]);

  // Close the panel on Escape or a click elsewhere.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    addEventListener("keydown", onKey);
    addEventListener("pointerdown", onDown);
    return () => { removeEventListener("keydown", onKey); removeEventListener("pointerdown", onDown); };
  }, [open]);

  const jumpTo = (from: number, to: number) => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = Array.from(document.querySelectorAll<HTMLElement>("[data-alt]")).find((e) => {
      const m = Number(e.dataset.alt);
      return Number.isFinite(m) && m >= from && m < to && !e.closest("[data-rail-hide]");
    });
    el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  };

  const current = ZONES.find((z) => z.id === zone)!;

  return (
    <div ref={rootRef} className="altimeter" data-active="false" data-zone="low" data-open={open || undefined}>
      <button
        type="button"
        className="altimeter__gauge"
        aria-expanded={open}
        aria-controls="altimeter-panel"
        aria-label={`Altimeter: ${label || "current place"}, ${current.name} altitude. Show altitude bands`}
        onClick={() => setOpen((o) => !o)}
      >
        {/* Ridges behind the tube part in depth as altitude rises. */}
        <svg className="altimeter__ridges" viewBox="0 0 88 400" preserveAspectRatio="none" aria-hidden="true">
          <path className="r3" d="M0 250 L14 214 L24 226 L38 186 L50 204 L62 172 L76 198 L88 182 L88 400 L0 400 Z" />
          <path className="r2" d="M0 300 L12 276 L26 290 L40 252 L54 280 L66 262 L80 284 L88 270 L88 400 L0 400 Z" />
          <path className="r1" d="M0 352 L16 330 L30 342 L46 318 L60 338 L74 326 L88 340 L88 400 L0 400 Z" />
        </svg>
        <span className="altimeter__tube" aria-hidden="true">
          <span className="altimeter__fill" />
          <span className="altimeter__surface" />
          <span className="altimeter__glass" />
          {TICKS.map((t) => (
            <span key={t} className="altimeter__tick" style={{ bottom: `${(t / MAX) * 100}%` }}>
              {t % 2000 === 0 && <span>{t / 1000}k</span>}
            </span>
          ))}
        </span>
        <span className="altimeter__read" aria-hidden="true">
          <b ref={valueRef}>–</b>
          <span>{label}</span>
          <em className="altimeter__zone">{current.name}</em>
        </span>
      </button>

      <div id="altimeter-panel" className="altimeter__panel" role="region" aria-label="Altitude bands" hidden={!open}>
        <p className="altimeter__panel-head">
          <span>Oxygen per breath <b ref={(el) => { readRef.current.o2 = el; }}>–</b><small> of sea level</small></span>
          <span>Water boils at <b ref={(el) => { readRef.current.boil = el; }}>–</b></span>
        </p>
        <ol>
          {[...ZONES].reverse().map((z) => {
            const n = counts[z.id] ?? 0;
            return (
              <li key={z.id} data-zone={z.id} data-current={z.id === zone || undefined}>
                <button type="button" disabled={!n} onClick={() => { jumpTo(z.from, z.to); setOpen(false); }}>
                  <span className="altimeter__band" aria-hidden="true" />
                  <span>
                    <strong>{z.name}</strong> <span className="mono">{nf.format(z.from)}{z.to < 9000 ? `–${nf.format(z.to)}` : "+"} m</span>
                    <small>{z.note}</small>
                  </span>
                  <span className="altimeter__count">{n ? `${n} on page →` : "none here"}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="altimeter__fine">Estimates from the standard atmosphere. General guidance, not medical advice.</p>
      </div>
    </div>
  );
}
