// Sample guide profiles and blog posts. Runs only on empty collections.
//
//   node scripts/seed-guides-blog.mjs
//
// Guide profiles are clearly marked placeholders: no invented names,
// licences, languages or years of experience. Replace them with real guides,
// with each guide's written consent, before launch. Two of the posts describe
// how this site actually works (booking requests, route weather), so they are
// accurate as written; the third is a placeholder for a guide's own story.

import { MongoClient } from "mongodb";

const client = await MongoClient.connect(process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017");
const db = client.db(process.env.MONGODB_DB ?? "palatrek");
const now = new Date();
const today = now.toISOString().slice(0, 10);

await db.collection("guides").createIndex({ slug: 1 }, { unique: true });
await db.collection("posts").createIndex({ slug: 1 }, { unique: true });

const trekId = async (slug) => (await db.collection("treks").findOne({ slug }, { projection: { _id: 1 } }))?._id.toHexString();
const [ebc, abc, poon, langtang] = await Promise.all(["everest-base-camp-trek", "annapurna-base-camp-trek", "ghorepani-poon-hill-trek", "langtang-valley-trek"].map(trekId));

const placeholderBio = (who) => `This is a placeholder profile. ${who}

Replace it with the guide's own introduction: where they grew up, how they started guiding, the routes they know best and what they enjoy sharing with trekkers. Publish it only with their written consent.`;

if ((await db.collection("guides").countDocuments()) === 0) {
  await db.collection("guides").insertMany([
    {
      slug: "sample-guide-a", name: "Sample Guide A", role: "Lead trekking guide", photo: null,
      summary: "Leads the Everest Base Camp and Langtang Valley treks. Replace with the guide's own introduction.",
      yearsLeading: null, languages: [], certifications: [],
      bio: placeholderBio("It shows how a guide who leads the Everest and Langtang treks appears on the site."),
      trekIds: [ebc, langtang].filter(Boolean), consent: true, status: "published", sample: true, createdAt: now, updatedAt: now,
    },
    {
      slug: "sample-guide-b", name: "Sample Guide B", role: "Trekking guide", photo: null,
      summary: "Leads the Annapurna Base Camp and Ghorepani Poon Hill treks. Replace with the guide's own introduction.",
      yearsLeading: null, languages: [], certifications: [],
      bio: placeholderBio("It shows how a guide who leads the Annapurna treks appears on the site."),
      trekIds: [abc, poon].filter(Boolean), consent: true, status: "published", sample: true, createdAt: now, updatedAt: now,
    },
  ]);
  console.log("Inserted 2 sample guide profiles");
} else console.log("guides: not empty, left untouched");

const guideA = (await db.collection("guides").findOne({ slug: "sample-guide-a" }))?._id.toHexString() ?? null;
const allTreks = [ebc, abc, poon, langtang].filter(Boolean);

if ((await db.collection("posts").countDocuments()) === 0) {
  await db.collection("posts").insertMany([
    {
      slug: "how-a-booking-request-works",
      title: "How a booking request works",
      excerpt: "What happens between pressing Send and setting off: no payment online, a reference straight away, and a person who checks every request.",
      cover: { src: "/media/photos/trekkers-khumbu.jpg", alt: "A group of trekkers on the trail to Everest Base Camp", caption: "", credit: "" },
      body: `When you book a trek on this site, you send a request. Nothing is charged online.

## What you send
- The trek, and either a published departure or your preferred start date
- How many people are travelling
- Any optional experiences you want to add, each at its fixed stated price
- Your contact details, and your agreement to the booking terms, cancellation policy and privacy notice

## What happens next
You get a booking reference straight away. Your request holds the spaces on that departure while we review it, so the board shows the right number of places left.

A member of the team checks availability, then contacts you by email to confirm the trip and arrange payment in the site's base currency. Prices shown in other currencies are estimates; the amount you pay is the base-currency total shown when you booked.

## If something changes
If a route advisory pauses bookings on a trek, the booking form says so and requests can't be sent until it is lifted. You can always write to us through the contact page.`,
      tags: ["Booking", "Planning"], authorGuideId: null, relatedTrekIds: [],
      publishedAt: today, seoDescription: "How booking requests work at Pala Trekking: no online payment, an instant reference, and confirmation by email.",
      status: "published", sample: false, createdAt: now, updatedAt: now,
    },
    {
      slug: "reading-the-weather-on-each-stop",
      title: "Reading the weather on each overnight stop",
      excerpt: "Every trek page shows conditions where you will actually sleep. Here is what the numbers mean, and what they don't.",
      cover: { src: "/media/photos/tengboche.jpg", alt: "Tengboche Buddhist monastery", caption: "", credit: "" },
      body: `Each night on a trek page has its own weather, for the place you will sleep rather than the nearest town.

## Now, or a forecast
By default you see current conditions at every stop, labelled as now. They are not a forecast for your travel dates.

Choose one of the departures and the page switches to the forecast for the exact night you would be at each stop, as long as that date falls inside the forecast window of about 16 days. Further out, the page says the forecast isn't available yet, and shows the seasonal guidance written for that stop.

## Why it can be missing
- A stop's live weather can be switched off, for example when an advisory is active
- The weather service can be unreachable; the itinerary still loads, with a clear message instead of numbers

## What it can't tell you
Weather data never declares a route safe or open. Conditions in the mountains change quickly, and your guide's judgement on the day comes first.

The oxygen figure on the elevation chart is an estimate from the standard atmosphere: a rough guide to how thin the air is at each night's altitude, not a medical measurement.`,
      tags: ["Weather", "Altitude", "Planning"], authorGuideId: null, relatedTrekIds: allTreks,
      publishedAt: today, seoDescription: "How to read the per-stop weather on Pala Trekking trek pages: current conditions, departure forecasts and seasonal guidance.",
      status: "published", sample: false, createdAt: now, updatedAt: now,
    },
    {
      slug: "sample-a-guides-note-from-the-trail",
      title: "Sample: a guide's note from the trail",
      excerpt: "Placeholder for a story written by one of your guides. Replace it with their own words.",
      cover: { src: "/media/photos/namche.jpg", alt: "Namche Bazaar seen from above", caption: "", credit: "" },
      body: `This is a placeholder post. It shows how a story written by a guide appears, linked to their profile and to the trek it is about.

Replace it with a real piece by one of your guides, for example a favourite stretch of trail, advice on acclimatisation days, or what a typical evening in a lodge is like.`,
      tags: ["Stories"], authorGuideId: guideA, relatedTrekIds: [ebc].filter(Boolean),
      publishedAt: today, seoDescription: "",
      status: "published", sample: true, createdAt: now, updatedAt: now,
    },
  ]);
  console.log("Inserted 3 posts (2 describe the site as built, 1 sample)");
} else console.log("posts: not empty, left untouched");

await client.close();
