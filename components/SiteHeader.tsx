"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CurrencySelect } from "./CurrencyProvider";
import { SavedLink } from "./Saved";
import { useCompareList } from "./Compare";

// Treks is the one menu (it holds the ways into the catalogue); the rest are
// direct links. On phones the menu shows the same structure as a list.
type Item = { href: string; label: string; note?: string };
const TREKS: Item[] = [
  { href: "/treks", label: "All treks", note: "Filter by region, days and grade" },
  { href: "/gateways/kathmandu", label: "From Kathmandu", note: "Everest, Langtang" },
  { href: "/gateways/pokhara", label: "From Pokhara", note: "Annapurna region" },
  { href: "/compare", label: "Compare", note: "Up to three side by side" },
];
const LINKS: Item[] = [
  { href: "/departures", label: "Departures" },
  { href: "/experiences", label: "Experiences" },
  { href: "/guides", label: "Guides" },
  { href: "/blog", label: "Blog" },
  { href: "/faqs", label: "FAQs" },
  { href: "/contact", label: "Contact" },
];
const GROUPS = [{ label: "Treks", items: TREKS }];

export function Mark() {
  return (
    <svg className="wordmark__mark" viewBox="0 0 144 88" aria-hidden="true">
      <path d="M 1 87 L 52 1 L 70 32 L 52 48 C 62 52 74 58 75 68 C 75 77 58 83 40 87 Z" fill="var(--sc-accent)" />
      <path d="M 90 1 L 142 87 L 85 87 C 93 84 96 78 96 71 C 96 62 83 52 64 46 Z" fill="currentColor" />
    </svg>
  );
}

export function SiteHeader() {
  return <HeaderInner pathname={usePathname()} />;
}

/** Prerendered shell used until the client knows the path. */
export function SiteHeaderFallback() {
  return <HeaderInner pathname="" />;
}

function HeaderInner({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  // Hover opens a menu; a click right after that hover must not close it again.
  const hoverAt = useRef(0);
  const compareList = useCompareList();
  const [solid, setSolid] = useState(false);
  const overHero = pathname === "/" || /^\/treks\/[^/]+$/.test(pathname);

  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) { setLastPath(pathname); setOpen(false); setMenu(null); }
  useEffect(() => {
    const on = () => setSolid(!overHero || window.scrollY > window.innerHeight * 0.6);
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, [overHero]);
  // Desktop menus close on Escape or a click outside the nav.
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); };
    const onDown = (e: PointerEvent) => { if (!navRef.current?.contains(e.target as Node)) setMenu(null); };
    addEventListener("keydown", onKey);
    addEventListener("pointerdown", onDown);
    return () => { removeEventListener("keydown", onKey); removeEventListener("pointerdown", onDown); };
  }, [menu]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header className="site-header" data-solid={solid || open}>
      <Link href="/" className="wordmark"><Mark />Pala Trekking</Link>
      <nav id="site-nav" ref={navRef} className="site-nav" data-open={open} aria-label="Main">
        {GROUPS.map((g) => {
          const active = g.items.some((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
          const id = `nav-${g.label.toLowerCase()}`;
          return (
            <div key={g.label} className="nav-group" data-open={menu === g.label || undefined} onMouseLeave={() => setMenu((m) => (m === g.label ? null : m))}>
              <button
                type="button"
                className="nav-group__btn"
                aria-expanded={menu === g.label}
                aria-controls={id}
                data-active={active || undefined}
                onClick={() => {
                  const justHovered = performance.now() - hoverAt.current < 400;
                  setMenu((m) => (m === g.label && !justHovered ? null : g.label));
                }}
                onMouseEnter={() => { hoverAt.current = performance.now(); setMenu(g.label); }}
              >
                {g.label}
                <svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
              </button>
              <ul id={id} className="nav-group__panel">
                {g.items.map((n) => {
                  // Compare opens the visitor's current selection, with its count.
                  const isCompare = n.href === "/compare";
                  const href = isCompare && compareList.length ? `/compare?treks=${compareList.join(",")}` : n.href;
                  return (
                    <li key={n.href}>
                      <Link href={href} aria-current={pathname === n.href || pathname.startsWith(n.href + "/") ? "page" : undefined} onClick={() => setMenu(null)}>
                        <span className="nav-group__label">
                          {n.label}
                          {isCompare && compareList.length > 0 && <span className="nav-count" aria-label={`, ${compareList.length} selected`}>{compareList.length}</span>}
                        </span>
                        {n.note && <span className="nav-group__note">{n.note}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        <ul className="nav-links">
          {LINKS.map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="nav-link" aria-current={pathname === n.href || pathname.startsWith(n.href + "/") ? "page" : undefined}>{n.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="header-tools">
        <SavedLink />
        <CurrencySelect />
        <Link href="/treks" className="btn btn--small">Find a trek</Link>
      </div>
      <button type="button" className="btn btn--ghost btn--small menu-toggle" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen((o) => !o)}>
        {open ? "Close" : "Menu"}
      </button>
    </header>
  );
}
