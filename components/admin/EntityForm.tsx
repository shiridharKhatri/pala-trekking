"use client";

import { useActionState, useState } from "react";
import type { Field } from "@/lib/admin/entities";
import type { AdminState } from "@/lib/actions/admin";
import type { ItineraryDay, Media } from "@/lib/types";

type Opts = Record<string, { value: string; label: string }[]>;

interface Props {
  fields: Field[];
  values: Record<string, unknown>;
  options: Opts;
  action: (state: AdminState, fd: FormData) => Promise<AdminState>;
  role: "admin" | "content";
  isNew: boolean;
  mediaLibrary: string[];
  submitLabel?: string;
}

export function EntityForm({ fields, values, options, action, role, isNew, mediaLibrary, submitLabel = "Save" }: Props) {
  const [state, formAction, pending] = useActionState(action, { ok: false });
  const groups = [...new Set(fields.map((f) => f.group ?? ""))];
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="a-form" noValidate>
      <datalist id="media-library">{mediaLibrary.map((m) => <option key={m} value={m} />)}</datalist>
      {state.message && (
        <p className={state.ok ? "a-flash a-flash--ok" : "a-flash a-flash--err"} role={state.ok ? "status" : "alert"}>{state.message}</p>
      )}
      {groups.map((g) => (
        <fieldset key={g || "main"} className="a-group">
          {g && <legend>{g}</legend>}
          {fields.filter((f) => (f.group ?? "") === g).map((f) => (
            <FieldInput key={f.name} f={f} value={values[f.name]} options={f.options ?? (f.optionSource ? options[f.optionSource] ?? [] : [])}
              locked={(role !== "admin" && !!f.adminOnly) || (!!f.readOnlyOnEdit && !isNew)} error={err[f.name]} stayPoints={options.stayPoints ?? []} />
          ))}
        </fieldset>
      ))}
      <div className="a-actions">
        <button className="a-btn a-btn--primary" type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
        {role !== "admin" && <span className="a-hint">Fields marked “admin only” are managed by an administrator.</span>}
      </div>
    </form>
  );
}

function FieldInput({ f, value, options, locked, error, stayPoints }: {
  f: Field; value: unknown; options: { value: string; label: string }[]; locked: boolean; error?: string; stayPoints: { value: string; label: string }[];
}) {
  const id = `f-${f.name.replace(/\./g, "-")}`;
  const describedBy = [error ? `${id}-err` : "", f.help ? `${id}-help` : ""].filter(Boolean).join(" ") || undefined;
  const common = { id, name: f.name, disabled: locked, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy };
  const label = (
    <span className="a-label">
      {f.label}{f.required && <span aria-hidden="true"> *</span>}
      {f.adminOnly && <span className="a-tag">admin only</span>}
    </span>
  );
  const foot = (
    <>
      {f.help && <small id={`${id}-help`} className="a-hint">{f.help}</small>}
      {error && <small id={`${id}-err`} className="a-error">{error}</small>}
    </>
  );

  switch (f.type) {
    case "checkbox":
      return (
        <div className="a-field a-field--check">
          <label htmlFor={id}><input type="checkbox" {...common} defaultChecked={!!value} /> {label}</label>
          {foot}
        </div>
      );
    case "textarea":
      return <div className="a-field a-field--wide"><label htmlFor={id}>{label}</label><textarea className="a-input" rows={f.rows ?? 4} maxLength={f.max} {...common} defaultValue={(value as string) ?? ""} />{foot}</div>;
    case "lines":
      return <div className="a-field a-field--wide"><label htmlFor={id}>{label}</label><textarea className="a-input" rows={5} {...common} defaultValue={Array.isArray(value) ? (value as string[]).join("\n") : ""} />{foot}</div>;
    case "rates":
      return <div className="a-field a-field--wide"><label htmlFor={id}>{label}</label><textarea className="a-input a-mono" rows={5} {...common} defaultValue={(value as string) ?? ""} />{foot}</div>;
    case "number":
      return <div className="a-field"><label htmlFor={id}>{label}</label><input className="a-input" type="number" min={f.min} max={f.max} step={f.step ?? 1} {...common} defaultValue={value == null ? "" : String(value)} />{foot}</div>;
    case "date":
      return <div className="a-field"><label htmlFor={id}>{label}</label><input className="a-input" type="date" {...common} defaultValue={(value as string) ?? ""} />{foot}</div>;
    case "select":
      return (
        <div className="a-field">
          <label htmlFor={id}>{label}</label>
          <select className="a-input" {...common} defaultValue={(value as string) ?? ""}>
            {!f.required && !options.some((o) => o.value === "") && <option value="">None</option>}
            {f.required && !value && <option value="">Choose…</option>}
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {foot}
        </div>
      );
    case "multiselect": {
      const sel = new Set(Array.isArray(value) ? (value as string[]) : []);
      return (
        <fieldset className="a-field a-field--wide a-multi" aria-describedby={describedBy}>
          <legend>{label}</legend>
          <div className="a-multi__list">
            {options.map((o) => (
              <label key={o.value}><input type="checkbox" name={f.name} value={o.value} defaultChecked={sel.has(o.value)} disabled={locked} /> {o.label}</label>
            ))}
            {!options.length && <span className="a-hint">Nothing to choose from yet.</span>}
          </div>
          {foot}
        </fieldset>
      );
    }
    case "media": {
      const m = (value as Media | null) ?? null;
      return <MediaInput name={f.name} label={label} value={m} locked={locked} foot={foot} />;
    }
    case "gallery":
      return <GalleryInput name={f.name} label={label} value={(value as Media[]) ?? []} foot={foot} locked={locked} />;
    case "itinerary":
      return <ItineraryInput name={f.name} label={label} value={(value as ItineraryDay[]) ?? []} stayPoints={stayPoints} foot={foot} locked={locked} />;
    default:
      return <div className="a-field"><label htmlFor={id}>{label}</label><input className="a-input" type="text" maxLength={f.max} pattern={f.pattern} {...common} defaultValue={(value as string) ?? ""} />{foot}</div>;
  }
}

function MediaInput({ name, label, value, locked, foot }: { name: string; label: React.ReactNode; value: Media | null; locked: boolean; foot: React.ReactNode }) {
  const [src, setSrc] = useState(value?.src ?? "");
  return (
    <fieldset className="a-field a-field--wide a-media">
      <legend>{label}</legend>
      <div className="a-media__row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src ? <img src={src} alt="" className="a-media__thumb" /> : <div className="a-media__thumb a-media__thumb--empty">No image</div>}
        <div className="a-media__fields">
          <label>Image path <input className="a-input" name={`${name}.src`} list="media-library" value={src} onChange={(e) => setSrc(e.target.value)} disabled={locked} placeholder="/media/photos/… or /uploads/…" /></label>
          <label>Alternative text (describe the image) <input className="a-input" name={`${name}.alt`} defaultValue={value?.alt ?? ""} disabled={locked} /></label>
          <div className="a-two">
            <label>Caption <input className="a-input" name={`${name}.caption`} defaultValue={value?.caption ?? ""} disabled={locked} /></label>
            <label>Credit <input className="a-input" name={`${name}.credit`} defaultValue={value?.credit ?? ""} disabled={locked} /></label>
          </div>
        </div>
      </div>
      {foot}
    </fieldset>
  );
}

function GalleryInput({ name, label, value, foot, locked }: { name: string; label: React.ReactNode; value: Media[]; foot: React.ReactNode; locked: boolean }) {
  const [items, setItems] = useState<Media[]>(value);
  const upd = (i: number, k: keyof Media, v: string) => setItems((a) => a.map((m, j) => (j === i ? { ...m, [k]: v } : m)));
  return (
    <fieldset className="a-field a-field--wide">
      <legend>{label}</legend>
      <input type="hidden" name={name} value={JSON.stringify(items)} />
      <div className="a-rows">
        {items.map((m, i) => (
          <div key={i} className="a-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {m.src ? <img src={m.src} alt="" className="a-media__thumb" /> : <div className="a-media__thumb a-media__thumb--empty" />}
            <div className="a-media__fields">
              <label>Path <input className="a-input" list="media-library" value={m.src} onChange={(e) => upd(i, "src", e.target.value)} disabled={locked} /></label>
              <label>Alternative text <input className="a-input" value={m.alt} onChange={(e) => upd(i, "alt", e.target.value)} disabled={locked} /></label>
              <div className="a-two">
                <label>Caption <input className="a-input" value={m.caption ?? ""} onChange={(e) => upd(i, "caption", e.target.value)} disabled={locked} /></label>
                <label>Credit <input className="a-input" value={m.credit ?? ""} onChange={(e) => upd(i, "credit", e.target.value)} disabled={locked} /></label>
              </div>
            </div>
            <div className="a-row__tools">
              <button type="button" className="a-btn a-btn--small" disabled={locked || i === 0} onClick={() => setItems((a) => { const b = [...a]; [b[i - 1], b[i]] = [b[i], b[i - 1]]; return b; })} aria-label={`Move image ${i + 1} up`}>↑</button>
              <button type="button" className="a-btn a-btn--small a-btn--danger" disabled={locked} onClick={() => setItems((a) => a.filter((_, j) => j !== i))} aria-label={`Remove image ${i + 1}`}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="a-btn" disabled={locked} onClick={() => setItems((a) => [...a, { src: "", alt: "", caption: "", credit: "" }])}>Add image</button>
      {foot}
    </fieldset>
  );
}

function ItineraryInput({ name, label, value, stayPoints, foot, locked }: {
  name: string; label: React.ReactNode; value: ItineraryDay[]; stayPoints: { value: string; label: string }[]; foot: React.ReactNode; locked: boolean;
}) {
  const [days, setDays] = useState<ItineraryDay[]>(value);
  const upd = <K extends keyof ItineraryDay>(i: number, k: K, v: ItineraryDay[K]) => setDays((a) => a.map((d, j) => (j === i ? { ...d, [k]: v } : d)));
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const add = () => setDays((a) => {
    const last = a[a.length - 1];
    return [...a, { day: (last?.day ?? 0) + 1, start: last?.destination ?? "", destination: "", activities: "", distanceKm: null, walkingHours: "", elevationM: null, stayPointId: null }];
  });
  return (
    <fieldset className="a-field a-field--wide">
      <legend>{label}</legend>
      <input type="hidden" name={name} value={JSON.stringify(days)} />
      <div className="a-rows">
        {days.map((d, i) => (
          <div key={i} className="a-day">
            <div className="a-day__head">
              <label>Day <input className="a-input a-input--xs" type="number" min={1} value={d.day} onChange={(e) => upd(i, "day", Number(e.target.value) || 1)} disabled={locked} /></label>
              <button type="button" className="a-btn a-btn--small a-btn--danger" disabled={locked} onClick={() => setDays((a) => a.filter((_, j) => j !== i))}>Remove day {d.day}</button>
            </div>
            <div className="a-grid">
              <label>Start <input className="a-input" value={d.start} onChange={(e) => upd(i, "start", e.target.value)} disabled={locked} /></label>
              <label>Destination <input className="a-input" value={d.destination} onChange={(e) => upd(i, "destination", e.target.value)} disabled={locked} /></label>
              <label>Distance (km) <input className="a-input" type="number" min={0} step={0.1} value={d.distanceKm ?? ""} onChange={(e) => upd(i, "distanceKm", num(e.target.value))} disabled={locked} /></label>
              <label>Walking time <input className="a-input" value={d.walkingHours} placeholder="5 to 6 h" onChange={(e) => upd(i, "walkingHours", e.target.value)} disabled={locked} /></label>
              <label>Sleeping elevation (m) <input className="a-input" type="number" min={0} max={9000} value={d.elevationM ?? ""} onChange={(e) => upd(i, "elevationM", num(e.target.value))} disabled={locked} /></label>
              <label>Overnight stay point
                <select className="a-input" value={d.stayPointId ?? ""} onChange={(e) => upd(i, "stayPointId", e.target.value || null)} disabled={locked}>
                  <option value="">No stay point / no weather</option>
                  {stayPoints.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
            </div>
            <label className="a-block">Activities <textarea className="a-input" rows={2} value={d.activities} onChange={(e) => upd(i, "activities", e.target.value)} disabled={locked} /></label>
          </div>
        ))}
      </div>
      <button type="button" className="a-btn" disabled={locked} onClick={add}>Add day</button>
      {foot}
    </fieldset>
  );
}
