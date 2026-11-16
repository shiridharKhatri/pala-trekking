// Field-schema definitions for the admin editor. Serializable parts are sent
// to the client form; parsing and validation run on the server only.
import type { Role } from "../types";

export type FieldType =
  | "text" | "textarea" | "number" | "select" | "checkbox" | "date" | "lines"
  | "multiselect" | "media" | "itinerary" | "gallery" | "rates";

export type OptionSource = "regions" | "treks" | "stayPoints" | "gateways" | "currencies";

export interface Field {
  name: string; // dotted path for nested values, e.g. "company.email"
  label: string;
  type: FieldType;
  group?: string;
  required?: boolean;
  help?: string;
  options?: { value: string; label: string }[];
  optionSource?: OptionSource;
  adminOnly?: boolean; // content managers see it read-only; server ignores their value
  readOnlyOnEdit?: boolean;
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  pattern?: string;
}

export interface EntityDef {
  key: string;
  collection: string;
  title: string;
  singular: string;
  roles: Role[];
  tags: string[];
  fields: Field[];
  listColumns: { name: string; label: string }[];
  sort: Record<string, 1 | -1>;
  canCreate: boolean;
  canDelete: boolean; // hard delete (otherwise archive via status)
  hasStatus: boolean;
  titleField: string;
}

const STATUS: Field = {
  name: "status", label: "Publication status", type: "select", adminOnly: true, required: true,
  options: [{ value: "draft", label: "Draft (hidden)" }, { value: "published", label: "Published" }, { value: "archived", label: "Archived" }],
};
const SAMPLE: Field = { name: "sample", label: "Sample data (placeholder values, replace before launch)", type: "checkbox", adminOnly: true };
const SLUG: Field = { name: "slug", label: "URL slug", type: "text", required: true, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$", help: "Lowercase words separated by hyphens. Changing it changes the public URL." };
const GATEWAY: Field = { name: "gateway", label: "Gateway city", type: "select", required: true, options: [{ value: "kathmandu", label: "Kathmandu" }, { value: "pokhara", label: "Pokhara" }] };
const DIFF: Field = {
  name: "difficulty", label: "Difficulty", type: "select", required: true,
  options: ["easy", "moderate", "challenging", "strenuous"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })),
};

export const ENTITIES: Record<string, EntityDef> = {
  treks: {
    key: "treks", collection: "treks", title: "Treks", singular: "trek", roles: ["admin", "content"], tags: ["catalogue", "departures"],
    sort: { status: -1, name: 1 }, canCreate: true, canDelete: false, hasStatus: true, titleField: "name",
    listColumns: [{ name: "name", label: "Name" }, { name: "gateway", label: "Gateway" }, { name: "durationDays", label: "Days" }, { name: "basePrice", label: "Base price" }, { name: "status", label: "Status" }],
    fields: [
      { name: "name", label: "Package name", type: "text", required: true, group: "Identity" },
      { ...SLUG, group: "Identity" },
      { ...STATUS, group: "Identity" },
      { name: "featured", label: "Feature on the homepage", type: "checkbox", group: "Identity", adminOnly: true },
      { name: "regionId", label: "Region", type: "select", optionSource: "regions", required: true, group: "Identity" },
      { ...GATEWAY, group: "Identity" },
      { name: "heroImage", label: "Featured image", type: "media", group: "Identity" },
      { name: "pickupPoint", label: "Pickup point", type: "text", required: true, group: "Gateway structure" },
      { name: "trailhead", label: "Actual trailhead", type: "text", required: true, group: "Gateway structure" },
      { name: "destination", label: "Main destination", type: "text", required: true, group: "Gateway structure" },
      { name: "endingPoint", label: "Ending point", type: "text", group: "Gateway structure" },
      { name: "returnCity", label: "Return city", type: "text", group: "Gateway structure" },
      { name: "durationDays", label: "Duration (days)", type: "number", min: 1, max: 60, required: true, group: "Key facts" },
      { ...DIFF, group: "Key facts" },
      { name: "maxAltitudeM", label: "Maximum altitude (m)", type: "number", min: 0, max: 9000, required: true, group: "Key facts" },
      { name: "bestSeason", label: "Best season", type: "text", group: "Key facts", help: "For example: Mar to May, Oct to Nov" },
      { name: "walkingHoursMin", label: "Daily walking, minimum hours", type: "number", min: 0, max: 16, step: 0.5, group: "Key facts" },
      { name: "walkingHoursMax", label: "Daily walking, maximum hours", type: "number", min: 0, max: 16, step: 0.5, group: "Key facts" },
      { name: "basePrice", label: "Base price per person (base currency)", type: "number", min: 0, step: 1, required: true, adminOnly: true, group: "Key facts" },
      { name: "summary", label: "Card summary", type: "textarea", rows: 2, required: true, group: "Description" },
      { name: "overview", label: "Overview", type: "textarea", rows: 6, group: "Description" },
      { name: "highlights", label: "Highlights (one per line)", type: "lines", group: "Description" },
      { name: "fitness", label: "Fitness expectation", type: "textarea", rows: 3, group: "Description" },
      { name: "travellerProfile", label: "Intended traveller profile", type: "textarea", rows: 3, group: "Description" },
      { name: "itinerary", label: "Day-by-day itinerary", type: "itinerary", optionSource: "stayPoints", group: "Itinerary" },
      { name: "accommodation", label: "Accommodation", type: "textarea", rows: 3, group: "Logistics" },
      { name: "meals", label: "Meals", type: "textarea", rows: 2, group: "Logistics" },
      { name: "transport", label: "Transportation", type: "textarea", rows: 2, group: "Logistics" },
      { name: "guidePorter", label: "Guide and porter arrangements", type: "textarea", rows: 3, group: "Logistics" },
      { name: "inclusions", label: "Inclusions (one per line)", type: "lines", group: "Commercial" },
      { name: "exclusions", label: "Exclusions (one per line)", type: "lines", group: "Commercial" },
      { name: "supplements", label: "Optional supplements", type: "textarea", rows: 2, group: "Commercial" },
      { name: "cancellation", label: "Cancellation conditions", type: "textarea", rows: 3, group: "Commercial" },
      { name: "safety", label: "Safety", type: "textarea", rows: 3, group: "Preparation" },
      { name: "altitudeInfo", label: "Altitude information", type: "textarea", rows: 3, group: "Preparation" },
      { name: "packing", label: "Packing recommendations (one per line)", type: "lines", group: "Preparation" },
      { name: "insurance", label: "Insurance guidance", type: "textarea", rows: 2, group: "Preparation" },
      { name: "permits", label: "Permit information", type: "textarea", rows: 2, group: "Preparation" },
      { name: "gallery", label: "Gallery images", type: "gallery", group: "Media" },
      { name: "seoTitle", label: "SEO title", type: "text", group: "Search engines", max: 70 },
      { name: "seoDescription", label: "SEO description", type: "textarea", rows: 2, group: "Search engines", max: 170 },
      { ...SAMPLE, group: "Search engines" },
    ],
  },
  experiences: {
    key: "experiences", collection: "experiences", title: "Optional experiences", singular: "experience", roles: ["admin", "content"], tags: ["catalogue"],
    sort: { status: -1, name: 1 }, canCreate: true, canDelete: false, hasStatus: true, titleField: "name",
    listColumns: [{ name: "name", label: "Name" }, { name: "location", label: "Location" }, { name: "price", label: "Price" }, { name: "status", label: "Status" }],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      SLUG, STATUS,
      { name: "location", label: "Destination and location", type: "text", required: true },
      { name: "summary", label: "Short summary", type: "textarea", rows: 2, required: true },
      { name: "description", label: "Description", type: "textarea", rows: 6, help: "Blank lines separate paragraphs. Start a line with ## for a heading." },
      { name: "image", label: "Image", type: "media" },
      { name: "durationNights", label: "Additional nights", type: "number", min: 0, max: 30, required: true },
      { name: "inclusions", label: "Inclusions (one per line)", type: "lines" },
      { name: "price", label: "Additional price (fixed, base currency)", type: "number", min: 0, required: true, adminOnly: true },
      { name: "eligibleTrekIds", label: "Eligible treks", type: "multiselect", optionSource: "treks", adminOnly: true },
      { name: "availableFrom", label: "Available from", type: "date" },
      { name: "availableTo", label: "Available until", type: "date" },
      { name: "capacityNote", label: "Capacity notes", type: "text" },
      SAMPLE,
    ],
  },
  regions: {
    key: "regions", collection: "regions", title: "Regions", singular: "region", roles: ["admin", "content"], tags: ["catalogue"],
    sort: { order: 1 }, canCreate: true, canDelete: false, hasStatus: true, titleField: "name",
    listColumns: [{ name: "name", label: "Name" }, { name: "gateway", label: "Gateway" }, { name: "order", label: "Order" }, { name: "status", label: "Status" }],
    fields: [
      { name: "name", label: "Name", type: "text", required: true }, SLUG, STATUS, GATEWAY,
      { name: "order", label: "Display order", type: "number", min: 0 },
      { name: "summary", label: "Summary", type: "textarea", rows: 3 },
      { name: "image", label: "Image", type: "media" },
    ],
  },
  gateways: {
    key: "gateways", collection: "gateways", title: "Gateways", singular: "gateway", roles: ["admin", "content"], tags: ["catalogue"],
    sort: { order: 1 }, canCreate: false, canDelete: false, hasStatus: false, titleField: "name",
    listColumns: [{ name: "name", label: "Name" }, { name: "elevationM", label: "Elevation (m)" }],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "elevationM", label: "Elevation (m)", type: "number", min: 0, max: 9000 },
      { name: "order", label: "Display order", type: "number", min: 0 },
      { name: "summary", label: "Summary", type: "textarea", rows: 3 },
      { name: "image", label: "Image", type: "media" },
    ],
  },
  stayPoints: {
    key: "stayPoints", collection: "stayPoints", title: "Stay points", singular: "stay point", roles: ["admin"], tags: ["catalogue", "weather"],
    sort: { name: 1 }, canCreate: true, canDelete: false, hasStatus: false, titleField: "name",
    listColumns: [{ name: "name", label: "Name" }, { name: "elevationM", label: "Elevation (m)" }, { name: "lat", label: "Lat" }, { name: "lon", label: "Lon" }, { name: "weatherEnabled", label: "Weather" }],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "regionId", label: "Region", type: "select", optionSource: "regions" },
      { name: "lat", label: "Latitude", type: "number", min: -90, max: 90, step: 0.0001, required: true },
      { name: "lon", label: "Longitude", type: "number", min: -180, max: 180, step: 0.0001, required: true },
      { name: "elevationM", label: "Elevation (m)", type: "number", min: 0, max: 9000, required: true },
      { name: "weatherEnabled", label: "Show live weather for this stop", type: "checkbox" },
      { name: "seasonalGuidance", label: "Seasonal guidance (shown when forecasts are unavailable)", type: "textarea", rows: 4 },
    ],
  },
  departures: {
    key: "departures", collection: "departures", title: "Departures", singular: "departure", roles: ["admin"], tags: ["departures"],
    sort: { startDate: 1 }, canCreate: true, canDelete: true, hasStatus: false, titleField: "startDate",
    listColumns: [{ name: "trekId", label: "Trek" }, { name: "startDate", label: "Start" }, { name: "capacity", label: "Capacity" }, { name: "offlineBooked", label: "Offline" }, { name: "statusOverride", label: "Manual status" }, { name: "isPublic", label: "Public" }],
    fields: [
      { name: "trekId", label: "Trek", type: "select", optionSource: "treks", required: true },
      { name: "startDate", label: "Start date", type: "date", required: true },
      { name: "capacity", label: "Maximum capacity", type: "number", min: 1, max: 60, required: true },
      { name: "minGroup", label: "Travellers needed to confirm", type: "number", min: 1, max: 60 },
      { name: "offlineBooked", label: "Offline bookings (travellers)", type: "number", min: 0, max: 60, help: "Travellers booked outside the website. Website bookings are counted automatically." },
      {
        name: "statusOverride", label: "Manual status", type: "select",
        options: [{ value: "", label: "Automatic" }, { value: "forming", label: "Forming" }, { value: "confirmed", label: "Confirmed" }, { value: "almost-full", label: "Almost full" }, { value: "full", label: "Full" }, { value: "closed", label: "Closed" }],
      },
      { name: "isPublic", label: "Show on the public departure board", type: "checkbox" },
      { name: "notes", label: "Internal notes (never public)", type: "textarea", rows: 3 },
      SAMPLE,
    ],
  },
  advisories: {
    key: "advisories", collection: "advisories", title: "Route advisories", singular: "advisory", roles: ["admin"], tags: ["advisories", "catalogue"],
    sort: { active: -1, updatedAt: -1 }, canCreate: true, canDelete: true, hasStatus: false, titleField: "title",
    listColumns: [{ name: "title", label: "Title" }, { name: "severity", label: "Severity" }, { name: "active", label: "Active" }],
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "severity", label: "Severity", type: "select", required: true, options: [{ value: "info", label: "Information" }, { value: "caution", label: "Caution" }, { value: "warning", label: "Warning" }] },
      { name: "body", label: "Notice", type: "textarea", rows: 4, required: true },
      { name: "trekIds", label: "Affected treks", type: "multiselect", optionSource: "treks" },
      { name: "stayPointIds", label: "Affected stay points", type: "multiselect", optionSource: "stayPoints" },
      { name: "disableWeather", label: "Hide live weather for the affected stay points (all stops on affected treks if none selected)", type: "checkbox" },
      { name: "suspendBooking", label: "Temporarily pause bookings for affected treks", type: "checkbox" },
      { name: "active", label: "Active (shown on the site)", type: "checkbox" },
    ],
  },
  faqs: {
    key: "faqs", collection: "faqs", title: "FAQs", singular: "FAQ", roles: ["admin", "content"], tags: ["content"],
    sort: { category: 1, order: 1 }, canCreate: true, canDelete: true, hasStatus: false, titleField: "question",
    listColumns: [{ name: "question", label: "Question" }, { name: "category", label: "Category" }, { name: "published", label: "Published" }],
    fields: [
      { name: "question", label: "Question", type: "text", required: true },
      { name: "answer", label: "Answer", type: "textarea", rows: 4, required: true },
      { name: "category", label: "Category", type: "text", required: true },
      { name: "order", label: "Order within category", type: "number", min: 0 },
      { name: "published", label: "Published", type: "checkbox" },
    ],
  },
  pages: {
    key: "pages", collection: "pages", title: "Pages", singular: "page", roles: ["admin", "content"], tags: ["content"],
    sort: { slug: 1 }, canCreate: false, canDelete: false, hasStatus: false, titleField: "title",
    listColumns: [{ name: "title", label: "Title" }, { name: "slug", label: "URL" }, { name: "draft", label: "Draft" }],
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "slug", label: "URL", type: "text", readOnlyOnEdit: true },
      { name: "body", label: "Content", type: "textarea", rows: 18, help: "Blank lines separate paragraphs. ## starts a heading. - starts a bullet." },
      { name: "seoDescription", label: "SEO description", type: "textarea", rows: 2, max: 170 },
      { name: "draft", label: "Mark as draft (shows a draft notice)", type: "checkbox" },
    ],
  },
  settings: {
    key: "settings", collection: "settings", title: "Site settings", singular: "settings", roles: ["admin"], tags: ["settings"],
    sort: {}, canCreate: false, canDelete: false, hasStatus: false, titleField: "_id",
    listColumns: [],
    fields: [
      { name: "currency.base", label: "Base (transaction) currency", type: "select", optionSource: "currencies", required: true, group: "Currency", help: "Package and add-on prices are entered in this currency." },
      { name: "currency.enabled", label: "Display currencies", type: "multiselect", optionSource: "currencies", group: "Currency" },
      { name: "currency.rates", label: "Exchange rates (1 base unit equals)", type: "rates", group: "Currency", help: "One per line, for example EUR=0.92. Converted prices are always labelled as estimates." },
      { name: "previewNotice", label: "Show the 'sample data' preview notice on the public site", type: "checkbox", group: "Site" },
      { name: "weatherAttribution", label: "Weather attribution text", type: "text", group: "Site" },
      { name: "company.name", label: "Company name", type: "text", group: "Company details" },
      { name: "company.tagline", label: "Footer tagline", type: "text", group: "Company details" },
      { name: "company.email", label: "Public email", type: "text", group: "Company details" },
      { name: "company.phone", label: "Public phone", type: "text", group: "Company details" },
      { name: "company.whatsapp", label: "WhatsApp", type: "text", group: "Company details" },
      { name: "company.address", label: "Office address", type: "textarea", rows: 2, group: "Company details" },
      { name: "company.registration", label: "Registration or licence numbers", type: "text", group: "Company details", help: "Only enter verified details." },
    ],
  },
  home: {
    key: "home", collection: "settings", title: "Homepage content", singular: "homepage", roles: ["admin", "content"], tags: ["settings"],
    sort: {}, canCreate: false, canDelete: false, hasStatus: false, titleField: "_id",
    listColumns: [],
    fields: [
      { name: "home.heroTitle", label: "Hero headline", type: "text", required: true, max: 60, group: "Hero" },
      { name: "home.heroSubtitle", label: "Hero subtitle", type: "textarea", rows: 2, max: 160, group: "Hero" },
      { name: "home.heroSecondLine", label: "Hero second line (appears on scroll)", type: "text", max: 120, group: "Hero" },
      { name: "home.gatewaysTitle", label: "Gateways heading", type: "text", group: "Sections" },
      { name: "home.gatewaysIntro", label: "Gateways introduction", type: "textarea", rows: 2, group: "Sections" },
      { name: "home.featuredTitle", label: "Featured treks heading", type: "text", group: "Sections" },
      { name: "home.trustTitle", label: "Reassurance heading", type: "text", group: "Sections" },
      { name: "home.trustPoints", label: "Reassurance points (one per line: Title | text)", type: "lines", group: "Sections" },
      { name: "home.closeTitle", label: "Closing heading", type: "text", group: "Sections" },
      { name: "home.closeBody", label: "Closing text", type: "textarea", rows: 2, group: "Sections" },
    ],
  },
};

export const CURRENCY_CODES = ["USD", "EUR", "GBP", "NPR", "AUD", "CAD", "INR", "JPY", "CHF", "CNY", "SGD", "NZD"];
