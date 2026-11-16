"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { submitBooking, type FormState } from "@/lib/actions/public";
import type { Experience, PublicDeparture } from "@/lib/types";
import { addDays, convert, date, money } from "@/lib/format";
import { bookable, departureStatusLabel } from "@/lib/departures";
import { useCurrency } from "./CurrencyProvider";

interface Props {
  trek: { slug: string; name: string; basePrice: number; durationDays: number };
  departures: PublicDeparture[];
  experiences: Experience[];
  countries: { code: string; name: string }[];
  initialDeparture: string;
  initialAddOn: string;
  minDate: string;
}

export function BookingForm({ trek, departures, experiences, countries, initialDeparture, initialAddOn, minDate }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitBooking, { ok: false });
  const { settings, selected } = useCurrency();
  const open = departures.filter((d) => bookable(d.status));
  const [dep, setDep] = useState<string>(open.some((d) => d.id === initialDeparture) ? initialDeparture : open[0]?.id ?? "");
  const [preferred, setPreferred] = useState("");
  const [travellers, setTravellers] = useState(1);
  const [added, setAdded] = useState<string[]>(experiences.some((e) => e.id === initialAddOn) ? [initialAddOn] : []);
  const err = state.errors ?? {};

  const chosen = departures.find((d) => d.id === dep);
  const addOns = experiences.filter((e) => added.includes(e.id));
  const trekSubtotal = trek.basePrice * travellers;
  const addOnTotal = addOns.reduce((s, a) => s + a.price, 0);
  const total = trekSubtotal + addOnTotal;
  const base = settings.base;
  const est = selected !== base ? convert(total, selected, base, settings.rates) : null;
  const maxTravellers = chosen ? Math.max(1, Math.min(20, chosen.spacesLeft)) : 20;
  const fmt = useMemo(() => (n: number) => money(n, base), [base]);

  const toggle = (id: string, on: boolean) => setAdded((a) => (on ? [...new Set([...a, id])] : a.filter((x) => x !== id)));
  const invalid = (k: string) => (err[k] ? { "aria-invalid": true as const, "aria-describedby": `${k}-err` } : {});
  const errEl = (k: string) => (err[k] ? <p className="error-text" id={`${k}-err`}>{err[k]}</p> : null);

  return (
    <form action={action} className="booking" noValidate={false}>
      <input type="hidden" name="trekSlug" value={trek.slug} />
      <input type="hidden" name="displayCurrency" value={selected} />
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
        <label>Leave empty <input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div className="booking__steps">
        {state.message && !state.ok && <p className="notice-box" role="alert" style={{ borderColor: "var(--bad)" }}>{state.message}</p>}

        <fieldset className="step">
          <legend><span>01</span> When</legend>
          {open.length > 0 && (
            <div className="dep-options" role="radiogroup" aria-label="Departures">
              {departures.map((d) => {
                const ok = bookable(d.status);
                return (
                  <label key={d.id} className="dep-option">
                    <input type="radio" name="departureId" value={d.id} checked={dep === d.id} disabled={!ok} onChange={() => setDep(d.id)} />
                    <span>
                      <strong className="mono">{date(d.startDate)}</strong> to {date(addDays(d.startDate, trek.durationDays - 1))}
                      <span className="label" style={{ display: "block" }}>{d.travellerCount} booked · {d.spacesLeft} spaces left</span>
                    </span>
                    <span className={`status status--${d.status}`}>{departureStatusLabel[d.status]}</span>
                  </label>
                );
              })}
            </div>
          )}
          <label className="dep-option">
            <input type="radio" name="departureId" value="" checked={dep === ""} onChange={() => setDep("")} />
            <span>
              <strong>Request a different start date</strong>
              <span className="label" style={{ display: "block" }}>We will confirm whether a group or private departure is possible</span>
            </span>
            <span />
          </label>
          {dep === "" && (
            <label className="field" style={{ maxWidth: "18rem" }}>
              <span>Preferred start date</span>
              <input className="input" type="date" name="preferredDate" min={minDate} value={preferred} onChange={(e) => setPreferred(e.target.value)} required {...invalid("departureId")} />
            </label>
          )}
          {errEl("departureId")}
          <label className="field" style={{ maxWidth: "12rem" }}>
            <span>Travellers</span>
            <input className="input" type="number" name="travellers" min={1} max={maxTravellers} value={travellers} inputMode="numeric"
              onChange={(e) => setTravellers(Math.max(1, Math.min(maxTravellers, Number(e.target.value) || 1)))} {...invalid("travellers")} />
            {chosen && <small>{chosen.spacesLeft} spaces left on this departure</small>}
          </label>
          {errEl("travellers")}
        </fieldset>

        <fieldset className="step">
          <legend><span>02</span> Optional experiences</legend>
          {experiences.length === 0 ? (
            <p className="prose">There are no optional experiences for this trek.</p>
          ) : (
            <>
              <p className="prose" style={{ margin: 0 }}>Add one if it suits you. Each adds its fixed price once to the booking total. You can continue without any.</p>
              {experiences.map((e) => {
                const on = added.includes(e.id);
                return (
                  <div key={e.id} className="addon" data-added={on}>
                    {e.image ? <Image src={e.image.src} alt="" width={240} height={240} sizes="7rem" quality={60} /> : <span />}
                    <div>
                      <h3>{e.name}</h3>
                      <p>{e.summary}</p>
                      <p className="label" style={{ marginTop: "0.4rem" }}>{e.durationNights} {e.durationNights === 1 ? "night" : "nights"} · adds {money(e.price, base)}{selected !== base && convert(e.price, selected, base, settings.rates) != null ? ` (≈ ${money(convert(e.price, selected, base, settings.rates)!, selected)})` : ""}</p>
                      <div className="addon__actions">
                        <label className="check" style={{ alignItems: "center" }}>
                          <input type="checkbox" name="addOnIds" value={e.id} checked={on} aria-label={`Add ${e.name} for ${money(e.price, base)}`} onChange={(ev) => toggle(e.id, ev.target.checked)} />
                          <span>{on ? "Added" : "Add this experience"}</span>
                        </label>
                        <Link href={`/experiences/${e.slug}`} target="_blank" className="link-arrow" style={{ fontSize: "var(--sc-t-sm)" }}>View details<span className="vh"> (opens in a new tab)</span></Link>
                      </div>
                    </div>
                  </div>
                );
              })}
              {added.length > 0 && <button type="button" className="btn btn--ghost btn--small" style={{ justifySelf: "start" }} onClick={() => setAdded([])}>Continue without experiences</button>}
            </>
          )}
        </fieldset>

        <fieldset className="step">
          <legend><span>03</span> Your details</legend>
          <div className="grid-2">
            <label className="field"><span>Lead traveller full name</span><input className="input" name="name" autoComplete="name" required {...invalid("name")} />{errEl("name")}</label>
            <label className="field"><span>Email</span><input className="input" type="email" name="email" autoComplete="email" required {...invalid("email")} />{errEl("email")}</label>
            <label className="field"><span>Phone, with country code</span><input className="input" type="tel" name="phone" autoComplete="tel" placeholder="+44 20 7946 0000" required {...invalid("phone")} />{errEl("phone")}</label>
            <label className="field"><span>Country of residence</span>
              <select className="input" name="country" autoComplete="country" defaultValue="" required {...invalid("country")}>
                <option value="" disabled>Select a country</option>
                {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>{errEl("country")}
            </label>
          </div>
          <label className="field"><span>Other travellers&apos; names (optional)</span><textarea className="input" name="travellerNames" rows={2} /></label>
          <label className="field"><span>Anything we should know (optional)</span><textarea className="input" name="message" rows={3} placeholder="Dietary needs, previous altitude experience, questions" /></label>
        </fieldset>

        <fieldset className="step">
          <legend><span>04</span> Confirm</legend>
          <label className="check"><input type="checkbox" name="terms" required /> <span>I have read the <Link href="/terms" target="_blank">booking terms</Link>.</span></label>{errEl("terms")}
          <label className="check"><input type="checkbox" name="cancellation" required /> <span>I accept the <Link href="/cancellation-policy" target="_blank">cancellation policy</Link>.</span></label>{errEl("cancellation")}
          <label className="check"><input type="checkbox" name="privacy" required /> <span>I agree that my details are used to handle this request, as described in the <Link href="/privacy" target="_blank">privacy notice</Link>.</span></label>{errEl("privacy")}
          <label className="check"><input type="checkbox" name="fitness" required /> <span>I understand the fitness and altitude requirements and will hold suitable travel insurance.</span></label>{errEl("fitness")}
          <p className="notice-box" style={{ margin: 0 }}>This sends a booking request. It is not yet a confirmed booking and no payment is taken now. We will check availability and contact you to confirm and arrange payment in {base}.</p>
          <button className="btn" type="submit" disabled={pending} style={{ justifySelf: "start" }}>{pending ? "Sending…" : "Send booking request"}</button>
        </fieldset>
      </div>

      <aside className="summary" aria-label="Booking summary" aria-live="polite">
        <p className="label" style={{ margin: 0 }}>Your request</p>
        <h2 className="trek-card__title">{trek.name}</h2>
        <dl>
          <div><dt>Dates</dt><dd>{chosen ? `${date(chosen.startDate)}` : preferred ? `Preferred ${date(preferred)}` : "Not chosen"}</dd></div>
          <div><dt>{travellers} × {fmt(trek.basePrice)}</dt><dd>{fmt(trekSubtotal)}</dd></div>
          {addOns.map((a) => <div key={a.id}><dt>{a.name}</dt><dd>+ {fmt(a.price)}</dd></div>)}
        </dl>
        <div className="summary__total">
          <span>Total</span>
          <strong>{fmt(total)}</strong>
        </div>
        {est != null && <p className="summary__note">About {money(est, selected)}. This is an estimate using the site&apos;s reference rate; your booking is priced and paid in {base}.</p>}
        <p className="summary__note">Transaction currency: <strong>{base}</strong>.</p>
      </aside>
    </form>
  );
}
