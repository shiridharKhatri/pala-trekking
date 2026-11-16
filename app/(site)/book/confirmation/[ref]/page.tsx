import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { connection } from "next/server";
import { db, C } from "@/lib/db";
import { date, money } from "@/lib/format";

export const metadata: Metadata = { title: "Booking request received", robots: { index: false } };

export default function Confirmation({ params }: PageProps<"/book/confirmation/[ref]">) {
  return <Suspense fallback={<div className="page-head wrap" />}><Body params={params} /></Suspense>;
}

async function Body({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  await connection();
  if (!/^PT-[A-F0-9]{8}$/.test(ref)) notFound();
  // Only non-personal fields are read for this page.
  const b = await (await db()).collection(C.bookings).findOne(
    { ref },
    { projection: { ref: 1, trekName: 1, departureDate: 1, preferredDate: 1, travellers: 1, addOns: 1, total: 1, currency: 1, status: 1, createdAt: 1 } },
  );
  if (!b) notFound();
  return (
    <>
      <header className="page-head wrap">
        <h1 className="display display--lg">Request received</h1>
        <p className="lede">Thank you. Your booking request has been saved. It is not yet confirmed: the team will check availability and contact you by email to confirm and arrange payment.</p>
      </header>
      <section className="wrap" style={{ paddingBottom: "var(--sc-section)" }}>
        <div className="success-box" style={{ maxWidth: "40rem", display: "grid", gap: "var(--sc-4)" }}>
          <p className="label" style={{ margin: 0 }}>Reference</p>
          <p className="display display--md mono" style={{ margin: 0 }}>{b.ref}</p>
          <dl className="facts" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div><dt>Trek</dt><dd>{b.trekName}</dd></div>
            <div><dt>Start</dt><dd>{b.departureDate ? date(b.departureDate) : `Preferred ${date(b.preferredDate)}`}</dd></div>
            <div><dt>Travellers</dt><dd>{b.travellers}</dd></div>
            <div><dt>Total requested</dt><dd>{money(b.total, b.currency)}<small>{b.addOns?.length ? `includes ${b.addOns.map((a: { name: string }) => a.name).join(", ")}` : "no optional experiences"}</small></dd></div>
          </dl>
          <p className="prose" style={{ margin: 0 }}>Keep this reference for any questions. Email notifications are not yet connected on this preview, so the team will see your request in the booking panel.</p>
          <div><Link className="btn btn--ghost" href="/treks">Back to treks</Link></div>
        </div>
      </section>
    </>
  );
}
