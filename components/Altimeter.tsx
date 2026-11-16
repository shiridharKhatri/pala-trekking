"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const MAX = 6000;
const TICKS = [0, 1000, 2000, 3000, 4000, 5000, 6000];
const nf = new Intl.NumberFormat("en-GB");

/**
 * Signature chrome: a fixed instrument column that reads the elevation (from
 * the database) of whatever holds the centre of the screen. Any element with
 * data-alt="<metres>" data-alt-label="<place>" reports; elements marked
 * data-rail-hide (full-bleed heroes) slide the column away while they hold
 * the centre line.
 *
 * Selection runs on one rAF loop: the candidate must cross the horizontal
 * centre line AND be horizontally on screen, and the one nearest the content
 * centre wins, so a sideways rail reports the card actually in view. The
 * needle and number ease toward the target every frame (written straight to
 * the DOM, no React render per frame) so the gauge glides rather than jumps.
 */
export function Altimeter() {
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const needleRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLElement>(null);
  const [label, setLabel] = useState("");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // Visibility lives on the element itself (data-active), never in React
    // state, so a client-side navigation can't leave a stale "visible" behind.
    const setActive = (on: boolean) => { root.dataset.active = on ? "true" : "false"; };
    setActive(false);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let markers: HTMLElement[] = [];
    let hiders: HTMLElement[] = [];
    let target: number | null = null;
    let shown = 0;
    let lastLabel = "";
    let hidden = true;
    let raf = 0;

    const collect = () => {
      markers = Array.from(document.querySelectorAll<HTMLElement>("[data-alt]"));
      hiders = Array.from(document.querySelectorAll<HTMLElement>("[data-rail-hide]"));
    };

    const scaleH = () => root.querySelector<HTMLElement>(".altimeter__scale")?.clientHeight ?? 0;

    const paint = () => {
      const h = scaleH();
      const y = h - (Math.min(Math.max(shown, 0), MAX) / MAX) * h;
      if (needleRef.current) needleRef.current.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      if (valueRef.current) valueRef.current.textContent = `${nf.format(Math.round(shown))} m`;
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
          if (target == null) shown = m; // first reading: no sweep from zero
          target = m;
          const l = best.dataset.altLabel ?? "";
          if (l !== lastLabel) { lastLabel = l; setLabel(l); }
        }
      }
      const nextHidden = hide || target == null;
      if (nextHidden !== hidden) { hidden = nextHidden; setActive(!hidden); }
      // Re-assert every frame: cheap, and self-heals any desync.
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
    // Server components stream in after mount; pick up late markers.
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

  return (
    <div ref={rootRef} className="altimeter" data-active="false" aria-hidden="true">
      <div className="altimeter__scale">
        {TICKS.map((t) => (
          <div key={t} className="altimeter__tick" style={{ top: `${100 - (t / MAX) * 100}%` }}>
            {t % 2000 === 0 && <span>{t / 1000}k</span>}
          </div>
        ))}
        <div ref={needleRef} className="altimeter__needle" />
      </div>
      <div className="altimeter__read">
        <b ref={valueRef}>–</b>
        <span>{label}</span>
      </div>
    </div>
  );
}
