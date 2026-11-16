import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/data/public";
import { InquiryForm } from "@/components/InquiryForm";
import { countryOptions } from "@/lib/countries";

export const metadata: Metadata = { title: "Contact", description: "Contact Pala Trekking about treks, departures and booking requests.", alternates: { canonical: "/contact" } };

export default async function ContactPage() {
  const { company: c } = await getSettings();
  const hasDetails = c.email || c.phone || c.whatsapp || c.address;
  return (
    <>
      <header className="page-head wrap">
        <ol className="crumbs"><li><Link href="/">Home</Link></li><li>Contact</li></ol>
        <h1 className="display display--lg">Contact us</h1>
        <p className="lede">Questions about a trek, a date or a group? Send a message.</p>
      </header>
      <section className="wrap detail-grid" style={{ paddingBottom: "var(--sc-section)" }}>
        <InquiryForm countries={countryOptions()} />
        <aside className="book-panel">
          {hasDetails ? (
            <dl className="facts" style={{ gridTemplateColumns: "1fr" }}>
              {c.email && <div><dt>Email</dt><dd><a href={`mailto:${c.email}`}>{c.email}</a></dd></div>}
              {c.phone && <div><dt>Phone</dt><dd><a href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a></dd></div>}
              {c.whatsapp && <div><dt>WhatsApp</dt><dd>{c.whatsapp}</dd></div>}
              {c.address && <div><dt>Office</dt><dd style={{ fontWeight: 400 }}>{c.address}</dd></div>}
            </dl>
          ) : (
            <p className="prose" style={{ margin: 0 }}>Office address and phone details will be published here once confirmed.</p>
          )}
        </aside>
      </section>
    </>
  );
}
