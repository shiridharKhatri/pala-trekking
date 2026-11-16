"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV: { group: string; items: { href: string; label: string; admin?: boolean }[] }[] = [
  { group: "Operations", items: [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/bookings", label: "Bookings", admin: true },
    { href: "/admin/departures", label: "Departures", admin: true },
    { href: "/admin/inquiries", label: "Inquiries", admin: true },
    { href: "/admin/advisories", label: "Route advisories", admin: true },
  ] },
  { group: "Catalogue", items: [
    { href: "/admin/treks", label: "Treks" },
    { href: "/admin/experiences", label: "Optional experiences" },
    { href: "/admin/regions", label: "Regions" },
    { href: "/admin/gateways", label: "Gateways" },
    { href: "/admin/stayPoints", label: "Stay points and weather", admin: true },
  ] },
  { group: "Content", items: [
    { href: "/admin/home", label: "Homepage" },
    { href: "/admin/pages", label: "Pages" },
    { href: "/admin/faqs", label: "FAQs" },
    { href: "/admin/media", label: "Media" },
  ] },
  { group: "Settings", items: [
    { href: "/admin/settings", label: "Currency and company", admin: true },
    { href: "/admin/users", label: "Users", admin: true },
  ] },
];

export function AdminNav({ role }: { role: "admin" | "content" }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="a-btn a-btn--small a-navtoggle" aria-expanded={open} aria-controls="a-nav" onClick={() => setOpen((o) => !o)}>{open ? "Close menu" : "Menu"}</button>
      <nav id="a-nav" className="a-nav" data-open={open} aria-label="Admin">
        {NAV.map((g) => {
          const items = g.items.filter((i) => role === "admin" || !i.admin);
          if (!items.length) return null;
          return (
            <div key={g.group}>
              <p className="a-nav__group">{g.group}</p>
              {items.map((i) => {
                const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
                return <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}>{i.label}</Link>;
              })}
            </div>
          );
        })}
      </nav>
    </>
  );
}
