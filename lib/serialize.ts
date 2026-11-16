import { ObjectId } from "mongodb";

/** Convert a Mongo document into a plain, serializable object with `id`. */
export function plain<T>(doc: unknown): T {
  return walk(doc) as T;
}

function walk(v: unknown): unknown {
  if (v instanceof ObjectId) return v.toHexString();
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(walk);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (k === "_id") out.id = walk(val);
      else out[k] = walk(val);
    }
    return out;
  }
  return v;
}

export function oid(id: string): ObjectId | null {
  return ObjectId.isValid(id) && id.length === 24 ? new ObjectId(id) : null;
}
