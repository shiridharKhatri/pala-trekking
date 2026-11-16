"use client";

import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";

// Saved treks: a shortlist kept only in this browser (localStorage). No
// account, nothing sent to the server.
const KEY = "pt.saved";
const MAX = 24;
const listeners = new Set<() => void>();
let cache: { raw: string | null; list: string[] } = { raw: null, list: [] };

function readList(): string[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch {}
  if (raw === cache.raw) return cache.list;
  let list: unknown = [];
  try { list = JSON.parse(raw ?? "[]"); } catch {}
  cache = { raw, list: Array.isArray(list) ? list.filter((x): x is string => typeof x === "string").slice(0, MAX) : [] };
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
export function useSaved() {
  return useSyncExternalStore(subscribe, readList, () => EMPTY);
}

export function SaveToggle({ slug, name }: { slug: string; name: string }) {
  const list = useSaved();
  const on = list.includes(slug);
  return (
    <button
      type="button"
      className="save-toggle"
      aria-pressed={on}
      data-on={on || undefined}
      title={on ? "Saved to your shortlist" : "Save to your shortlist"}
      onClick={() => write(on ? list.filter((s) => s !== slug) : [slug, ...list])}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" /></svg>
      <span className="vh">{on ? `Remove ${name} from saved treks` : `Save ${name}`}</span>
    </button>
  );
}

/** Header link with a live count. */
export function SavedLink() {
  const n = useSaved().length;
  return (
    <Link href="/saved" className="saved-link" aria-label={`Saved treks${n ? `, ${n}` : ""}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" /></svg>
      {n > 0 && <span key={n} className="saved-link__n">{n}</span>}
    </Link>
  );
}

/**
 * The saved page receives every published trek card from the server and
 * shows only the saved ones, in the order they were saved (CSS order).
 */
export function SavedList({ children, slugs }: { children: ReactNode; slugs: string[] }) {
  const list = useSaved().filter((s) => slugs.includes(s));
  const rules = list.length
    ? `[data-saved-slug]{display:none}${list.map((s, i) => `[data-saved-slug="${s.replace(/[^a-z0-9-]/g, "")}"]{display:block;order:${i}}`).join("")}`
    : "[data-saved-slug]{display:none}";
  return (
    <>
      <style>{rules}</style>
      {list.length === 0 ? (
        <div className="empty" style={{ display: "grid", gap: "var(--sc-4)", justifyItems: "start" }}>
          <p style={{ margin: 0 }}>Nothing saved yet. Tap the heart on any trek to keep it here. Your shortlist stays in this browser only.</p>
          <Link className="btn btn--small" href="/treks">Browse treks</Link>
        </div>
      ) : (
        <div className="saved-actions">
          <p className="label" style={{ margin: 0 }}>{list.length} saved</p>
          {list.length >= 2 && <Link className="btn btn--small" href={`/compare?treks=${list.slice(0, 3).join(",")}`}>Compare {list.length > 3 ? "first three" : "these"}</Link>}
          <button type="button" className="btn btn--ghost btn--small" onClick={() => write([])}>Clear list</button>
        </div>
      )}
      <div className="catalogue__grid">{children}</div>
    </>
  );
}
