// Published-slug index used by proxy.ts to return a real 404 status for
// unknown trek / gateway / experience URLs.
//
// Why here and not in the page: those pages are partially prerendered, so the
// static shell (and its 200 status) is sent before page code can call
// notFound(). The proxy runs before rendering, so it can still choose 404.
//
// No "server-only" import: the proxy is not a React Server environment, where
// that package throws. It keeps its own small MongoDB client.

import { MongoClient } from "mongodb";

type Kind = "treks" | "gateways" | "experiences";
const TTL_MS = 30_000; // normal refresh
const MISS_REFRESH_MS = 5_000; // at most one forced refresh per 5 s on unknown slugs
const FAIL_BACKOFF_MS = 30_000; // after a database failure, stop checking for 30 s
let failedAt = 0;

const state: Record<Kind, { slugs: Set<string>; at: number; forcedAt: number; loading: Promise<void> | null }> = {
  treks: { slugs: new Set(), at: 0, forcedAt: 0, loading: null },
  gateways: { slugs: new Set(), at: 0, forcedAt: 0, loading: null },
  experiences: { slugs: new Set(), at: 0, forcedAt: 0, loading: null },
};

declare global {
  var __palatrekProxyMongo: Promise<MongoClient> | undefined;
}

function client(): Promise<MongoClient> {
  if (!globalThis.__palatrekProxyMongo) {
    globalThis.__palatrekProxyMongo = new MongoClient(process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017", {
      serverSelectionTimeoutMS: 2000, maxPoolSize: 3,
    }).connect();
    globalThis.__palatrekProxyMongo.catch(() => { globalThis.__palatrekProxyMongo = undefined; });
  }
  return globalThis.__palatrekProxyMongo;
}

async function load(kind: Kind) {
  const db = (await client()).db(process.env.MONGODB_DB ?? "palatrek");
  const filter = kind === "gateways" ? {} : { status: "published" };
  const rows = await db.collection(kind).find(filter, { projection: { slug: 1 } }).toArray();
  state[kind].slugs = new Set(rows.map((r) => String(r.slug)));
  state[kind].at = Date.now();
}

function refresh(kind: Kind) {
  const s = state[kind];
  s.loading ??= load(kind).finally(() => { s.loading = null; });
  return s.loading;
}

/**
 * true  = slug is published
 * false = definitely unknown (fresh index, still absent)
 * null  = could not check (database unavailable): let the request through
 */
export async function slugExists(kind: Kind, slug: string): Promise<boolean | null> {
  const s = state[kind];
  if (Date.now() - failedAt < FAIL_BACKOFF_MS) return null;
  try {
    if (Date.now() - s.at > TTL_MS) await refresh(kind);
    if (s.slugs.has(slug)) return true;
    // Unknown: maybe published seconds ago. Refresh once, rate limited.
    if (Date.now() - s.forcedAt > MISS_REFRESH_MS) {
      s.forcedAt = Date.now();
      await refresh(kind);
      return s.slugs.has(slug);
    }
    return false;
  } catch {
    failedAt = Date.now();
    return null;
  }
}
