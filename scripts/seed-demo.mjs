// Demo analytics data for the admin charts (development only).
//
//   npm run seed:demo             add ~110 demo bookings, past departures, inquiries
//   npm run seed:demo -- --remove delete everything this script created
//
// Every record carries `demo: true` and fictional example.test contact details.
// Demo bookings are attached only to demo past departures or left as
// "preferred date" requests, so they never change real capacity on the public
// departure board.

import { MongoClient, ObjectId } from "mongodb";
import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";

for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const client = await new MongoClient(process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017").connect();
const db = client.db(process.env.MONGODB_DB ?? "palatrek");

if (process.argv.includes("--remove")) {
  const a = await db.collection("bookings").deleteMany({ demo: true });
  const b = await db.collection("departures").deleteMany({ demo: true });
  const c = await db.collection("inquiries").deleteMany({ demo: true });
  console.log(`removed ${a.deletedCount} bookings, ${b.deletedCount} departures, ${c.deletedCount} inquiries`);
  await client.close();
  process.exit(0);
}
if ((await db.collection("bookings").countDocuments({ demo: true })) > 0) {
  console.log("demo data already present (run with --remove first to regenerate)");
  await client.close();
  process.exit(0);
}

// Deterministic pseudo-random so the demo looks the same every run.
let seed = 20261116;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const weighted = (pairs) => { let r = rnd() * pairs.reduce((s, p) => s + p[1], 0); for (const [v, w] of pairs) if ((r -= w) <= 0) return v; return pairs[0][0]; };

const treks = await db.collection("treks").find({ status: "published" }).toArray();
const exps = await db.collection("experiences").find({ status: "published" }).toArray();
if (!treks.length) throw new Error("Run `npm run seed` first.");
const settings = await db.collection("settings").findOne({ _id: "site" });
const base = settings?.currency?.base ?? "USD";
const rates = settings?.currency?.rates ?? {};
const enabled = settings?.currency?.enabled ?? [base];

const DAY = 86400000;
const now = Date.now();
const iso = (t) => new Date(t).toISOString().slice(0, 10);

// Past (completed) departures so history has something to attach to.
const pastDeps = [];
for (const [i, t] of treks.entries()) {
  for (const back of [175 + i * 11, 120 + i * 9, 95 + i * 7, 45 + i * 5]) {
    const d = { _id: new ObjectId(), trekId: t._id.toHexString(), startDate: iso(now - back * DAY), capacity: 12, minGroup: 2, offlineBooked: 0, statusOverride: "closed", isPublic: false, notes: "Demo past departure", sample: true, demo: true, createdAt: new Date(now - (back + 60) * DAY), updatedAt: new Date() };
    pastDeps.push(d);
  }
}
await db.collection("departures").insertMany(pastDeps);

const countries = [["GB", 18], ["US", 17], ["DE", 12], ["AU", 10], ["FR", 8], ["NL", 7], ["CA", 7], ["IN", 5], ["CH", 4], ["JP", 4], ["NZ", 3], ["SE", 3], ["ES", 2]];
const trekWeight = (t) => ({ "everest-base-camp-trek": 30, "annapurna-base-camp-trek": 28, "ghorepani-poon-hill-trek": 24, "langtang-valley-trek": 14 }[t.slug] ?? 10);
const N = 190;
const bookings = [];
for (let n = 0; n < N; n++) {
  // More recent weeks are busier, with a mild weekly rhythm (Mondays strongest).
  const ageDays = Math.floor(Math.pow(rnd(), 1.15) * 178);
  const created = new Date(now - ageDays * DAY - Math.floor(rnd() * DAY));
  const dow = created.getUTCDay();
  if ((dow === 6 || dow === 0) && rnd() < 0.45) { n--; continue; }
  const trek = weighted(treks.map((t) => [t, trekWeight(t)]));
  const travellers = weighted([[1, 22], [2, 44], [3, 12], [4, 14], [5, 5], [6, 3]]);
  const eligible = exps.filter((e) => (e.eligibleTrekIds ?? []).includes(trek._id.toHexString()));
  const addOns = eligible.filter(() => rnd() < 0.28).map((e) => ({ id: e._id.toHexString(), name: e.name, price: e.price }));
  const addOnTotal = addOns.reduce((s, a) => s + a.price, 0);
  const subtotal = trek.basePrice * travellers;
  const total = subtotal + addOnTotal;
  const ageStatus = ageDays > 40
    ? weighted([["confirmed", 70], ["cancelled", 12], ["declined", 8], ["reviewing", 4], ["requested", 6]])
    : ageDays > 12 ? weighted([["confirmed", 38], ["reviewing", 28], ["requested", 18], ["cancelled", 6], ["declined", 10]])
    : weighted([["requested", 55], ["reviewing", 30], ["confirmed", 10], ["declined", 5]]);
  const past = pastDeps.filter((d) => d.trekId === trek._id.toHexString() && new Date(d.startDate).getTime() > created.getTime());
  const attach = past.length && rnd() < 0.7 ? pick(past) : null;
  const preferred = attach ? null : iso(created.getTime() + (20 + Math.floor(rnd() * 150)) * DAY);
  const startMs = attach ? new Date(attach.startDate).getTime() : new Date(preferred).getTime();
  const cur = weighted([[base, 60], ...enabled.filter((c) => c !== base).map((c) => [c, 14])]);
  const lead = `Demo Traveller ${String(n + 1).padStart(3, "0")}`;
  bookings.push({
    ref: "PT-" + randomBytes(4).toString("hex").toUpperCase(), source: rnd() < 0.15 ? "offline" : "website", demo: true, sample: true,
    trekId: trek._id.toHexString(), trekName: trek.name,
    departureId: attach ? attach._id.toHexString() : null, departureDate: attach ? attach.startDate : null, preferredDate: preferred,
    travellers, pricePerPerson: trek.basePrice, trekSubtotal: subtotal, addOns, addOnTotal, total,
    currency: base, displayCurrency: cur, displayTotalEstimate: cur !== base && rates[cur] ? Math.round(total * rates[cur]) : null,
    lead: { name: lead, email: `demo${n + 1}@example.test`, phone: "+1 555 0100", country: weighted(countries) },
    travellerNames: "", message: "", acknowledgements: { terms: true, cancellation: true, privacy: true, fitness: true },
    status: startMs < created.getTime() ? "cancelled" : ageStatus, adminNotes: "", createdAt: created, updatedAt: created,
  });
}
await db.collection("bookings").insertMany(bookings);

const inquiries = [];
for (let n = 0; n < 60; n++) {
  const created = new Date(now - Math.floor(Math.pow(rnd(), 1.1) * 175) * DAY - Math.floor(rnd() * DAY));
  const old = now - created.getTime() > 14 * DAY;
  inquiries.push({ name: `Demo Contact ${n + 1}`, email: `inquiry${n + 1}@example.test`, phone: "", country: weighted(countries), message: pick(["Is a private departure possible in spring?", "What is the minimum fitness level for this route?", "Can you arrange a pickup from Tribhuvan airport?", "Do you offer a single-room supplement on the trail?", "How early should we book for October?", "Can the itinerary be extended by two days for acclimatisation?"]), status: old ? weighted([["answered", 60], ["closed", 35], ["new", 5]]) : weighted([["new", 50], ["answered", 45], ["closed", 5]]), demo: true, createdAt: created });
}
await db.collection("inquiries").insertMany(inquiries);

console.log(`added ${bookings.length} demo bookings, ${pastDeps.length} past departures, ${inquiries.length} inquiries (all flagged demo)`);
await client.close();
