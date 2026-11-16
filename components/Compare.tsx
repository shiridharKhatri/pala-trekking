"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

// Comparison selection (PRD section 6): up to three treks, kept in localStorage.
const KEY = "pt.compare";
const MAX = 3;
const listeners = new Set<() => void>();
let cache: { raw: string | null; list: string[] } = { raw: null, list: [] };

function readList(): string[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch {}
  if (raw === cache.raw) return cache.list;
  let list: string[] = [];
  try { list = JSON.parse(raw ?? "[]"); } catch {}
  cache = { raw, list: Array.isArray(list) ? list.slice(0, MAX) : [] };
  return cache.list;
}
function write(list: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch {}
  listeners.forEach((l) => l());
}
const EMPTY: string[] = [];
function subscribe(cb: () => void) {
  listeners.add(cb);
  addEventListener("storage", cb);
  return () => { listeners.delete(cb); removeEventListener("storage", cb); };
}
function useCompareList() {
  return useSyncExternalStore(subscribe, readList, () => EMPTY);
}

export function CompareToggle({ slug, name }: { slug: string; name: string }) {
  const list = useCompareList();
  const on = list.includes(slug);
  const full = !on && list.length >= MAX;
  return (
    <button
      type="button"
      className="btn btn--ghost btn--small compare-toggle"
      aria-pressed={on}
      disabled={full}
      title={full ? "You can compare up to three treks" : undefined}
      onClick={() => write(on ? list.filter((s) => s !== slug) : [...list, slug])}
    >
      {on ? "Comparing" : "Compare"}<span className="vh"> {name}</span>
    </button>
  );
}

export function CompareTray() {
  const list = useCompareList();
  const pathname = usePathname();
  if (!list.length || pathname.startsWith("/compare") || pathname.startsWith("/book")) return null;
  return (
    <div className="compare-tray" role="region" aria-label="Trek comparison">
      <span>{list.length} of {MAX} selected</span>
      <Link className="btn btn--small" href={`/compare?treks=${list.join(",")}`} aria-disabled={list.length < 2}>
        Compare
      </Link>
      <button type="button" className="clear" onClick={() => write([])}>Clear</button>
    </div>
  );
}
