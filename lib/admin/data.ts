import "server-only";
import { db, C } from "../db";
import { plain, oid } from "../serialize";
import { CURRENCY_CODES, ENTITIES, type EntityDef, type Field } from "./entities";

// Uncached reads for the admin panel: always the current database state.

export async function listEntity(def: EntityDef, skip = 0, limit = 25): Promise<Record<string, unknown>[]> {
  const rows = await (await db()).collection(def.collection).find({}).sort(def.sort).skip(skip).limit(limit).toArray();
  return plain(rows);
}

export async function countEntity(def: EntityDef): Promise<number> {
  return (await db()).collection(def.collection).countDocuments({});
}

export async function getEntity(def: EntityDef, id: string): Promise<Record<string, unknown> | null> {
  const coll = (await db()).collection(def.collection);
  if (def.collection === C.settings) {
    const d = await coll.findOne({ _id: "site" as never });
    return d ? plain(d) : {};
  }
  const _id = oid(id);
  if (!_id) return null;
  const d = await coll.findOne({ _id });
  return d ? plain(d) : null;
}

export type Options = Record<string, { value: string; label: string }[]>;

export async function loadOptions(fields: Field[]): Promise<Options> {
  const need = new Set(fields.map((f) => f.optionSource).filter(Boolean));
  const database = await db();
  const out: Options = {};
  if (need.has("regions")) out.regions = (await database.collection(C.regions).find().sort({ order: 1 }).toArray()).map((r) => ({ value: r._id.toHexString(), label: `${r.name}${r.status !== "published" ? ` (${r.status})` : ""}` }));
  if (need.has("treks")) out.treks = (await database.collection(C.treks).find({}, { projection: { name: 1, status: 1 } }).sort({ name: 1 }).toArray()).map((t) => ({ value: t._id.toHexString(), label: `${t.name}${t.status !== "published" ? ` (${t.status})` : ""}` }));
  if (need.has("stayPoints")) out.stayPoints = (await database.collection(C.stayPoints).find().sort({ name: 1 }).toArray()).map((s) => ({ value: s._id.toHexString(), label: `${s.name} (${s.elevationM} m)` }));
  if (need.has("currencies")) out.currencies = CURRENCY_CODES.map((c) => ({ value: c, label: c }));
  return out;
}

export function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

/** Convert a stored document into the flat value map the client form edits. */
export function toFormValues(def: EntityDef, doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of def.fields) {
    let v = getPath(doc, f.name);
    if (f.name === "home.trustPoints" && Array.isArray(v)) v = (v as { title: string; body: string }[]).map((p) => `${p.title} | ${p.body}`);
    if (f.type === "rates" && v && typeof v === "object") v = Object.entries(v as Record<string, number>).map(([k, r]) => `${k}=${r}`).join("\n");
    out[f.name] = v ?? null;
  }
  return out;
}

export async function dashboardCounts() {
  const database = await db();
  const today = new Date().toISOString().slice(0, 10);
  const [newBookings, reviewing, upcoming, published, drafts, inquiries, sampleTreks, advisories] = await Promise.all([
    database.collection(C.bookings).countDocuments({ status: "requested" }),
    database.collection(C.bookings).countDocuments({ status: "reviewing" }),
    database.collection(C.departures).countDocuments({ startDate: { $gte: today } }),
    database.collection(C.treks).countDocuments({ status: "published" }),
    database.collection(C.treks).countDocuments({ status: "draft" }),
    database.collection(C.inquiries).countDocuments({ status: "new" }),
    database.collection(C.treks).countDocuments({ sample: true }),
    database.collection(C.advisories).countDocuments({ active: true }),
  ]);
  return { newBookings, reviewing, upcoming, published, drafts, inquiries, sampleTreks, advisories };
}

export { ENTITIES };
