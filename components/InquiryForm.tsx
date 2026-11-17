"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { submitInquiry, type FormState } from "@/lib/actions/public";

export function InquiryForm({ countries }: { countries: { code: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitInquiry, { ok: false });
  const err = state.errors ?? {};
  if (state.ok) return <p className="success-box" role="status">{state.message}</p>;
  const inv = (k: string) => (err[k] ? { "aria-invalid": true as const, "aria-describedby": `${k}-err` } : {});
  const errEl = (k: string) => (err[k] ? <p className="error-text" id={`${k}-err`}>{err[k]}</p> : null);
  return (
    <form
      action={action}
      style={{ display: "grid", gap: "var(--sc-4)", maxWidth: "40rem" }}
      // Keeps the typed message when the server returns errors (see BookingForm).
      onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }}
    >
      {state.message && <p className="notice-box" role="alert">{state.message}</p>}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}><input type="text" name="website" tabIndex={-1} autoComplete="off" /></div>
      <div className="grid-2">
        <label className="field"><span>Name</span><input className="input" name="name" autoComplete="name" required minLength={2} maxLength={120} {...inv("name")} />{errEl("name")}</label>
        <label className="field"><span>Email</span><input className="input" type="email" name="email" autoComplete="email" required maxLength={200} {...inv("email")} />{errEl("email")}</label>
        <label className="field"><span>Phone (optional)</span><input className="input" type="tel" name="phone" autoComplete="tel" pattern="\+?[0-9 \(\)\-\.]{6,22}" title="Phone number with country code, for example +44 20 7946 0000" {...inv("phone")} />{errEl("phone")}</label>
        <label className="field"><span>Country (optional)</span>
          <select className="input" name="country" defaultValue=""><option value="">Prefer not to say</option>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select>
        </label>
      </div>
      <label className="field"><span>Message</span><textarea className="input" name="message" rows={5} required minLength={10} maxLength={4000} {...inv("message")} />{errEl("message")}</label>
      <label className="check"><input type="checkbox" name="privacy" required /><span>I agree that my details are used to reply to me, as described in the <Link href="/privacy">privacy notice</Link>.</span></label>{errEl("privacy")}
      <button className="btn" type="submit" disabled={pending} style={{ justifySelf: "start" }}>{pending ? "Sending…" : "Send message"}</button>
    </form>
  );
}
