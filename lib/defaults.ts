import type { SiteSettings } from "./types";

// Fallbacks used until an administrator saves settings. Company details are
// intentionally empty: they must come from Himalayan Yogini, not be invented.
export const DEFAULT_SETTINGS: SiteSettings = {
  currency: { base: "USD", enabled: ["USD"], rates: {}, ratesUpdatedAt: null, mode: "manual" },
  previewNotice: false,
  weatherAttribution: "Weather data by Open-Meteo.com (CC BY 4.0)",
  company: { name: "Pala Trekking", tagline: "", email: "", phone: "", whatsapp: "", address: "", registration: "" },
  home: {
    heroTitle: "Walk into the high Himalaya",
    heroSubtitle: "Treks from Kathmandu and Pokhara, with every night of the route laid out before you book.",
    heroSecondLine: "Know the stage, the altitude and the sky over each overnight stop.",
    gatewaysTitle: "Two gateways",
    gatewaysIntro: "Every trek starts from one of two cities. We organise them that way, and still tell you exactly where the trail begins.",
    featuredTitle: "Featured treks",
    trustTitle: "What you see before you commit",
    trustPoints: [
      { title: "The whole route", body: "Daily stages, walking times and the altitude you sleep at, for every day of the itinerary." },
      { title: "Weather at each stop", body: "Forecasts for each overnight stay point when available, and seasonal guidance when they are not." },
      { title: "One clear total", body: "Optional experiences add a fixed, stated price. Nothing is required to complete a booking." },
    ],
    closeTitle: "Choose your trail",
    closeBody: "Compare up to three treks side by side, then send a booking request for the departure that suits you.",
  },
};
