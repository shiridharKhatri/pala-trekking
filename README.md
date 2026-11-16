# Pala Trekking

Trekking discovery, comparison and booking platform for Himalayan Yogini, built
to the Pala Trekking PRD v1.0. Next.js 16 (App Router, Cache Components),
MongoDB, and the Scroll Craft engine for the scroll-driven storytelling.

## Run it locally

```bash
npm install
cp .env.example .env.local      # then set SEED_ADMIN_PASSWORD
mongod --dbpath .mongo-data      # or any MongoDB 6+ at MONGODB_URI
npm run seed                     # sample catalogue + first admin user
npm run dev                      # http://localhost:3000, admin at /admin
```

`npm run seed -- --reset` replaces catalogue and content collections (bookings
are kept; add `--all` to clear those too). The first admin must change their
password at first sign-in.

## What is real and what is sample

Everything the site shows comes from MongoDB. The seed is **sample data**:

- **Placeholders:** every price, departure date, capacity, exchange rate and the
  advisory. Stored with `sample: true`; the admin dashboard counts them and the
  public site shows a "Preview build" notice until it is switched off in
  *Settings*.
- **To verify:** route structure, stage elevations and stay-point coordinates are
  approximate public figures and must be checked by Pala Trekking.
- **Deliberately empty:** company details, licences, history and reviews. About,
  Terms, Privacy and Cancellation pages are marked as drafts awaiting client text.
- **Photography:** Wikimedia Commons under CC BY / CC BY-SA / CC0, credited on
  `/credits` and in image captions. Replace with the client's own library when available.

## Map of the PRD

| PRD | Where |
|---|---|
| FR 01 catalogue + filters | `/treks` (gateway, region, duration, difficulty, price, search; GET forms work without JS) |
| FR 02 gateway structure | Trek fields pickup, trailhead, destination, ending, return; `/gateways/[slug]` |
| FR 03 package page | `/treks/[slug]`: facts, route line, overview, itinerary, logistics, inclusions, preparation, gallery, JSON-LD |
| FR 04 comparison (≤3) | Compare toggles + tray, `/compare?treks=a,b,c`, standardized fields only |
| FR 05/06 optional experiences | Admin links add-ons to treks; booking adds or skips; total adds the fixed price once |
| FR 07/08 route weather + fallback | `lib/weather.ts` (Open-Meteo), per stay point; current vs forecast labelled; outside the 16-day window shows when a forecast will appear plus seasonal guidance; failures never block the page or the build |
| FR 09/10 departure board | `/departures`; only Pala departures; anonymous counts; no customer data leaves the server |
| FR 11 multicurrency | Base currency + admin rates; converted values shown as "≈" estimates; transaction currency stated at every total |
| FR 12 booking | `/book/[slug]`: departure or preferred date, add-ons, details, four acknowledgements; server recomputes everything; saved as a *request* |
| FR 13 admin | `/admin`: create, edit, publish, unpublish, archive; audit log |
| FR 14 responsive | Verified at 1440, 1280, 390 and 360 px |

## Architecture

- `lib/data/public.ts`: cached reads (`'use cache'` + `cacheTag`). Admin saves call `updateTag`, so changes are visible immediately.
- `lib/actions/public.ts`: booking and inquiry server actions (zod validation, honeypot, per-IP rate limits, capacity check against live counts).
- `lib/actions/admin.ts` + `lib/admin/entities.ts`: schema-driven admin editor. Roles: `admin` (everything) and `content` (descriptions, pages, FAQs, homepage, media). Admin-only fields are ignored server-side for content managers.
- `lib/auth.ts`: scrypt password hashes, random session tokens stored hashed with TTL expiry, httpOnly cookies, login throttling. `proxy.ts` only does an optimistic redirect and adds security headers.
- `vendor/scrollcraft/`: the Scroll Craft engine, unmodified (MIT). Mounted per page by `components/ScrollStage.tsx` with teardown on navigation. Bespoke behaviour lives in `components/Altimeter.tsx` and `components/Ascent.tsx`. Design notes: `docs/scrollcraft/`.
- Reduced motion: engine devices fall back (no parallax, the pan rail becomes a native scroller); the profile renders fully drawn. Without JavaScript, all content is visible.

## Before launch (open PRD decisions)

1. Replace all sample data; turn off the preview notice.
2. **Weather:** Open-Meteo's free API is for non-commercial use. Buy a commercial plan and set `OPEN_METEO_API_KEY`, or choose another provider.
3. **Email notifications** are not connected: bookings and inquiries are saved and visible in the admin, but nobody is emailed yet.
4. **Payment:** implemented as booking request + manual payment (as chosen). A gateway can be added to the booking action later.
5. **Media uploads** are written to `public/uploads` on local disk. Use object storage on serverless or multi-instance hosting.
6. Set `SITE_URL`, HTTPS, MongoDB backups, and review the draft legal pages.
