import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db, C } from "@/lib/db";
import { createOfflineBooking } from "@/lib/actions/admin";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { countryOptions } from "@/lib/countries";
import { date } from "@/lib/format";

export default async function NewOffline() {
  await requireAdmin(["admin"]);
  const database = await db();
  const today = new Date().toISOString().slice(0, 10);
  const [deps, treks] = await Promise.all([
    database.collection(C.departures).find({ startDate: { $gte: today } }).sort({ startDate: 1 }).toArray(),
    database.collection(C.treks).find({}, { projection: { name: 1 } }).toArray(),
  ]);
  const name = (id: string) => treks.find((t) => t._id.toHexString() === id)?.name ?? "Unknown trek";
  return (
    <>
      <header className="a-head"><div><p className="a-crumb"><Link href="/admin/bookings">Bookings</Link></p><h1>Record an offline booking</h1></div></header>
      <p className="a-hint">For bookings taken by phone, email or in person. The travellers count towards the departure&apos;s capacity, and the public board shows only the count.</p>
      <section className="a-card">
        <SimpleForm action={createOfflineBooking} submit="Record booking">
          <div className="a-field a-field--wide"><label htmlFor="departureId"><span className="a-label">Departure *</span></label>
            <select id="departureId" name="departureId" className="a-input" required defaultValue=""><option value="" disabled>Choose…</option>{deps.map((d) => <option key={d._id.toHexString()} value={d._id.toHexString()}>{date(d.startDate)} · {name(d.trekId)}</option>)}</select>
          </div>
          <div className="a-field"><label htmlFor="travellers"><span className="a-label">Travellers *</span></label><input id="travellers" className="a-input" type="number" name="travellers" min={1} defaultValue={1} required /></div>
          <div className="a-field"><label htmlFor="total"><span className="a-label">Agreed total (base currency) *</span></label><input id="total" className="a-input" type="number" name="total" min={0} required /></div>
          <div className="a-field"><label htmlFor="name"><span className="a-label">Lead traveller *</span></label><input id="name" className="a-input" name="name" required /></div>
          <div className="a-field"><label htmlFor="email"><span className="a-label">Email</span></label><input id="email" className="a-input" type="email" name="email" /></div>
          <div className="a-field"><label htmlFor="phone"><span className="a-label">Phone</span></label><input id="phone" className="a-input" type="tel" name="phone" /></div>
          <div className="a-field"><label htmlFor="country"><span className="a-label">Country</span></label><select id="country" className="a-input" name="country" defaultValue=""><option value="">Not recorded</option>{countryOptions().map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
          <div className="a-field a-field--wide"><label htmlFor="adminNotes"><span className="a-label">Notes</span></label><textarea id="adminNotes" className="a-input" name="adminNotes" rows={3} /></div>
        </SimpleForm>
      </section>
    </>
  );
}
