"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db, C } from "../db";
import { oid, plain } from "../serialize";
import { departureState, bookable, SEAT_HOLDING } from "../departures";
import { COUNTRY_CODES } from "../countries";
import { convert } from "../format";
import type { Departure, Experience, Trek, SiteSettings } from "../types";
import { DEFAULT_SETTINGS } from "../defaults";
import { clientIp } from "../net";

export type FormState = { ok: boolean; message?: string; errors?: Record<string, string> };

// Per-kind global caps per hour. These hold even when the client IP cannot be
// trusted (spoofed headers, no proxy), so a flood cannot fill the database.
const GLOBAL_PER_HOUR: Record<string, number> = { booking: 120, inquiry: 120 };
let logIndexed = false;

async function rateLimited(kind: string, perHour: number): Promise<boolean> {
  const ip = await clientIp();
  const log = (await db()).collection("submissionLog");
  if (!logIndexed) {
    await log.createIndex({ at: 1 }, { expireAfterSeconds: 2 * 3600 }).catch(() => {});
    await log.createIndex({ kind: 1, ip: 1, at: 1 }).catch(() => {});
    logIndexed = true;
  }
  const since = new Date(Date.now() - 3600_000);
  const [mine, all] = await Promise.all([
    log.countDocuments({ ip, kind, at: { $gt: since } }),
    log.countDocuments({ kind, at: { $gt: since } }),
  ]);
  if (mine >= perHour || all >= (GLOBAL_PER_HOUR[kind] ?? 120)) return true;
  await log.insertOne({ ip, kind, at: new Date() });
  return false;
}

const errorsOf = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [String(i.path[0]), i.message]));

const phone = z.string().trim().regex(/^\+?[0-9 ()\-.]{6,22}$/, "Enter a phone number with country code, for example +44 20 7946 0000");
const countries = COUNTRY_CODES as [string, ...string[]];

// ------------------------------------------------------------- inquiry ----
const InquirySchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().email("Enter a valid email address").max(200),
  phone: z.union([phone, z.literal("")]).optional(),
  country: z.union([z.enum(countries), z.literal("")]).optional(),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(4000),
  privacy: z.literal("on", { message: "Please accept the privacy notice" }),
  website: z.string().optional(), // honeypot: must stay empty
});

export async function submitInquiry(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = InquirySchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, errors: errorsOf(parsed.error), message: "Please check the highlighted fields." };
  if (parsed.data.website) return { ok: true, message: "Thank you." };
  if (await rateLimited("inquiry", 8)) return { ok: false, message: "Too many messages from this connection. Please try again later." };
  const { name, email, phone, country, message } = parsed.data;
  const data = { name, email, phone, country, message };
  await (await db()).collection(C.inquiries).insertOne({ ...data, status: "new", createdAt: new Date() });
  return { ok: true, message: "Thank you. Your message has been saved and the team will reply by email." };
}

// ------------------------------------------------------------- booking ----
const BookingSchema = z.object({
  trekSlug: z.string().min(1),
  departureId: z.string().optional().default(""),
  preferredDate: z.string().optional().default(""),
  travellers: z.coerce.number().int().min(1, "At least one traveller").max(20, "For groups over 20, please contact us"),
  addOnIds: z.array(z.string()).max(10).default([]),
  displayCurrency: z.string().max(3).default(""),
  name: z.string().trim().min(2, "Enter the lead traveller's full name").max(120),
  email: z.string().trim().email("Enter a valid email address").max(200),
  phone,
  country: z.enum(countries, { message: "Select a country" }),
  travellerNames: z.string().trim().max(1000).default(""),
  message: z.string().trim().max(3000).default(""),
  terms: z.literal("on", { message: "Please accept the booking terms" }),
  cancellation: z.literal("on", { message: "Please accept the cancellation policy" }),
  privacy: z.literal("on", { message: "Please accept the privacy notice" }),
  fitness: z.literal("on", { message: "Please confirm the fitness and insurance requirements" }),
  website: z.string().optional(),
});

export async function submitBooking(_: FormState, fd: FormData): Promise<FormState> {
  const raw = { ...Object.fromEntries(fd), addOnIds: fd.getAll("addOnIds").map(String) };
  const parsed = BookingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: errorsOf(parsed.error), message: "Please check the highlighted fields." };
  const v = parsed.data;
  if (v.website) return { ok: false, message: "Submission rejected." };

  const database = await db();
  const trekDoc = await database.collection(C.treks).findOne({ slug: v.trekSlug, status: "published" });
  if (!trekDoc) return { ok: false, message: "This trek is no longer available." };
  const trek = plain<Trek>(trekDoc);

  const suspended = await database.collection(C.advisories).countDocuments({ active: true, suspendBooking: true, trekIds: trek.id });
  if (suspended) return { ok: false, message: "Bookings for this trek are paused because of a route advisory." };

  // A departure, or a preferred future start date, is required.
  let departure: Departure | null = null;
  const todayIso = new Date().toISOString().slice(0, 10);
  if (v.departureId) {
    const id = oid(v.departureId);
    const d = id ? await database.collection(C.departures).findOne({ _id: id, trekId: trek.id, isPublic: true }) : null;
    if (!d) return { ok: false, errors: { departureId: "Choose an available departure" }, message: "That departure is not available." };
    departure = plain<Departure>(d);
    const held = await database.collection(C.bookings).aggregate<{ n: number }>([
      { $match: { departureId: departure.id, status: { $in: SEAT_HOLDING } } },
      { $group: { _id: null, n: { $sum: "$travellers" } } },
    ]).toArray();
    const st = departureState(departure, held[0]?.n ?? 0, todayIso);
    if (!bookable(st.status)) return { ok: false, errors: { departureId: "This departure is no longer taking bookings" }, message: "Please choose another departure." };
    if (st.spacesLeft < v.travellers) return { ok: false, errors: { travellers: `Only ${st.spacesLeft} spaces remain on this departure` }, message: "Not enough spaces on that departure." };
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(v.preferredDate) || v.preferredDate <= todayIso) {
    return { ok: false, errors: { departureId: "Choose a departure or a preferred future start date" }, message: "Please choose when you want to travel." };
  }

  // Add-ons: published and eligible for this trek only (FR 05).
  const addOnOids = v.addOnIds.map(oid).filter(Boolean);
  const addOns = addOnOids.length
    ? plain<Experience[]>(await database.collection(C.experiences).find({ _id: { $in: addOnOids as never[] }, status: "published", eligibleTrekIds: trek.id }).toArray())
    : [];
  if (addOns.length !== new Set(v.addOnIds).size) return { ok: false, message: "One of the selected experiences is no longer available. Please review your selection." };

  const settingsDoc = await database.collection(C.settings).findOne({ _id: "site" as never });
  const stored = settingsDoc ? plain<Partial<SiteSettings>>(settingsDoc) : {};
  const currency = { ...DEFAULT_SETTINGS.currency, ...(stored.currency ?? {}) };
  const base = currency.base;
  // FR 06: the add-on's stated price is added to the total; no cost calculator.
  const trekSubtotal = trek.basePrice * v.travellers;
  const addOnTotal = addOns.reduce((s, a) => s + a.price, 0);
  const total = trekSubtotal + addOnTotal;
  const displayCurrency = currency.enabled.includes(v.displayCurrency) ? v.displayCurrency : base;
  const estimate = displayCurrency !== base ? convert(total, displayCurrency, base, currency.rates) : null;

  if (await rateLimited("booking", 6)) return { ok: false, message: "Too many booking requests from this connection. Please try again later or contact us." };

  const ref = "PT-" + randomBytes(6).toString("hex").toUpperCase().slice(0, 8);
  const now = new Date();
  await database.collection(C.bookings).insertOne({
    ref, source: "website", trekId: trek.id, trekName: trek.name,
    departureId: departure?.id ?? null, departureDate: departure?.startDate ?? null,
    preferredDate: departure ? null : v.preferredDate,
    travellers: v.travellers, pricePerPerson: trek.basePrice, trekSubtotal,
    addOns: addOns.map((a) => ({ id: a.id, name: a.name, price: a.price })), addOnTotal, total,
    currency: base, displayCurrency, displayTotalEstimate: estimate,
    rateUsed: estimate != null ? currency.rates[displayCurrency] ?? null : null,
    lead: { name: v.name, email: v.email.toLowerCase(), phone: v.phone, country: v.country },
    travellerNames: v.travellerNames, message: v.message,
    acknowledgements: { terms: true, cancellation: true, privacy: true, fitness: true },
    status: "requested", adminNotes: "", createdAt: now, updatedAt: now,
  });
  updateTag("departures");
  redirect(`/book/confirmation/${ref}`);
}
