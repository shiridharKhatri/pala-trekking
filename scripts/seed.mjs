// Seed the Pala Trekking database with SAMPLE content.
//
//   npm run seed            -> inserts only into empty collections
//   npm run seed -- --reset -> drops catalogue/content collections first (never bookings unless --all)
//
// Every commercial value here (prices, dates, capacities, exchange rates) is a
// placeholder and is stored with `sample: true`. Route structure, altitudes and
// coordinates are approximate publicly documented figures and MUST be verified
// by Pala Trekking before launch. Nothing here is a company credential.

import { MongoClient, ObjectId } from "mongodb";
import { readFileSync, existsSync } from "node:fs";
import { scryptSync, randomBytes } from "node:crypto";

for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const RESET = process.argv.includes("--reset");
const ALL = process.argv.includes("--all");
const client = await new MongoClient(process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017").connect();
const db = client.db(process.env.MONGODB_DB ?? "palatrek");
const now = new Date();
const credits = JSON.parse(readFileSync("public/media/photos/credits.json", "utf8"));

function photo(key, alt, caption) {
  const c = credits[key];
  return {
    src: `/media/photos/${key}.jpg`,
    alt,
    caption: caption ?? "",
    credit: c ? `${c.author}, ${c.license}, via Wikimedia Commons` : "",
  };
}

export function hashPassword(pw) {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64")}$${hash.toString("base64")}`;
}

const catalogue = ["gateways", "regions", "treks", "stayPoints", "experiences", "departures", "advisories", "settings", "pages", "faqs"];
if (RESET) {
  for (const c of catalogue) await db.collection(c).deleteMany({});
  if (ALL) for (const c of ["bookings", "inquiries", "audit"]) await db.collection(c).deleteMany({});
  console.log("reset", ALL ? "(including bookings)" : "");
}

async function empty(name) {
  return (await db.collection(name).countDocuments()) === 0;
}

// ---------------------------------------------------------------- indexes --
await db.collection("treks").createIndex({ slug: 1 }, { unique: true });
await db.collection("treks").createIndex({ status: 1, gateway: 1 });
await db.collection("regions").createIndex({ slug: 1 }, { unique: true });
await db.collection("experiences").createIndex({ slug: 1 }, { unique: true });
await db.collection("departures").createIndex({ trekId: 1, startDate: 1 });
await db.collection("bookings").createIndex({ ref: 1 }, { unique: true });
await db.collection("bookings").createIndex({ departureId: 1, status: 1 });
await db.collection("users").createIndex({ email: 1 }, { unique: true });
await db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
await db.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true });
await db.collection("pages").createIndex({ slug: 1 }, { unique: true });
await db.collection("loginAttempts").createIndex({ at: 1 }, { expireAfterSeconds: 900 });
await db.collection("loginAttempts").createIndex({ email: 1, at: 1 });
await db.collection("submissionLog").createIndex({ at: 1 }, { expireAfterSeconds: 7200 });
await db.collection("audit").createIndex({ at: -1 });

if (!(await empty("treks"))) {
  console.log("treks already present; run with --reset to replace sample content");
} else {
  // ------------------------------------------------------------- gateways --
  await db.collection("gateways").insertMany([
    { slug: "kathmandu", name: "Kathmandu", elevationM: 1400, order: 1,
      summary: "Nepal's capital and the starting city for the Everest and Langtang regions. Most international arrivals land here.",
      image: photo("boudha", "The white dome and gilded spire of Boudhanath Stupa in Kathmandu under a grey sky", "Boudhanath, Kathmandu") },
    { slug: "pokhara", name: "Pokhara", elevationM: 822, order: 2,
      summary: "A lakeside city in central Nepal and the starting point for treks in the Annapurna region.",
      image: photo("phewa", "Phewa Lake in Pokhara with forested hills and snow peaks behind", "Phewa Lake, Pokhara") },
  ]);

  // -------------------------------------------------------------- regions --
  const R = {
    everest: new ObjectId(), langtang: new ObjectId(), annapurna: new ObjectId(),
  };
  await db.collection("regions").insertMany([
    { _id: R.everest, slug: "everest", name: "Everest (Khumbu)", gateway: "kathmandu", status: "published", order: 1,
      summary: "High Sherpa villages, monasteries and glacial valleys beneath Everest, Lhotse and Ama Dablam.",
      image: photo("ama-dablam-range", "Ama Dablam rising above a glacial valley in the Khumbu region", "Ama Dablam, Khumbu") },
    { _id: R.langtang, slug: "langtang", name: "Langtang", gateway: "kathmandu", status: "published", order: 2,
      summary: "A glacial valley north of Kathmandu, reached by road, with Tamang villages and high viewpoints.",
      image: photo("langtang", "Snow-dusted slopes of the Langtang valley under a clear blue sky", "Langtang valley") },
    { _id: R.annapurna, slug: "annapurna", name: "Annapurna", gateway: "pokhara", status: "published", order: 3,
      summary: "Rhododendron forest, Gurung villages and the amphitheatre of the Annapurna Sanctuary.",
      image: photo("abc-moditse", "Trail through golden grass toward the snow faces of the Annapurna Sanctuary", "Annapurna Sanctuary") },
  ]);

  // ---------------------------------------------------------- stay points --
  const high = "Main trekking seasons are autumn (October to November) and spring (March to May). At this altitude nights are cold for most of the year and below freezing in winter. Snow can close high trails between December and February.";
  const mid = "Main trekking seasons are autumn (October to November) and spring (March to May). The monsoon (June to September) brings daily rain, cloud and leeches on forest trails.";
  const city = "Warm days in spring and autumn; the monsoon runs roughly June to September.";
  const SP = {};
  const sp = (key, name, lat, lon, elevationM, regionId, guidance) => {
    SP[key] = new ObjectId();
    return { _id: SP[key], name, lat, lon, elevationM, regionId, weatherEnabled: true, seasonalGuidance: guidance, sample: true };
  };
  await db.collection("stayPoints").insertMany([
    sp("ktm", "Kathmandu", 27.7172, 85.324, 1400, null, city),
    sp("pkr", "Pokhara", 28.2096, 83.9856, 822, null, city),
    sp("phakding", "Phakding", 27.7397, 86.713, 2610, R.everest, mid),
    sp("namche", "Namche Bazaar", 27.8048, 86.7144, 3440, R.everest, high),
    sp("tengboche", "Tengboche", 27.8362, 86.764, 3867, R.everest, high),
    sp("dingboche", "Dingboche", 27.8923, 86.8314, 4410, R.everest, high),
    sp("lobuche", "Lobuche", 27.9483, 86.8103, 4940, R.everest, high),
    sp("gorakshep", "Gorak Shep", 27.9806, 86.829, 5164, R.everest, high),
    sp("pheriche", "Pheriche", 27.895, 86.8195, 4371, R.everest, high),
    sp("lukla", "Lukla", 27.6869, 86.7314, 2860, R.everest, mid),
    sp("ghandruk", "Ghandruk", 28.376, 83.807, 1940, R.annapurna, mid),
    sp("chhomrong", "Chhomrong", 28.416, 83.819, 2170, R.annapurna, mid),
    sp("bamboo", "Bamboo", 28.458, 83.835, 2310, R.annapurna, mid),
    sp("deurali", "Deurali", 28.492, 83.864, 3230, R.annapurna, high),
    sp("abc", "Annapurna Base Camp", 28.5306, 83.878, 4130, R.annapurna, high),
    sp("jhinu", "Jhinu Danda", 28.402, 83.824, 1780, R.annapurna, mid),
    sp("ulleri", "Ulleri", 28.354, 83.73, 2020, R.annapurna, mid),
    sp("ghorepani", "Ghorepani", 28.4, 83.7, 2860, R.annapurna, mid),
    sp("tadapani", "Tadapani", 28.3953, 83.7922, 2630, R.annapurna, mid),
    sp("syabru", "Syabrubesi", 28.16, 85.345, 1460, R.langtang, mid),
    sp("lamahotel", "Lama Hotel", 28.1647, 85.4278, 2480, R.langtang, mid),
    sp("langtangv", "Langtang village", 28.214, 85.518, 3430, R.langtang, high),
    sp("kyanjin", "Kyanjin Gompa", 28.211, 85.563, 3870, R.langtang, high),
  ]);

  const day = (d, start, destination, activities, distanceKm, walkingHours, elevationM, stay) => ({
    day: d, start, destination, activities, distanceKm, walkingHours, elevationM, stayPointId: stay ? SP[stay].toHexString() : null,
  });

  const sharedLogistics = {
    accommodation: "Hotel in the gateway city on arrival and departure nights; locally run teahouse lodges on the trail, usually twin rooms with shared bathrooms.",
    meals: "Breakfast in the gateway city. Breakfast, lunch and dinner on trek days, chosen from the teahouse menu.",
    guidePorter: "A licensed English-speaking trekking guide throughout. One porter for every two trekkers, carrying up to an agreed weight limit.",
    supplements: "Single room supplement on request where lodges allow. Optional experiences can be added during booking at a fixed stated price.",
    cancellation: "Cancellation conditions are set out in the Cancellation Policy and confirmed in writing with your booking.",
    safety: "Your guide sets the pace and may change or end the day's walk for safety. Weather shown on this site is information, not a statement that a route is safe or open.",
    insurance: "Travel insurance that covers trekking at the maximum altitude of this route and helicopter evacuation is required.",
    packing: ["Broken-in waterproof trekking boots", "Down jacket and warm layers", "Sleeping bag rated for the coldest night on the route", "Rain shell and trekking poles", "Headtorch, sun hat, sunglasses and sunscreen", "Water bottles and purification tablets", "Personal first-aid kit and any prescribed medication"],
  };

  const T = { ebc: new ObjectId(), abc: new ObjectId(), poon: new ObjectId(), langtang: new ObjectId() };
  const treks = [
    {
      _id: T.ebc, slug: "everest-base-camp-trek", name: "Everest Base Camp Trek", status: "published", featured: true, sample: true,
      regionId: R.everest.toHexString(), gateway: "kathmandu",
      pickupPoint: "Hotel in Kathmandu (Thamel area)", trailhead: "Lukla", destination: "Everest Base Camp and Kala Patthar",
      endingPoint: "Lukla", returnCity: "Kathmandu",
      durationDays: 14, difficulty: "strenuous", maxAltitudeM: 5644, bestSeason: "Mar to May, Oct to Nov",
      walkingHoursMin: 4, walkingHoursMax: 8, basePrice: 1650,
      summary: "Fly to Lukla and walk the Khumbu valley through Namche and Tengboche to Everest Base Camp, with a sunrise climb of Kala Patthar.",
      overview: "This route follows the Dudh Koshi and Imja valleys from Lukla to the foot of the Khumbu Icefall. It builds altitude gradually, with two acclimatisation days at Namche Bazaar and Dingboche, before the highest days at Lobuche, Gorak Shep and Kala Patthar. The return descends quickly through Pheriche and Namche to Lukla for the flight to Kathmandu.",
      highlights: ["Sherpa villages of Namche Bazaar and Khumjung", "Tengboche Monastery", "Everest Base Camp at about 5,364 m", "Sunrise view of Everest from Kala Patthar"],
      fitness: "Good aerobic fitness and experience of multi-day hill walking. Several days exceed 4,000 m, where effort feels much harder than at sea level.",
      travellerProfile: "Fit trekkers with some mountain walking experience who want the classic high route of the Khumbu.",
      itinerary: [
        day(1, "Kathmandu airport", "Kathmandu", "Arrival, transfer to hotel and trek briefing.", null, "", 1400, "ktm"),
        day(2, "Kathmandu", "Phakding", "Morning flight to Lukla, then a gentle descent along the Dudh Koshi. Flights may operate from Ramechhap (Manthali) in peak seasons.", 8, "3 to 4 h", 2610, "phakding"),
        day(3, "Phakding", "Namche Bazaar", "Cross suspension bridges and enter Sagarmatha National Park, then the long climb to Namche.", 10, "5 to 6 h", 3440, "namche"),
        day(4, "Namche Bazaar", "Namche Bazaar", "Acclimatisation day with a short hike above the village and a return to sleep low.", 5, "3 to 4 h", 3440, "namche"),
        day(5, "Namche Bazaar", "Tengboche", "Contour high above the river with views of Ama Dablam, descend to the river, then climb to the monastery.", 10, "5 to 6 h", 3867, "tengboche"),
        day(6, "Tengboche", "Dingboche", "Through Pangboche into the Imja valley.", 11, "5 to 6 h", 4410, "dingboche"),
        day(7, "Dingboche", "Dingboche", "Acclimatisation day with a hike up the ridge above the village.", 5, "3 to 4 h", 4410, "dingboche"),
        day(8, "Dingboche", "Lobuche", "Past the memorials at Thukla to Lobuche below the Khumbu Glacier moraine.", 8, "5 to 6 h", 4940, "lobuche"),
        day(9, "Lobuche", "Gorak Shep", "Walk to Gorak Shep, then on to Everest Base Camp and back.", 13, "7 to 8 h", 5164, "gorakshep"),
        day(10, "Gorak Shep", "Pheriche", "Early climb of Kala Patthar for sunrise, then descend to Pheriche.", 13, "7 to 8 h", 4371, "pheriche"),
        day(11, "Pheriche", "Namche Bazaar", "Descend through Pangboche and Tengboche.", 15, "6 to 7 h", 3440, "namche"),
        day(12, "Namche Bazaar", "Lukla", "Final day on foot, back down the Dudh Koshi to Lukla.", 13, "6 to 7 h", 2860, "lukla"),
        day(13, "Lukla", "Kathmandu", "Flight to Kathmandu. Spare time in case of weather delays.", null, "", 1400, "ktm"),
        day(14, "Kathmandu", "Departure", "Transfer to the airport.", null, "", 1400, null),
      ],
      ...sharedLogistics,
      transport: "Airport transfers in Kathmandu. Return flights Kathmandu (or Ramechhap) to Lukla.",
      inclusions: ["Airport transfers", "Two nights in Kathmandu with breakfast", "Teahouse accommodation on trek", "Three meals a day on trek", "Licensed guide and porter service", "Kathmandu to Lukla return flights", "National park and local area permits"],
      exclusions: ["International flights and Nepal visa", "Travel insurance", "Lunch and dinner in Kathmandu", "Hot showers, charging and Wi-Fi in lodges", "Drinks and snacks", "Tips for guide and porter"],
      altitudeInfo: "The route reaches 5,644 m at Kala Patthar. Two acclimatisation days are built in. Your guide will descend with anyone showing signs of altitude sickness.",
      permits: "Sagarmatha National Park entry permit and Khumbu Pasang Lhamu Rural Municipality permit, arranged by Pala Trekking.",
      heroImage: photo("everest-trail", "Everest's summit pyramid lit orange at sunset above snowfields on the trail to base camp", "On the trail to Everest Base Camp"),
      gallery: [
        photo("namche", "Namche Bazaar's terraced village of coloured roofs on a hillside", "Namche Bazaar"),
        photo("tengboche", "The carved entrance gate of Tengboche Monastery", "Tengboche Monastery"),
        photo("trekkers-khumbu", "A line of trekkers standing on a rocky ridge in the Khumbu", "Trekkers in the Khumbu"),
        photo("mountain-pass", "Prayer flags over a rocky pass with snow peaks behind", "A high pass on the trail"),
      ],
      seoTitle: "Everest Base Camp Trek, 14 days from Kathmandu",
      seoDescription: "14-day Everest Base Camp trek from Kathmandu via Lukla, Namche and Tengboche, with Kala Patthar. Itinerary, altitude, weather and departures.",
    },
    {
      _id: T.abc, slug: "annapurna-base-camp-trek", name: "Annapurna Base Camp Trek", status: "published", featured: true, sample: true,
      regionId: R.annapurna.toHexString(), gateway: "pokhara",
      pickupPoint: "Hotel in Pokhara (Lakeside)", trailhead: "Kimche, near Ghandruk", destination: "Annapurna Base Camp",
      endingPoint: "Jhinu Danda / Siwai", returnCity: "Pokhara",
      durationDays: 10, difficulty: "challenging", maxAltitudeM: 4130, bestSeason: "Mar to May, Oct to Nov",
      walkingHoursMin: 4, walkingHoursMax: 7, basePrice: 980,
      summary: "From Pokhara through Gurung villages and bamboo forest into the Annapurna Sanctuary, a ring of peaks around base camp at 4,130 m.",
      overview: "The trail climbs from the terraced Gurung village of Ghandruk to Chhomrong, then follows the Modi Khola gorge through forest to Deurali and Machhapuchhre Base Camp. The final morning enters the Sanctuary, an amphitheatre of Annapurna I, Hiunchuli and Machhapuchhre. The descent finishes at the Jhinu Danda hot springs.",
      highlights: ["Gurung villages of Ghandruk and Chhomrong", "Bamboo and rhododendron forest of the Modi Khola", "Sunrise inside the Annapurna Sanctuary", "Natural hot springs at Jhinu Danda"],
      fitness: "Regular hill walking fitness. The route has long stone staircases, especially around Chhomrong.",
      travellerProfile: "Trekkers who want high mountain scenery on a shorter route that starts close to Pokhara.",
      itinerary: [
        day(1, "Pokhara", "Pokhara", "Arrival in Pokhara and trek briefing.", null, "", 822, "pkr"),
        day(2, "Pokhara", "Ghandruk", "Drive to Kimche and walk up to Ghandruk.", 6, "3 to 4 h", 1940, "ghandruk"),
        day(3, "Ghandruk", "Chhomrong", "Over Komrong Danda and down to Chhomrong.", 10, "5 to 6 h", 2170, "chhomrong"),
        day(4, "Chhomrong", "Bamboo", "Down the stone stairs, across the river and up through forest.", 8, "5 h", 2310, "bamboo"),
        day(5, "Bamboo", "Deurali", "Through Dovan and Himalaya along the Modi Khola.", 9, "5 h", 3230, "deurali"),
        day(6, "Deurali", "Annapurna Base Camp", "Through Machhapuchhre Base Camp into the Sanctuary.", 7, "4 to 5 h", 4130, "abc"),
        day(7, "Annapurna Base Camp", "Bamboo", "Sunrise at base camp, then a long descent.", 16, "6 to 7 h", 2310, "bamboo"),
        day(8, "Bamboo", "Jhinu Danda", "Back through Chhomrong and down to the hot springs.", 10, "5 h", 1780, "jhinu"),
        day(9, "Jhinu Danda", "Pokhara", "Walk to Siwai and drive back to Pokhara.", 5, "2 to 3 h", 822, "pkr"),
        day(10, "Pokhara", "Departure", "Transfer onward.", null, "", 822, null),
      ],
      ...sharedLogistics,
      transport: "Private vehicle between Pokhara and the trailheads.",
      inclusions: ["Pokhara hotel nights with breakfast", "Teahouse accommodation on trek", "Three meals a day on trek", "Licensed guide and porter service", "Trailhead transfers from Pokhara", "Annapurna Conservation Area permit and TIMS card where required"],
      exclusions: ["Travel to Pokhara", "Travel insurance", "Lunch and dinner in Pokhara", "Hot showers, charging and Wi-Fi in lodges", "Drinks and snacks", "Tips for guide and porter"],
      altitudeInfo: "The highest night is at 4,130 m. The ascent is gradual, but report headaches, nausea or breathlessness at rest to your guide.",
      permits: "Annapurna Conservation Area Project (ACAP) permit, arranged by Pala Trekking.",
      heroImage: photo("abc-snow", "Snow-covered lodges at Annapurna Base Camp beneath the south face of Annapurna", "Annapurna Base Camp"),
      gallery: [
        photo("machapuchare", "Machhapuchhre's fishtail summit glowing at sunset", "Machhapuchhre from Pokhara"),
        photo("abc-moditse", "Golden grass and a trail leading into the Annapurna Sanctuary", "Entering the Sanctuary"),
        photo("ghandruk", "Clouds filling the valleys below the Annapurna range seen from Ghandruk", "View from Ghandruk"),
      ],
      seoTitle: "Annapurna Base Camp Trek, 10 days from Pokhara",
      seoDescription: "10-day Annapurna Base Camp trek from Pokhara through Ghandruk and Chhomrong. Daily stages, altitude, stay-point weather and departures.",
    },
    {
      _id: T.poon, slug: "ghorepani-poon-hill-trek", name: "Ghorepani Poon Hill Trek", status: "published", featured: true, sample: true,
      regionId: R.annapurna.toHexString(), gateway: "pokhara",
      pickupPoint: "Hotel in Pokhara (Lakeside)", trailhead: "Nayapul", destination: "Poon Hill viewpoint",
      endingPoint: "Ghandruk", returnCity: "Pokhara",
      durationDays: 5, difficulty: "moderate", maxAltitudeM: 3210, bestSeason: "Mar to May, Oct to Dec",
      walkingHoursMin: 3, walkingHoursMax: 6, basePrice: 520,
      summary: "A short loop from Pokhara through rhododendron forest to the Poon Hill sunrise over Dhaulagiri and the Annapurnas.",
      overview: "A compact trek that suits limited time. It climbs the stone staircase to Ulleri and Ghorepani, makes a pre-dawn walk to Poon Hill for sunrise, then crosses forested ridges via Tadapani to the Gurung village of Ghandruk.",
      highlights: ["Sunrise over Dhaulagiri and Annapurna South from Poon Hill", "Rhododendron forest, flowering in spring", "Ghandruk village"],
      fitness: "Moderate fitness. Expect long staircases on day one.",
      travellerProfile: "First-time trekkers, families with older children and anyone with under a week.",
      itinerary: [
        day(1, "Pokhara", "Ulleri", "Drive to Nayapul and climb through Tikhedhunga to Ulleri.", 10, "5 to 6 h", 2020, "ulleri"),
        day(2, "Ulleri", "Ghorepani", "Through forest to the ridge village of Ghorepani.", 7, "4 to 5 h", 2860, "ghorepani"),
        day(3, "Ghorepani", "Tadapani", "Pre-dawn walk to Poon Hill (about 3,210 m), breakfast, then along the ridge to Tadapani.", 11, "6 h", 2630, "tadapani"),
        day(4, "Tadapani", "Ghandruk", "Downhill through forest to Ghandruk.", 6, "3 to 4 h", 1940, "ghandruk"),
        day(5, "Ghandruk", "Pokhara", "Short walk to the road and drive to Pokhara.", 4, "2 h", 822, null),
      ],
      ...sharedLogistics,
      transport: "Private vehicle between Pokhara and the trailheads.",
      inclusions: ["Teahouse accommodation on trek", "Three meals a day on trek", "Licensed guide and porter service", "Trailhead transfers from Pokhara", "Annapurna Conservation Area permit"],
      exclusions: ["Accommodation in Pokhara", "Travel insurance", "Hot showers, charging and Wi-Fi in lodges", "Drinks and snacks", "Tips for guide and porter"],
      altitudeInfo: "The highest point is Poon Hill at about 3,210 m and the highest night is at Ghorepani. Altitude sickness is uncommon at these heights but possible.",
      permits: "Annapurna Conservation Area Project (ACAP) permit, arranged by Pala Trekking.",
      heroImage: photo("poon-hill", "Annapurna South and Hiunchuli above pine forest in clear morning light", "Morning above Ghorepani"),
      gallery: [
        photo("dhaulagiri", "Dhaulagiri behind prayer flags and a painted stupa", "Dhaulagiri"),
        photo("ghandruk", "Cloud-filled valleys below the Annapurna range from Ghandruk", "Ghandruk"),
      ],
      seoTitle: "Ghorepani Poon Hill Trek, 5 days from Pokhara",
      seoDescription: "5-day Poon Hill trek from Pokhara: Ulleri, Ghorepani, Poon Hill sunrise, Tadapani and Ghandruk. Itinerary, weather and departures.",
    },
    {
      _id: T.langtang, slug: "langtang-valley-trek", name: "Langtang Valley Trek", status: "published", featured: true, sample: true,
      regionId: R.langtang.toHexString(), gateway: "kathmandu",
      pickupPoint: "Hotel in Kathmandu (Thamel area)", trailhead: "Syabrubesi", destination: "Kyanjin Gompa and Kyanjin Ri",
      endingPoint: "Syabrubesi", returnCity: "Kathmandu",
      durationDays: 8, difficulty: "moderate", maxAltitudeM: 4773, bestSeason: "Mar to May, Oct to Nov",
      walkingHoursMin: 3, walkingHoursMax: 7, basePrice: 690,
      summary: "Reached by road from Kathmandu, the Langtang valley climbs from forest to yak pastures and glaciers at Kyanjin Gompa.",
      overview: "No flights are needed. After a long drive to Syabrubesi, the trail follows the Langtang Khola through forest to Lama Hotel, opens into the upper valley at Langtang village and ends among glaciers at Kyanjin Gompa. A rest day allows a climb of Kyanjin Ri before the return by the same trail.",
      highlights: ["Road access from Kathmandu", "Tamang culture and the rebuilt Langtang village", "Kyanjin Gompa and its cheese factory", "Optional climb of Kyanjin Ri"],
      fitness: "Moderate fitness. The Kyanjin Ri climb is steep and optional.",
      travellerProfile: "Trekkers who prefer to avoid mountain flights and want a high valley in about a week.",
      itinerary: [
        day(1, "Kathmandu", "Syabrubesi", "Long drive north via Dhunche.", null, "7 to 8 h drive", 1460, "syabru"),
        day(2, "Syabrubesi", "Lama Hotel", "Along the Langtang Khola through forest.", 11, "6 h", 2480, "lamahotel"),
        day(3, "Lama Hotel", "Langtang village", "The valley widens above Ghoda Tabela.", 13, "6 h", 3430, "langtangv"),
        day(4, "Langtang village", "Kyanjin Gompa", "Past mani walls and yak pastures.", 7, "3 to 4 h", 3870, "kyanjin"),
        day(5, "Kyanjin Gompa", "Kyanjin Gompa", "Acclimatisation and optional climb of Kyanjin Ri.", 6, "4 to 5 h", 3870, "kyanjin"),
        day(6, "Kyanjin Gompa", "Lama Hotel", "Return down the valley.", 20, "6 to 7 h", 2480, "lamahotel"),
        day(7, "Lama Hotel", "Syabrubesi", "Final day on foot.", 11, "5 h", 1460, "syabru"),
        day(8, "Syabrubesi", "Kathmandu", "Drive back to Kathmandu.", null, "7 to 8 h drive", 1400, null),
      ],
      ...sharedLogistics,
      transport: "Private vehicle or shared jeep between Kathmandu and Syabrubesi.",
      inclusions: ["Teahouse accommodation on trek", "Three meals a day on trek", "Licensed guide and porter service", "Return road transport from Kathmandu", "Langtang National Park permit"],
      exclusions: ["Accommodation in Kathmandu", "Travel insurance", "Hot showers, charging and Wi-Fi in lodges", "Drinks and snacks", "Tips for guide and porter"],
      altitudeInfo: "The highest night is at Kyanjin Gompa (3,870 m). Kyanjin Ri reaches about 4,773 m and is optional.",
      permits: "Langtang National Park entry permit, arranged by Pala Trekking.",
      heroImage: photo("langtang", "Snow-dusted mountainside in the Langtang valley under a deep blue sky", "Upper Langtang valley"),
      gallery: [photo("langtang-chorten", "A chorten on a hillside with misty snow peaks behind in Langtang", "Chorten, Langtang valley")],
      seoTitle: "Langtang Valley Trek, 8 days from Kathmandu",
      seoDescription: "8-day Langtang Valley trek from Kathmandu by road to Kyanjin Gompa. Itinerary, altitude profile, weather at each stop and departures.",
    },
  ].map((t) => ({ ...t, createdAt: now, updatedAt: now }));
  await db.collection("treks").insertMany(treks);

  // ---------------------------------------------------------- experiences --
  await db.collection("experiences").insertMany([
    {
      slug: "bandipur-heritage-night", name: "Bandipur heritage night", location: "Bandipur, Tanahun", status: "published", sample: true,
      summary: "A night in a preserved Newar hill town on the road between Kathmandu and Pokhara.",
      description: "Bandipur sits on a ridge above the Kathmandu to Pokhara highway. Its traffic-free main street of brick merchant houses makes a quiet stop on the way to or from your trek. The experience adds one night and the road transfer via Bandipur.",
      image: photo("bandipur", "Bandipur's hillside houses below a green ridge", "Bandipur"), gallery: [],
      durationNights: 1, inclusions: ["One night in a guesthouse in Bandipur", "Dinner and breakfast", "Road transfer routed via Bandipur"],
      price: 85, eligibleTrekIds: [T.abc, T.poon, T.langtang].map(String),
      availableFrom: null, availableTo: null, capacityNote: "Subject to guesthouse availability.",
    },
    {
      slug: "chitwan-wildlife-stay", name: "Chitwan wildlife stay", location: "Chitwan National Park, Terai", status: "published", sample: true,
      summary: "Two nights at the edge of Chitwan National Park after your trek, in the lowland jungle of southern Nepal.",
      description: "Chitwan National Park is a UNESCO World Heritage Site in Nepal's Terai lowlands, home to the greater one-horned rhinoceros. This add-on spends two nights in Sauraha with guided park activities, then returns you to Kathmandu or Pokhara.",
      image: photo("chitwan", "A young greater one-horned rhinoceros lying on a forest track in Chitwan", "Chitwan National Park"), gallery: [],
      durationNights: 2, inclusions: ["Two nights in a lodge in Sauraha", "All meals", "Guided park activities and park entry", "Road transfers"],
      price: 240, eligibleTrekIds: [T.ebc, T.abc, T.poon, T.langtang].map(String),
      availableFrom: null, availableTo: null, capacityNote: "Park activities depend on season and park rules.",
    },
  ].map((e) => ({ ...e, createdAt: now, updatedAt: now })));

  // ----------------------------------------------------------- departures --
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const off = (n) => { const d = new Date(today); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dep = (trek, startDate, capacity, offlineBooked, minGroup = 2) => ({
    trekId: trek.toHexString(), startDate, capacity, minGroup, offlineBooked, statusOverride: "", isPublic: true, notes: "Sample departure", sample: true, createdAt: now, updatedAt: now,
  });
  await db.collection("departures").insertMany([
    dep(T.abc, off(5), 12, 7),
    dep(T.ebc, off(9), 12, 10),
    dep(T.poon, off(12), 10, 1),
    dep(T.langtang, off(26), 10, 0),
    dep(T.ebc, "2027-03-20", 12, 3),
    dep(T.abc, "2027-03-27", 12, 0),
    dep(T.poon, "2027-04-03", 10, 4),
    dep(T.langtang, "2027-04-10", 10, 2),
    dep(T.ebc, "2027-04-17", 12, 12),
    dep(T.abc, "2027-10-09", 12, 0),
  ]);

  // ------------------------------------------------------------ advisory --
  await db.collection("advisories").insertOne({
    title: "Sample advisory: Lukla flight schedules", severity: "info", active: true, sample: true,
    body: "This is a sample route advisory showing how notices appear. In peak seasons Lukla flights may depart from Ramechhap (Manthali), a road transfer of several hours from Kathmandu. Your departure briefing will confirm the airport.",
    trekIds: [T.ebc.toHexString()], stayPointIds: [], disableWeather: false, suspendBooking: false, updatedAt: now,
  });
  console.log("catalogue seeded");
}

if (await empty("settings")) {
  await db.collection("settings").insertOne({
    _id: "site",
    currency: { base: "USD", enabled: ["USD", "EUR", "GBP", "NPR"], rates: { EUR: 0.92, GBP: 0.79, NPR: 134 }, ratesUpdatedAt: now, mode: "manual", sample: true },
    previewNotice: false,
  });
}

if (await empty("pages")) {
  const draft = (who) => `## Draft\n\nThis page is a draft placeholder. ${who}`;
  await db.collection("pages").insertMany([
    { slug: "about", title: "About Pala Trekking", draft: true, seoDescription: "About Pala Trekking, trekking services in Nepal.",
      body: `${draft("Company history, licences, registration and team details must be supplied by Himalayan Yogini and will not be invented.")}\n\n## What this site does\n\nPala Trekking organises treks from Kathmandu and Pokhara. Each package lists its full itinerary, the altitude of each overnight stop, what is included and what is not, so you can decide before contacting us.` },
    { slug: "terms", title: "Terms of Booking", draft: true, seoDescription: "Terms that apply to booking requests made through Pala Trekking.",
      body: `${draft("Final terms require review by Himalayan Yogini and their legal adviser.")}\n\n## Booking requests\n\nSubmitting the booking form sends a booking request. It is not a confirmed booking or a payment. We review availability and contact you to confirm the booking and arrange payment.\n\n## Prices\n\nPrices are set in the base currency shown on each page. Amounts shown in other currencies are estimates for guidance only.` },
    { slug: "privacy", title: "Privacy Notice", draft: true, seoDescription: "How Pala Trekking collects and uses personal information.",
      body: `${draft("Final wording requires review.")}\n\n## What we collect\n\nWhen you send a booking request or enquiry we collect your name, email address, phone number, country, the number of travellers and any message you write. We use this only to respond to you and to arrange your trek.\n\n## Departure board\n\nThe public departure board shows only the number of travellers on a departure. It never shows names, contact details, photographs or nationality.\n\n## Your choices\n\nYou can ask us to correct or delete your information by contacting us.` },
    { slug: "cancellation-policy", title: "Cancellation Policy", draft: true, seoDescription: "Cancellation conditions for Pala Trekking bookings.",
      body: `${draft("Cancellation periods, fees and refund terms must be confirmed by Himalayan Yogini and are not stated here.")}\n\n## Weather and safety\n\nWeather information on this site is guidance. It does not guarantee conditions and does not determine whether a route is safe or open. Your guide may change the itinerary for safety.` },
  ].map((p) => ({ ...p, updatedAt: now })));
}

if (await empty("faqs")) {
  await db.collection("faqs").insertMany([
    { category: "Booking", order: 1, published: true, question: "Is my booking confirmed when I submit the form?", answer: "No. The form sends a booking request. We check the departure and contact you to confirm and arrange payment." },
    { category: "Booking", order: 2, published: true, question: "Do I have to add an optional experience?", answer: "No. Optional experiences are extras with a fixed stated price. You can continue without any of them." },
    { category: "Prices", order: 1, published: true, question: "Which currency will I pay in?", answer: "Prices are set in the base currency shown beside every total. Other currencies are shown as estimates to help you compare." },
    { category: "Weather", order: 1, published: true, question: "How reliable is the weather on each itinerary?", answer: "Forecasts come from an external provider and are available about two weeks ahead. Further out we show seasonal guidance instead. Weather information never means a route is guaranteed safe or open." },
    { category: "Departures", order: 1, published: true, question: "What does the departure board show about other travellers?", answer: "Only how many people have booked and how many spaces remain. We never show names, nationalities, photographs or contact details." },
  ]);
}

if (await empty("users")) {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@palatrek.test").toLowerCase();
  const pw = process.env.SEED_ADMIN_PASSWORD;
  if (!pw) throw new Error("Set SEED_ADMIN_PASSWORD in .env.local");
  await db.collection("users").insertOne({ email, name: "Administrator", role: "admin", passwordHash: hashPassword(pw), mustChangePassword: true, active: true, createdAt: now });
  console.log("admin user created:", email);
}

await client.close();
console.log("done");
