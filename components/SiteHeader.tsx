"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CurrencySelect } from "./CurrencyProvider";

const NAV = [
  { href: "/treks", label: "Treks" },
  { href: "/gateways/kathmandu", label: "Kathmandu" },
  { href: "/gateways/pokhara", label: "Pokhara" },
  { href: "/departures", label: "Departures" },
  { href: "/experiences", label: "Experiences" },
  { href: "/faqs", label: "FAQs" },
];

export function Mark() {
  return (
    <svg className="wordmark__mark" viewBox="0 0 18 14" aria-hidden="true">
      <path d="M0 14 L6.5 3 L9.5 8 L12 4.5 L18 14 Z" fill="currentColor" />
      <path d="M6.5 3 L5 5.6 L6.5 5 L8 5.6 Z" fill="var(--sc-accent)" />
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
  const [solid, setSolid] = useState(false);
  const overHero = pathname === "/" || /^\/treks\/[^/]+$/.test(pathname);

  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) { setLastPath(pathname); setOpen(false); }
  useEffect(() => {
    const on = () => setSolid(!overHero || window.scrollY > window.innerHeight * 0.6);
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, [overHero]);
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
      <nav id="site-nav" className="site-nav" data-open={open} aria-label="Main">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={pathname === n.href || pathname.startsWith(n.href + "/") ? "page" : undefined}>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="header-tools">
        <CurrencySelect />
        <Link href="/treks" className="btn btn--small">Find a trek</Link>
      </div>
      <button type="button" className="btn btn--ghost btn--small menu-toggle" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen((o) => !o)}>
        {open ? "Close" : "Menu"}
      </button>
    </header>
  );
}
