"use client";

import { useEffect, useRef } from "react";

const nf = new Intl.NumberFormat("en-GB");

/**
 * A number that counts up the first time it scrolls into view. The server
 * renders the final value (SEO, no-JS, screen readers); the animation only
 * runs for numbers that start off screen, and never with reduced motion.
 * Written straight to the DOM so React does not re-render every frame.
 */
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) return; // already visible: no flash to zero
    const show = (n: number) => { el.textContent = `${nf.format(Math.round(n))}${suffix}`; };
    show(0);
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), dur = 1100;
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / dur);
        show(value * (1 - Math.pow(1 - k, 3)));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); show(value); };
  }, [value, suffix]);
  // Assistive tech reads the stable value, never the moving digits.
  return (
    <span className="countup">
      <span ref={ref} aria-hidden="true">{nf.format(value)}{suffix}</span>
      <span className="vh">{nf.format(value)}{suffix}</span>
    </span>
  );
}
