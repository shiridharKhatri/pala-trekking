import "server-only";
import { cacheLife, cacheTag } from "next/cache";

// Route weather (PRD section 7). Provider: Open-Meteo.
// - Development uses the free endpoint (non-commercial terms).
// - Production must set OPEN_METEO_API_KEY (commercial plan), which switches to
//   the customer endpoint. Attribution is shown wherever data is displayed.
// A provider failure is never cached and never blocks the page (NFR Reliability).

export const FORECAST_DAYS = 16;

export interface WeatherPoint {
  id: string;
  lat: number;
  lon: number;
  elevationM: number;
}

export interface DailyWeather {
  date: string;
  code: number;
  tMax: number | null;
  tMin: number | null;
  feelsMin: number | null;
  precipProb: number | null;
  snowfallCm: number | null;
  windMax: number | null;
  gustMax: number | null;
  windDir: number | null;
  sunrise: string | null;
  sunset: string | null;
}

export interface CurrentWeather {
  time: string;
  code: number;
  temp: number | null;
  feels: number | null;
  humidity: number | null;
  wind: number | null;
  gust: number | null;
  windDir: number | null;
}

export interface PointWeather {
  current: CurrentWeather | null;
  daily: DailyWeather[];
}

export interface RouteWeather {
  fetchedAt: string;
  points: Record<string, PointWeather>;
}

function endpoint() {
  const key = process.env.OPEN_METEO_API_KEY;
  return key
    ? { base: "https://customer-api.open-meteo.com/v1/forecast", key }
    : { base: "https://api.open-meteo.com/v1/forecast", key: "" };
}

async function fetchRouteWeather(points: WeatherPoint[]): Promise<RouteWeather> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 1800, expire: 21600 });
  cacheTag("weather");
  const { base, key } = endpoint();
  const u = new URL(base);
  u.searchParams.set("latitude", points.map((p) => p.lat.toFixed(4)).join(","));
  u.searchParams.set("longitude", points.map((p) => p.lon.toFixed(4)).join(","));
  u.searchParams.set("elevation", points.map((p) => Math.round(p.elevationM)).join(","));
  u.searchParams.set("current", "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m");
  u.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_min,precipitation_probability_max,snowfall_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,sunrise,sunset");
  u.searchParams.set("timezone", "Asia/Kathmandu");
  u.searchParams.set("forecast_days", String(FORECAST_DAYS));
  u.searchParams.set("wind_speed_unit", "kmh");
  if (key) u.searchParams.set("apikey", key);

  let res: Response | null = null;
  for (let attempt = 0; attempt < 2 && !res; attempt++) {
    try {
      res = await fetch(u, { signal: AbortSignal.timeout(10000), headers: { "User-Agent": "PalaTrekking/1.0" } });
    } catch (e) {
      if (attempt === 1) throw e;
    }
  }
  if (!res) throw new Error("Weather provider unreachable");
  if (!res.ok) throw new Error(`Weather provider responded ${res.status}`);
  const json = await res.json();
  const list: unknown[] = Array.isArray(json) ? json : [json];
  if (list.length !== points.length) throw new Error("Weather provider returned an unexpected number of locations");

  const out: Record<string, PointWeather> = {};
  list.forEach((raw, i) => {
    const r = raw as { current?: Record<string, number | string>; daily?: Record<string, (number | string | null)[]> };
    const c = r.current;
    const d = r.daily ?? {};
    const n = (d.time ?? []).length;
    const num = (arr: (number | string | null)[] | undefined, j: number) => (arr && typeof arr[j] === "number" ? (arr[j] as number) : null);
    const str = (arr: (number | string | null)[] | undefined, j: number) => (arr && typeof arr[j] === "string" ? (arr[j] as string) : null);
    out[points[i].id] = {
      current: c
        ? {
            time: String(c.time),
            code: Number(c.weather_code),
            temp: (c.temperature_2m as number) ?? null,
            feels: (c.apparent_temperature as number) ?? null,
            humidity: (c.relative_humidity_2m as number) ?? null,
            wind: (c.wind_speed_10m as number) ?? null,
            gust: (c.wind_gusts_10m as number) ?? null,
            windDir: (c.wind_direction_10m as number) ?? null,
          }
        : null,
      daily: Array.from({ length: n }, (_, j) => ({
        date: String(d.time![j]),
        code: num(d.weather_code, j) ?? -1,
        tMax: num(d.temperature_2m_max, j),
        tMin: num(d.temperature_2m_min, j),
        feelsMin: num(d.apparent_temperature_min, j),
        precipProb: num(d.precipitation_probability_max, j),
        snowfallCm: num(d.snowfall_sum, j),
        windMax: num(d.wind_speed_10m_max, j),
        gustMax: num(d.wind_gusts_10m_max, j),
        windDir: num(d.wind_direction_10m_dominant, j),
        sunrise: str(d.sunrise, j),
        sunset: str(d.sunset, j),
      })),
    };
  });
  return { fetchedAt: new Date().toISOString(), points: out };
}

/** Returns null when the provider is unavailable; callers show the fallback state. */
export async function getRouteWeather(points: WeatherPoint[]): Promise<RouteWeather | null> {
  if (!points.length) return null;
  const sorted = [...points].sort((a, b) => a.id.localeCompare(b.id));
  try {
    return await fetchRouteWeather(sorted);
  } catch (e) {
    console.error("[weather]", (e as Error).message);
    return null;
  }
}

export { describe, compass, type WeatherIcon } from "./weather-codes";
