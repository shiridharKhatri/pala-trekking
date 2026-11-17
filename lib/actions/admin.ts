"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { db, C } from "../db";
import { oid } from "../serialize";
import {
  audit, createSession, destroySession, hashPassword, loginBlocked, recordFailedLogin, requireAdmin, verifyAgainstDummy, verifyPassword,
} from "../auth";
import { clientIp } from "../net";

// Ids arrive from the client (bound action arguments are not encrypted), so
// every one is validated before it reaches a query.
function idOrThrow(id: unknown) {
  const o = typeof id === "string" ? oid(id) : null;
  if (!o) throw new Error("Invalid id");
  return o;
}
import { CURRENCY_CODES, ENTITIES, type EntityDef, type Field } from "../admin/entities";
import { getEntity, loadOptions } from "../admin/data";
import { BOOKING_STATUSES, type AdminUser, type Role } from "../types";
import { COUNTRY_CODES } from "../countries";
import { SEAT_HOLDING } from "../departures";

export type AdminState = { ok: boolean; message?: string; errors?: Record<string, string> };

// ------------------------------------------------------------- session ----
export async function login(_: AdminState, fd: FormData): Promise<AdminState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(fd.get("password") ?? "").slice(0, 1024);
  if (!email || !password) return { ok: false, message: "Enter your email and password." };
  if (await loginBlocked(email)) return { ok: false, message: "Too many failed attempts. Try again in 15 minutes." };
  const database = await db();
  const u = await database.collection(C.users).findOne({ email, active: true });
  // Unknown accounts still pay for a full hash check (no timing enumeration).
  const valid = u ? await verifyPassword(password, u.passwordHash) : await verifyAgainstDummy(password);
  if (!u || !valid) {
    await recordFailedLogin(email);
    await database.collection(C.audit).insertOne({ userId: null, email, action: "login.failed", target: "session", detail: { ip: await clientIp() }, at: new Date() });
    return { ok: false, message: "Email or password is incorrect." };
  }
  await createSession(u._id.toHexString());
  await database.collection(C.users).updateOne({ _id: u._id }, { $set: { lastLoginAt: new Date() } });
  await database.collection(C.audit).insertOne({ userId: u._id.toHexString(), email, action: "login", target: "session", detail: { ip: await clientIp() }, at: new Date() });
  redirect(u.mustChangePassword ? "/admin/account?first=1" : "/admin");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}

export async function changePassword(_: AdminState, fd: FormData): Promise<AdminState> {
  const me = await requireAdmin(undefined, { allowPendingPassword: true });
  const current = String(fd.get("current") ?? "").slice(0, 1024);
  const next = String(fd.get("next") ?? "");
  if (next.length < 12) return { ok: false, errors: { next: "Use at least 12 characters." } };
  if (next.length > 256) return { ok: false, errors: { next: "Use at most 256 characters." } };
  if (next === current) return { ok: false, errors: { next: "Choose a password different from the current one." } };
  if (next !== String(fd.get("confirm") ?? "")) return { ok: false, errors: { confirm: "The passwords do not match." } };
  const users = (await db()).collection(C.users);
  const u = await users.findOne({ _id: oid(me.id)! });
  if (!u || !(await verifyPassword(current, u.passwordHash))) return { ok: false, errors: { current: "Current password is incorrect." } };
  await users.updateOne({ _id: u._id }, { $set: { passwordHash: await hashPassword(next), mustChangePassword: false, updatedAt: new Date() } });
  // Sign out every session, then issue a fresh one for this browser.
  await (await db()).collection(C.sessions).deleteMany({ userId: me.id });
  await createSession(me.id);
  await audit(me, "password.change", `users/${me.id}`);
  return { ok: true, message: "Password updated. Other sessions have been signed out." };
}

// ---------------------------------------------------------- entity save ---
function canEdit(def: EntityDef, user: AdminUser) {
  return def.roles.includes(user.role);
}

async function parseFields(def: EntityDef, fd: FormData, role: Role, isNew: boolean) {
  const errors: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const options = await loadOptions(def.fields);
  const opts = (f: Field) => f.options ?? (f.optionSource ? options[f.optionSource] ?? [] : []);
  const MediaZ = z.object({ src: z.string().max(300).regex(/^\/(media|uploads)\/(?!.*\.\.)[\w\-/]+(\.[\w\-]+)*\.(jpe?g|png|webp|avif)$/i, "Use an image path under /media/ or /uploads/ ending in .jpg, .png, .webp or .avif"), alt: z.string().trim().min(3, "Alternative text is required"), caption: z.string().trim().default(""), credit: z.string().trim().default("") });

  for (const f of def.fields) {
    if (role !== "admin" && f.adminOnly) continue;
    if (f.readOnlyOnEdit && !isNew) continue;
    const raw = fd.get(f.name);
    const s = typeof raw === "string" ? raw.trim() : "";
    switch (f.type) {
      case "text":
      case "textarea": {
        if (f.required && !s) errors[f.name] = "Required";
        else if (f.max && s.length > f.max) errors[f.name] = `Keep it under ${f.max} characters`;
        else if (f.pattern && s && !new RegExp(f.pattern).test(s)) errors[f.name] = "Use lowercase letters, numbers and hyphens";
        values[f.name] = s;
        break;
      }
      case "number": {
        if (!s) { if (f.required) errors[f.name] = "Required"; values[f.name] = null; break; }
        const n = Number(s);
        if (!Number.isFinite(n)) errors[f.name] = "Enter a number";
        else if (f.min != null && n < f.min) errors[f.name] = `Minimum ${f.min}`;
        else if (f.max != null && n > f.max) errors[f.name] = `Maximum ${f.max}`;
        values[f.name] = n;
        break;
      }
      case "select": {
        const valid = opts(f).some((o) => o.value === s);
        if (f.required && !s) errors[f.name] = "Required";
        else if (s && !valid) errors[f.name] = "Choose an option from the list";
        values[f.name] = s || (f.required ? s : null);
        break;
      }
      case "checkbox":
        values[f.name] = raw === "on";
        break;
      case "date":
        if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) errors[f.name] = "Use a valid date";
        if (f.required && !s) errors[f.name] = "Required";
        values[f.name] = s || null;
        break;
      case "lines":
        values[f.name] = s.split("\n").map((l) => l.trim()).filter(Boolean);
        break;
      case "multiselect": {
        const allowed = new Set(opts(f).map((o) => o.value));
        values[f.name] = fd.getAll(f.name).map(String).filter((v) => allowed.has(v));
        break;
      }
      case "media": {
        const src = String(fd.get(`${f.name}.src`) ?? "").trim();
        if (!src) { values[f.name] = null; break; }
        const m = MediaZ.safeParse({ src, alt: fd.get(`${f.name}.alt`), caption: fd.get(`${f.name}.caption`) ?? "", credit: fd.get(`${f.name}.credit`) ?? "" });
        if (!m.success) errors[f.name] = m.error.issues[0].message;
        values[f.name] = m.success ? m.data : null;
        break;
      }
      case "gallery": {
        try {
          const arr = z.array(MediaZ).max(30).parse(JSON.parse(s || "[]"));
          values[f.name] = arr;
        } catch (e) {
          errors[f.name] = e instanceof z.ZodError ? `Gallery: ${e.issues[0].message}` : "Gallery data is invalid";
        }
        break;
      }
      case "itinerary": {
        const stay = new Set(opts(f).map((o) => o.value));
        const Day = z.object({
          day: z.number().int().min(1).max(60),
          start: z.string().trim().min(1, "Each day needs a start"),
          destination: z.string().trim().min(1, "Each day needs a destination"),
          activities: z.string().trim().default(""),
          distanceKm: z.number().min(0).max(200).nullable().default(null),
          walkingHours: z.string().trim().max(40).default(""),
          elevationM: z.number().min(0).max(9000).nullable().default(null),
          stayPointId: z.string().nullable().default(null).refine((v) => v == null || stay.has(v), "Unknown stay point"),
        });
        try {
          const days = z.array(Day).max(60).parse(JSON.parse(s || "[]")).sort((a, b) => a.day - b.day);
          if (new Set(days.map((d) => d.day)).size !== days.length) throw new Error("Day numbers must be unique");
          values[f.name] = days;
        } catch (e) {
          errors[f.name] = e instanceof z.ZodError ? `Itinerary: ${e.issues[0].message}` : `Itinerary: ${(e as Error).message}`;
        }
        break;
      }
      case "rates": {
        const out: Record<string, number> = {};
        for (const line of s.split("\n").map((l) => l.trim()).filter(Boolean)) {
          const m = line.match(/^([A-Z]{3})\s*=\s*([0-9]*\.?[0-9]+)$/);
          if (!m || !CURRENCY_CODES.includes(m[1]) || Number(m[2]) <= 0) { errors[f.name] = `Check the line "${line}"`; break; }
          out[m[1]] = Number(m[2]);
        }
        values[f.name] = out;
        break;
      }
    }
  }
  return { values, errors };
}

function nest(values: Record<string, unknown>): Record<string, unknown> {
  // Mongo $set accepts dotted paths directly; only special conversions here.
  const v = { ...values };
  if (Array.isArray(v["home.trustPoints"])) {
    v["home.trustPoints"] = (v["home.trustPoints"] as string[]).map((l) => {
      const [title, ...rest] = l.split("|");
      return { title: title.trim(), body: rest.join("|").trim() };
    });
  }
  return v;
}

export async function saveEntity(key: string, id: string | null, _: AdminState, fd: FormData): Promise<AdminState> {
  const def = Object.hasOwn(ENTITIES, key) ? ENTITIES[key] : undefined;
  if (!def) return { ok: false, message: "Unknown record type." };
  if (id !== null && def.collection !== C.settings && !oid(String(id))) return { ok: false, message: "Invalid record." };
  const user = await requireAdmin(def.roles);
  if (!canEdit(def, user)) return { ok: false, message: "You do not have permission to edit this." };
  const isNew = !id && def.collection !== C.settings;
  if (isNew && !def.canCreate) return { ok: false, message: "Records of this type cannot be created here." };

  const { values, errors } = await parseFields(def, fd, user.role, isNew);
  const database = await db();
  const coll = database.collection(def.collection);
  const existing = id ? await getEntity(def, id) : null;
  if (id && !existing && def.collection !== C.settings) return { ok: false, message: "This record no longer exists." };

  // Cross-field checks.
  if (typeof values.slug === "string" && values.slug) {
    const clash = await coll.findOne({ slug: values.slug, ...(id ? { _id: { $ne: oid(id)! } } : {}) });
    if (clash) errors.slug = "Another record already uses this URL slug";
  }
  if (key === "treks") {
    const min = Number(values.walkingHoursMin ?? existing?.walkingHoursMin ?? 0);
    const max = Number(values.walkingHoursMax ?? existing?.walkingHoursMax ?? 0);
    if (min > max) errors.walkingHoursMax = "Maximum must be at least the minimum";
    const status = (values.status ?? existing?.status ?? "draft") as string;
    const itinerary = (values.itinerary ?? existing?.itinerary ?? []) as unknown[];
    const price = Number(values.basePrice ?? existing?.basePrice ?? 0);
    const hero = values.heroImage !== undefined ? values.heroImage : existing?.heroImage;
    if (status === "published") {
      if (!itinerary.length) errors.itinerary = "A published trek needs a day-by-day itinerary";
      if (!(price > 0)) errors.basePrice = "A published trek needs a price";
      if (!hero) errors.heroImage = "A published trek needs a featured image";
    }
  }
  if (key === "guides") {
    // A real person's profile goes public only with their recorded consent.
    const status = (values.status ?? existing?.status ?? "draft") as string;
    const consent = values.consent !== undefined ? values.consent : existing?.consent;
    if (status === "published" && !consent) errors.status = "Record the guide's consent before publishing this profile";
  }
  if (key === "posts") {
    const status = (values.status ?? existing?.status ?? "draft") as string;
    if (status === "published" && !values.publishedAt && !existing?.publishedAt) values.publishedAt = new Date().toISOString().slice(0, 10);
  }
  if (Object.keys(errors).length) return { ok: false, errors, message: "Please correct the highlighted fields." };

  const now = new Date();
  const data = nest(values);
  if (def.collection === C.settings) {
    await coll.updateOne({ _id: "site" as never }, { $set: { ...data, updatedAt: now } }, { upsert: true });
  } else if (isNew) {
    const defaults: Record<string, unknown> = { createdAt: now };
    if (def.hasStatus && data.status === undefined) defaults.status = "draft";
    if (key === "treks") Object.assign(defaults, { basePrice: 0, featured: false, sample: false, itinerary: data.itinerary ?? [], gallery: data.gallery ?? [] });
    if (key === "experiences") Object.assign(defaults, { price: 0, eligibleTrekIds: [], sample: false });
    if (key === "guides") Object.assign(defaults, { consent: false, trekIds: [], languages: [], certifications: [], sample: false });
    if (key === "posts") Object.assign(defaults, { tags: [], relatedTrekIds: [], authorGuideId: null, sample: false });
    if (key === "departures") Object.assign(defaults, { offlineBooked: data.offlineBooked ?? 0, minGroup: data.minGroup ?? 2 });
    const res = await coll.insertOne({ ...defaults, ...data, updatedAt: now });
    await audit(user, "create", `${def.collection}/${res.insertedId.toHexString()}`);
    def.tags.forEach((t) => updateTag(t));
    redirect(`/admin/${key}/${res.insertedId.toHexString()}?saved=1`);
  } else {
    await coll.updateOne({ _id: oid(id!)! }, { $set: { ...data, updatedAt: now } });
  }
  await audit(user, "update", `${def.collection}/${id ?? "site"}`, { fields: Object.keys(data) });
  def.tags.forEach((t) => updateTag(t));
  return { ok: true, message: "Saved. The public site has been updated." };
}

export async function setStatus(key: string, id: string, status: "draft" | "published" | "archived"): Promise<void> {
  const def = Object.hasOwn(ENTITIES, key) ? ENTITIES[key] : undefined;
  if (!def?.hasStatus) return;
  const user = await requireAdmin(["admin"]);
  if (!["draft", "published", "archived"].includes(status)) throw new Error("Invalid status");
  const _id = idOrThrow(id);
  const coll = (await db()).collection(def.collection);
  if (status === "published" && key === "treks") {
    const t = await coll.findOne({ _id });
    if (!t?.itinerary?.length || !(t.basePrice > 0) || !t.heroImage) redirect(`/admin/${key}/${_id.toHexString()}?publishError=1`);
  }
  if (status === "published" && key === "guides") {
    const g = await coll.findOne({ _id });
    if (!g?.consent) redirect(`/admin/${key}/${_id.toHexString()}?publishError=consent`);
  }
  const extra: Record<string, unknown> = {};
  if (status === "published" && key === "posts") {
    const p = await coll.findOne({ _id });
    if (!p?.publishedAt) extra.publishedAt = new Date().toISOString().slice(0, 10);
  }
  await coll.updateOne({ _id }, { $set: { status, ...extra, updatedAt: new Date() } });
  await audit(user, `status.${status}`, `${def.collection}/${id}`);
  def.tags.forEach((t) => updateTag(t));
}

export async function deleteEntity(key: string, id: string): Promise<void> {
  const def = Object.hasOwn(ENTITIES, key) ? ENTITIES[key] : undefined;
  if (!def?.canDelete) return;
  const user = await requireAdmin(def.roles);
  const _id = idOrThrow(id);
  const hex = _id.toHexString();
  const database = await db();
  if (key === "departures") {
    const n = await database.collection(C.bookings).countDocuments({ departureId: hex });
    if (n) redirect(`/admin/departures/${hex}?deleteBlocked=1`);
  }
  await database.collection(def.collection).deleteOne({ _id });
  await audit(user, "delete", `${def.collection}/${hex}`);
  def.tags.forEach((t) => updateTag(t));
  redirect(`/admin/${key}?deleted=1`);
}

// ------------------------------------------------------------- bookings ---
export async function updateBooking(id: string, _: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requireAdmin(["admin"]);
  const status = String(fd.get("status") ?? "");
  if (!BOOKING_STATUSES.includes(status as never)) return { ok: false, message: "Choose a valid status." };
  const adminNotes = String(fd.get("adminNotes") ?? "").slice(0, 5000);
  const r = await (await db()).collection(C.bookings).updateOne({ _id: idOrThrow(id) }, { $set: { status, adminNotes, updatedAt: new Date() } });
  if (!r.matchedCount) return { ok: false, message: "Booking not found." };
  await audit(user, "booking.update", `bookings/${id}`, { status });
  updateTag("departures");
  return { ok: true, message: "Booking updated. Remember to tell the customer: email notifications are not connected yet." };
}

const OfflineSchema = z.object({
  departureId: z.string().min(1, "Choose a departure"),
  travellers: z.coerce.number().int().min(1).max(60),
  name: z.string().trim().min(2, "Enter a name").max(120),
  email: z.string().trim().email("Enter a valid email").or(z.literal("")),
  phone: z.string().trim().max(30).default(""),
  country: z.union([z.enum(COUNTRY_CODES as [string, ...string[]]), z.literal("")]),
  total: z.coerce.number().min(0),
  adminNotes: z.string().trim().max(3000).default(""),
});

export async function createOfflineBooking(_: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requireAdmin(["admin"]);
  const p = OfflineSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, errors: Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const v = p.data;
  const database = await db();
  const depId = oid(v.departureId);
  const dep = depId ? await database.collection(C.departures).findOne({ _id: depId }) : null;
  if (!dep) return { ok: false, errors: { departureId: "Departure not found" } };
  const trekOid = oid(String(dep.trekId));
  const trek = trekOid ? await database.collection(C.treks).findOne({ _id: trekOid }) : null;
  const held = await database.collection(C.bookings).aggregate<{ n: number }>([
    { $match: { departureId: v.departureId, status: { $in: SEAT_HOLDING } } }, { $group: { _id: null, n: { $sum: "$travellers" } } },
  ]).toArray();
  const free = dep.capacity - (dep.offlineBooked ?? 0) - (held[0]?.n ?? 0);
  if (v.travellers > free) return { ok: false, errors: { travellers: `Only ${Math.max(0, free)} spaces remain` } };
  const settings = await database.collection(C.settings).findOne({ _id: "site" as never });
  const now = new Date();
  const ref = "PT-" + randomBytes(6).toString("hex").toUpperCase().slice(0, 8);
  await database.collection(C.bookings).insertOne({
    ref, source: "offline", trekId: dep.trekId, trekName: trek?.name ?? "", departureId: v.departureId, departureDate: dep.startDate, preferredDate: null,
    travellers: v.travellers, pricePerPerson: trek?.basePrice ?? 0, trekSubtotal: v.total, addOns: [], addOnTotal: 0, total: v.total,
    currency: settings?.currency?.base ?? "USD", displayCurrency: settings?.currency?.base ?? "USD", displayTotalEstimate: null,
    lead: { name: v.name, email: v.email.toLowerCase(), phone: v.phone, country: v.country }, travellerNames: "", message: "",
    acknowledgements: { terms: false, cancellation: false, privacy: false, fitness: false },
    status: "confirmed", adminNotes: v.adminNotes, createdAt: now, updatedAt: now, createdBy: user.id,
  });
  await audit(user, "booking.offline", `bookings/${ref}`);
  updateTag("departures");
  redirect("/admin/bookings?created=1");
}

// ------------------------------------------------------------ inquiries ---
export async function setInquiryStatus(id: string, status: "new" | "answered" | "closed"): Promise<void> {
  const user = await requireAdmin(["admin"]);
  if (!["new", "answered", "closed"].includes(status)) throw new Error("Invalid status");
  await (await db()).collection(C.inquiries).updateOne({ _id: idOrThrow(id) }, { $set: { status, updatedAt: new Date() } });
  await audit(user, "inquiry.status", `inquiries/${id}`, { status });
}

// ---------------------------------------------------------------- media ---
const IMAGE_TYPES: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  "image/png": { ext: "png", magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { ext: "webp", magic: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
};

export async function uploadMedia(_: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requireAdmin(["admin", "content"]);
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, message: "Choose an image to upload." };
  if (file.size > 8 * 1024 * 1024) return { ok: false, message: "Images must be 8 MB or smaller." };
  const t = IMAGE_TYPES[file.type];
  const buf = Buffer.from(await file.arrayBuffer());
  if (!t || !t.magic(buf)) return { ok: false, message: "Only JPEG, PNG or WebP images are accepted." };
  const now = new Date();
  const dir = path.join(process.cwd(), "public", "uploads", String(now.getUTCFullYear()));
  await mkdir(dir, { recursive: true });
  const name = `${now.toISOString().slice(0, 10)}-${randomBytes(6).toString("hex")}.${t.ext}`;
  await writeFile(path.join(dir, name), buf);
  const src = `/uploads/${now.getUTCFullYear()}/${name}`;
  await (await db()).collection("media").insertOne({ src, originalName: file.name.slice(0, 200), size: file.size, type: file.type, uploadedBy: user.id, createdAt: now });
  await audit(user, "media.upload", src);
  return { ok: true, message: src };
}

// ---------------------------------------------------------------- users ---
const UserSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["admin", "content"]),
  password: z.string().min(12, "Temporary password must be at least 12 characters").max(256),
});

export async function createUser(_: AdminState, fd: FormData): Promise<AdminState> {
  const me = await requireAdmin(["admin"]);
  const p = UserSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, errors: Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const users = (await db()).collection(C.users);
  if (await users.findOne({ email: p.data.email })) return { ok: false, errors: { email: "A user with this email already exists" } };
  await users.insertOne({ name: p.data.name, email: p.data.email, role: p.data.role, passwordHash: await hashPassword(p.data.password), mustChangePassword: true, active: true, createdAt: new Date() });
  await audit(me, "user.create", `users/${p.data.email}`, { role: p.data.role });
  return { ok: true, message: `User created. Share the temporary password securely; they must change it at first sign-in.` };
}

export async function setUserActive(id: string, active: boolean): Promise<void> {
  const me = await requireAdmin(["admin"]);
  if (typeof active !== "boolean") throw new Error("Invalid value");
  const _id = idOrThrow(id);
  if (_id.toHexString() === me.id) return; // cannot lock yourself out
  const database = await db();
  await database.collection(C.users).updateOne({ _id }, { $set: { active } });
  if (!active) await database.collection(C.sessions).deleteMany({ userId: _id.toHexString() });
  await audit(me, active ? "user.activate" : "user.deactivate", `users/${id}`);
}
