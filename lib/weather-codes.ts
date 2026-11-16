// Shared (server + client) weather helpers.

// WMO weather interpretation codes, as used by Open-Meteo.
export function describe(code: number): { label: string; icon: WeatherIcon } {
  if (code === 0) return { label: "Clear", icon: "clear" };
  if (code === 1) return { label: "Mainly clear", icon: "clear" };
  if (code === 2) return { label: "Partly cloudy", icon: "partly" };
  if (code === 3) return { label: "Overcast", icon: "cloud" };
  if (code === 45 || code === 48) return { label: "Fog", icon: "fog" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", icon: "rain" };
  if (code >= 61 && code <= 67) return { label: "Rain", icon: "rain" };
  if (code >= 71 && code <= 77) return { label: "Snow", icon: "snow" };
  if (code >= 80 && code <= 82) return { label: "Rain showers", icon: "rain" };
  if (code === 85 || code === 86) return { label: "Snow showers", icon: "snow" };
  if (code >= 95) return { label: "Thunderstorm", icon: "storm" };
  return { label: "Unknown", icon: "cloud" };
}

export type WeatherIcon = "clear" | "partly" | "cloud" | "fog" | "rain" | "snow" | "storm";

export function compass(deg: number | null): string {
  if (deg == null) return "";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(((deg % 360) / 45)) % 8];
}
