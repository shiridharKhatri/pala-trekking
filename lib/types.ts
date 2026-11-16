// Shared domain types. Everything crossing the server/client boundary is a
// plain object with string ids and ISO date strings.

export type PublishStatus = "draft" | "published" | "archived";
export type GatewaySlug = "kathmandu" | "pokhara";
export type Difficulty = "easy" | "moderate" | "challenging" | "strenuous";

export const DIFFICULTIES: Difficulty[] = ["easy", "moderate", "challenging", "strenuous"];

export interface Media {
  src: string;
  alt: string;
  caption?: string;
  credit?: string;
}

export interface Gateway {
  id: string;
  slug: GatewaySlug;
  name: string;
  elevationM: number | null;
  summary: string;
  image: Media | null;
  order: number;
}

export interface Region {
  id: string;
  slug: string;
  name: string;
  gateway: GatewaySlug;
  summary: string;
  image: Media | null;
  status: PublishStatus;
  order: number;
}

export interface ItineraryDay {
  day: number;
  start: string;
  destination: string;
  activities: string;
  distanceKm: number | null;
  walkingHours: string;
  elevationM: number | null;
  stayPointId: string | null;
}

export interface Trek {
  id: string;
  slug: string;
  name: string;
  status: PublishStatus;
  featured: boolean;
  sample: boolean;
  regionId: string;
  gateway: GatewaySlug;
  // Gateway structure (FR 02)
  pickupPoint: string;
  trailhead: string;
  destination: string;
  endingPoint: string;
  returnCity: string;
  // Key facts (filter + comparison fields, stored separately from prose)
  durationDays: number;
  difficulty: Difficulty;
  maxAltitudeM: number;
  bestSeason: string;
  walkingHoursMin: number;
  walkingHoursMax: number;
  basePrice: number;
  // Description
  summary: string;
  overview: string;
  highlights: string[];
  fitness: string;
  travellerProfile: string;
  // Itinerary
  itinerary: ItineraryDay[];
  // Logistics
  accommodation: string;
  meals: string;
  transport: string;
  guidePorter: string;
  // Commercial
  inclusions: string[];
  exclusions: string[];
  supplements: string;
  cancellation: string;
  // Preparation
  safety: string;
  altitudeInfo: string;
  packing: string[];
  insurance: string;
  permits: string;
  // Media
  heroImage: Media | null;
  gallery: Media[];
  // SEO
  seoTitle: string;
  seoDescription: string;
  updatedAt: string;
}

export type TrekCard = Pick<
  Trek,
  | "id" | "slug" | "name" | "gateway" | "regionId" | "durationDays" | "difficulty"
  | "maxAltitudeM" | "basePrice" | "summary" | "heroImage" | "featured" | "bestSeason"
  | "walkingHoursMin" | "walkingHoursMax" | "trailhead" | "destination" | "sample"
>;

export interface StayPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  elevationM: number;
  weatherEnabled: boolean;
  seasonalGuidance: string;
  regionId: string | null;
}

export interface Experience {
  id: string;
  slug: string;
  name: string;
  location: string;
  summary: string;
  description: string;
  image: Media | null;
  gallery: Media[];
  durationNights: number;
  inclusions: string[];
  price: number;
  eligibleTrekIds: string[];
  availableFrom: string | null;
  availableTo: string | null;
  capacityNote: string;
  status: PublishStatus;
  sample: boolean;
}

export type DepartureStatus = "forming" | "confirmed" | "almost-full" | "full" | "closed";
export const DEPARTURE_STATUSES: DepartureStatus[] = ["forming", "confirmed", "almost-full", "full", "closed"];

export interface Departure {
  id: string;
  trekId: string;
  startDate: string; // YYYY-MM-DD
  capacity: number;
  minGroup: number;
  offlineBooked: number;
  statusOverride: DepartureStatus | "";
  isPublic: boolean;
  notes: string; // internal only, never sent to public pages
  sample: boolean;
}

/** What the public departure board is allowed to know. No customer data. */
export interface PublicDeparture {
  id: string;
  trekId: string;
  trekSlug: string;
  trekName: string;
  gateway: GatewaySlug;
  durationDays: number;
  startDate: string;
  status: DepartureStatus;
  spacesLeft: number;
  travellerCount: number;
  sample: boolean;
}

export type BookingStatus = "requested" | "reviewing" | "confirmed" | "declined" | "cancelled";
export const BOOKING_STATUSES: BookingStatus[] = ["requested", "reviewing", "confirmed", "declined", "cancelled"];

export interface Booking {
  id: string;
  ref: string;
  source: "website" | "offline";
  trekId: string;
  trekName: string;
  departureId: string | null;
  departureDate: string | null;
  preferredDate: string | null;
  travellers: number;
  pricePerPerson: number;
  trekSubtotal: number;
  addOns: { id: string; name: string; price: number }[];
  addOnTotal: number;
  total: number;
  currency: string; // base / transaction currency
  displayCurrency: string;
  displayTotalEstimate: number | null;
  lead: { name: string; email: string; phone: string; country: string };
  travellerNames: string;
  message: string;
  acknowledgements: { terms: boolean; cancellation: boolean; privacy: boolean; fitness: boolean };
  status: BookingStatus;
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
}

export type AdvisorySeverity = "info" | "caution" | "warning";

export interface Advisory {
  id: string;
  title: string;
  body: string;
  severity: AdvisorySeverity;
  trekIds: string[];
  stayPointIds: string[];
  disableWeather: boolean;
  suspendBooking: boolean;
  active: boolean;
  updatedAt: string;
}

export interface CurrencySettings {
  base: string;
  enabled: string[];
  rates: Record<string, number>; // 1 base = rate * currency
  ratesUpdatedAt: string | null;
  mode: "manual";
}

export interface HomeContent {
  heroTitle: string;
  heroSubtitle: string;
  heroSecondLine: string;
  gatewaysTitle: string;
  gatewaysIntro: string;
  featuredTitle: string;
  trustTitle: string;
  trustPoints: { title: string; body: string }[];
  closeTitle: string;
  closeBody: string;
}

export interface CompanyContent {
  name: string;
  tagline: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  registration: string;
}

export interface SiteSettings {
  currency: CurrencySettings;
  home: HomeContent;
  company: CompanyContent;
  previewNotice: boolean;
  weatherAttribution: string;
}

export interface ContentPage {
  id: string;
  slug: string;
  title: string;
  body: string;
  seoDescription: string;
  draft: boolean;
  updatedAt: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  published: boolean;
}

export type Role = "admin" | "content";
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}
