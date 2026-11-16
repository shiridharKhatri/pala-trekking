import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db, C } from "@/lib/db";
import { oid, plain } from "@/lib/serialize";
import { BOOKING_STATUSES, type Booking } from "@/lib/types";
import { date, dateTime, money } from "@/lib/format";
import { updateBooking } from "@/lib/actions/admin";
import { SimpleForm } from "@/components/admin/SimpleForm";

export default async function BookingDetail({ params }: PageProps<"/admin/bookings/[id]">) {
  await requireAdmin(["admin"]);
  const { id } = await params;
  const _id = oid(id);
  const d = _id ? await (await db()).collection(C.bookings).findOne({ _id }) : null;
  if (!d) notFound();
  const b = plain<Booking & { rateUsed?: number | null }>(d);
  const country = b.lead.country ? new Intl.DisplayNames(["en"], { type: "region" }).of(b.lead.country) : "";
  return (
    <>
      <header className="a-head">
        <div><p className="a-crumb"><Link href="/admin/bookings">Bookings</Link></p><h1 className="a-mono">{b.ref}</h1></div>
        <span className={`a-status a-status--${b.status}`}>{b.status}</span>
      </header>
      <div className="a-cols">
        <section className="a-card">
          <h2>Request</h2>
          <dl className="a-dl">
            <dt>Received</dt><dd>{dateTime(b.createdAt)} ({b.source})</dd>
            <dt>Trek</dt><dd>{b.trekName}</dd>
            <dt>Start</dt><dd>{b.departureDate ? date(b.departureDate) : `Preferred: ${date(b.preferredDate)} (no scheduled departure)`}</dd>
            <dt>Travellers</dt><dd>{b.travellers}</dd>
            <dt>Trek subtotal</dt><dd>{b.travellers} × {money(b.pricePerPerson, b.currency)} = {money(b.trekSubtotal, b.currency)}</dd>
            <dt>Optional experiences</dt><dd>{b.addOns.length ? b.addOns.map((a) => `${a.name} (+${money(a.price, b.currency)})`).join(", ") : "None"}</dd>
            <dt>Total</dt><dd><strong>{money(b.total, b.currency)}</strong> transaction currency {b.currency}</dd>
            {b.displayTotalEstimate != null && <><dt>Customer saw</dt><dd>≈ {money(b.displayTotalEstimate, b.displayCurrency)} estimate{b.rateUsed ? ` at rate ${b.rateUsed}` : ""}</dd></>}
          </dl>
        </section>
        <section className="a-card">
          <h2>Customer</h2>
          <dl className="a-dl">
            <dt>Lead traveller</dt><dd>{b.lead.name}</dd>
            <dt>Email</dt><dd>{b.lead.email ? <a href={`mailto:${b.lead.email}?subject=${encodeURIComponent(`Your Pala Trekking request ${b.ref}`)}`}>{b.lead.email}</a> : "–"}</dd>
            <dt>Phone</dt><dd>{b.lead.phone ? <a href={`tel:${b.lead.phone.replace(/[^+\d]/g, "")}`}>{b.lead.phone}</a> : "–"}</dd>
            <dt>Country</dt><dd>{country || "–"}</dd>
            <dt>Other travellers</dt><dd>{b.travellerNames || "–"}</dd>
            <dt>Message</dt><dd style={{ whiteSpace: "pre-wrap" }}>{b.message || "–"}</dd>
            <dt>Acknowledgements</dt><dd>{Object.entries(b.acknowledgements).map(([k, v]) => `${k}: ${v ? "yes" : "no"}`).join(", ")}</dd>
          </dl>
        </section>
      </div>
      <section className="a-card">
        <h2>Status and notes</h2>
        <SimpleForm action={updateBooking.bind(null, b.id)} submit="Update booking">
          <div className="a-field"><label htmlFor="status"><span className="a-label">Status</span></label>
            <select id="status" className="a-input" name="status" defaultValue={b.status}>{BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <small className="a-hint">Requested, reviewing and confirmed bookings hold seats on the departure. Declined and cancelled release them.</small>
          </div>
          <div className="a-field a-field--wide"><label htmlFor="adminNotes"><span className="a-label">Internal notes</span></label><textarea id="adminNotes" className="a-input" name="adminNotes" rows={4} defaultValue={b.adminNotes} /></div>
        </SimpleForm>
      </section>
    </>
  );
}
