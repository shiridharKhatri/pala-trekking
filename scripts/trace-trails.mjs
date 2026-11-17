// Traces each trek's real walking route along OpenStreetMap's mapped
// footpaths and stores it on the trek (treks.routeTrack), so the 3D map draws
// the actual trail instead of straight lines between overnight stops.
//
//   node scripts/trace-trails.mjs            # all published treks
//   node scripts/trace-trails.mjs <slug>     # one trek
//
// How: for each pair of consecutive overnight stops, fetch the footpath and
// minor-road network around them from the Overpass API (public OSM data;
// only a bounding box is sent), snap both stops to the network, and take the
// shortest walking path. If a stop is too far from any mapped path, or no
// connected path exists, that leg is stored as "approx" and drawn dashed: the
// map never presents a guessed line as the trail. Long transfer legs (flights,
// drives to the trailhead) are skipped, as on the map.
//
// Data: (c) OpenStreetMap contributors, ODbL. Attribution is shown on the map.

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGODB_DB ?? "palatrek";
// Public Overpass servers, tried in order; override with OVERPASS_URL.
const SERVERS = process.env.OVERPASS_URL ? [process.env.OVERPASS_URL] : ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const SNAP_M = 1500; // a stop must lie within this distance of a mapped path
const TRANSFER_KM = 25; // legs longer than this (and 4x the median) are transfers

const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;
function dist(a, b) { // metres, [lon, lat]
  const dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Walking preference: trails first, then tracks and village lanes.
const COST = { path: 1, footway: 1, steps: 1.1, bridleway: 1, track: 1.15, unclassified: 1.4, residential: 1.4, service: 1.5, tertiary: 1.8, secondary: 2.2 };

async function fetchNetwork([w, s, e, n]) {
  const q = `[out:json][timeout:90];way["highway"~"^(${Object.keys(COST).join("|")})$"](${s},${w},${n},${e});out body geom;`;
  let last = "no response";
  for (const url of SERVERS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, { method: "POST", signal: AbortSignal.timeout(120000), headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "PalaTrekking-trail-tracer/1.0" }, body: "data=" + encodeURIComponent(q) });
        if (res.ok) {
          const json = await res.json();
          // A 200 with a "remark" and no elements is Overpass giving up (time
          // or memory limit), not an empty map: treat it as a failure.
          if (json.remark && !json.elements?.length) { last = `${new URL(url).host}: ${String(json.remark).slice(0, 80)}`; }
          else return json.elements ?? [];
        } else {
          last = `${new URL(url).host} ${res.status}`;
          if (res.status !== 429 && res.status < 500) break;
        }
      } catch (e) { last = `${new URL(url).host} ${e.name === "TimeoutError" ? "timed out" : e.message}`; }
      await new Promise((r) => setTimeout(r, 6000 * (attempt + 1)));
    }
  }
  throw new Error(last);
}

function buildGraph(ways) {
  const pos = new Map(); // node id -> [lon, lat]
  const adj = new Map(); // node id -> [[node, cost, metres]]
  const link = (a, b, c, m) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push([b, c, m]); };
  for (const w of ways) {
    const k = COST[w.tags?.highway] ?? 2;
    for (let i = 0; i < w.nodes.length; i++) pos.set(w.nodes[i], [w.geometry[i].lon, w.geometry[i].lat]);
    for (let i = 1; i < w.nodes.length; i++) {
      const a = w.nodes[i - 1], b = w.nodes[i];
      const m = dist(pos.get(a), pos.get(b));
      link(a, b, m * k, m); link(b, a, m * k, m);
    }
  }
  return { pos, adj };
}

// Snap both stops onto the SAME connected piece of the path network: the
// nearest node overall can sit on an isolated scrap of footway.
function components(g) {
  const comp = new Map(); let c = 0;
  for (const id of g.pos.keys()) {
    if (comp.has(id)) continue;
    const stack = [id]; comp.set(id, c);
    while (stack.length) for (const [v] of g.adj.get(stack.pop()) ?? []) if (!comp.has(v)) { comp.set(v, c); stack.push(v); }
    c++;
  }
  return comp;
}
function snapPair(g, A, B) {
  const comp = components(g);
  const near = (p) => [...g.pos].map(([id, q]) => ({ id, d: dist(p, q), c: comp.get(id) })).filter((x) => x.d <= SNAP_M).sort((x, y) => x.d - y.d);
  const na = near(A), nb = near(B);
  const bestB = new Map(); for (const x of nb) if (!bestB.has(x.c)) bestB.set(x.c, x);
  let best = null;
  for (const x of na) { const y = bestB.get(x.c); if (y && (!best || x.d + y.d < best.a.d + best.b.d)) best = { a: x, b: y }; }
  return { best, nearestA: na[0]?.d ?? Infinity, nearestB: nb[0]?.d ?? Infinity };
}

function shortest(g, from, to) { // Dijkstra with a binary heap
  const D = new Map([[from, 0]]), prev = new Map(), heap = [[0, from]];
  const push = (x) => { heap.push(x); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) {
    const [d, u] = pop();
    if (u === to) break;
    if (d > (D.get(u) ?? Infinity)) continue;
    for (const [v, c] of g.adj.get(u) ?? []) {
      const nd = d + c;
      if (nd < (D.get(v) ?? Infinity)) { D.set(v, nd); prev.set(v, u); push([nd, v]); }
    }
  }
  if (!D.has(to)) return null;
  const ids = [to]; while (ids[0] !== from) ids.unshift(prev.get(ids[0]));
  return ids.map((id) => g.pos.get(id));
}

function simplify(pts, tol = 8) { // Douglas-Peucker in metres (local planar)
  if (pts.length < 3) return pts;
  const k = Math.cos(rad(pts[0][1])) * 111320, j = 110540;
  const xy = pts.map((p) => [p[0] * k, p[1] * j]);
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let idx = -1, md = tol;
    const [x1, y1] = xy[a], [x2, y2] = xy[b], L = Math.hypot(x2 - x1, y2 - y1) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((x2 - x1) * (y1 - xy[i][1]) - (x1 - xy[i][0]) * (y2 - y1)) / L; if (d > md) { md = d; idx = i; } }
    if (idx >= 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]).map((p) => [+p[0].toFixed(6), +p[1].toFixed(6)]);
}

const lengthKm = (pts) => pts.slice(1).reduce((s, p, i) => s + dist(pts[i], p), 0) / 1000;

async function traceTrek(db, trek) {
  const sps = new Map((await db.collection("stayPoints").find({}).toArray()).map((s) => [String(s._id), s]));
  const visits = [];
  for (const d of [...trek.itinerary].sort((a, b) => a.day - b.day)) {
    const sp = d.stayPointId ? sps.get(String(d.stayPointId)) : null;
    if (!sp) continue;
    const last = visits.at(-1);
    if (last && String(last.sp._id) === String(sp._id)) last.days.push(d.day); else visits.push({ sp, days: [d.day] });
  }
  const legs = visits.slice(1).map((v, i) => dist([visits[i].sp.lon, visits[i].sp.lat], [v.sp.lon, v.sp.lat]) / 1000);
  const median = [...legs].sort((a, b) => a - b)[Math.floor(legs.length / 2)] ?? 0;
  const segments = [];
  for (let i = 1; i < visits.length; i++) {
    const a = visits[i - 1], b = visits[i];
    const A = [a.sp.lon, a.sp.lat], B = [b.sp.lon, b.sp.lat];
    const base = { fromDay: a.days.at(-1), toDay: b.days[0], from: a.sp.name, to: b.sp.name };
    if (legs[i - 1] > Math.max(TRANSFER_KM, median * 4)) { segments.push({ ...base, source: "transfer", km: +legs[i - 1].toFixed(1), coords: [A, B] }); continue; }
    const pad = 0.05;
    const bbox = [Math.min(A[0], B[0]) - pad, Math.min(A[1], B[1]) - pad, Math.max(A[0], B[0]) + pad, Math.max(A[1], B[1]) + pad];
    let seg = { ...base, source: "approx", km: +legs[i - 1].toFixed(1), coords: [A, B], note: "" };
    try {
      const ways = await fetchNetwork(bbox);
      if (!ways.length) throw new Error("empty response");
      const g = buildGraph(ways);
      const snap = snapPair(g, A, B);
      if (!Number.isFinite(snap.nearestA) || !Number.isFinite(snap.nearestB)) seg.note = `a stop is more than ${SNAP_M} m from any mapped path`;
      else if (!snap.best) seg.note = "no connected path in OpenStreetMap";
      else {
        const path = shortest(g, snap.best.a.id, snap.best.b.id);
        if (!path) seg.note = "no connected path in OpenStreetMap";
        else if (lengthKm(path) > legs[i - 1] * 4 + 10) seg.note = "mapped path detour is implausible";
        else {
          const coords = simplify([A, ...path, B]);
          seg = { ...base, source: "osm", km: +lengthKm(coords).toFixed(1), coords };
        }
      }
    } catch (e) {
      seg.note = `Overpass: ${e.message}`;
      // A server failure is not evidence the trail is unmapped: keep the
      // previously traced leg, if any, rather than downgrading it.
      const prev = trek.routeTrack?.segments?.find((x) => x.fromDay === seg.fromDay && x.toDay === seg.toDay && x.source === "osm");
      if (prev) { seg = prev; seg.note = undefined; console.log(`  (kept the earlier trace for ${seg.from} -> ${seg.to})`); }
    }
    segments.push(seg);
    console.log(`  ${seg.from} -> ${seg.to}: ${seg.source}${seg.source === "osm" ? `, ${seg.km} km, ${seg.coords.length} pts` : seg.note ? ` (${seg.note})` : ""}`);
    await new Promise((r) => setTimeout(r, 1500)); // be gentle with the public API
  }
  return { builtAt: new Date().toISOString(), source: "OpenStreetMap contributors (ODbL), traced along mapped paths between overnight stops", segments };
}

const client = await MongoClient.connect(uri);
const db = client.db(dbName);
const only = process.argv[2];
const treks = await db.collection("treks").find(only ? { slug: only } : { status: "published" }).toArray();
for (const t of treks) {
  console.log(t.name);
  const track = await traceTrek(db, t);
  await db.collection("treks").updateOne({ _id: t._id }, { $set: { routeTrack: track } });
}
await client.close();
console.log("Done. Restart the dev server (or save the trek in the admin) to refresh cached pages.");
