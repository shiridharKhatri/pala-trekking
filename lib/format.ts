// Pure formatting helpers, safe on server and client.

export const M_TO_FT = 3.28084;
export const KM_TO_MI = 0.621371;

const nf = new Intl.NumberFormat("en-GB");

export function metres(m: number | null | undefined, withFeet = false): string {
  if (m == null) return "";
  const base = `${nf.format(Math.round(m))} m`;
  return withFeet ? `${base} (${nf.format(Math.round(m * M_TO_FT))} ft)` : base;
}

export function feet(m: number | null | undefined): string {
  return m == null ? "" : `${nf.format(Math.round(m * M_TO_FT))} ft`;
}

export function km(k: number | null | undefined, withMiles = false): string {
  if (k == null) return "";
  const base = `${nf.format(k)} km`;
  return withMiles ? `${base} (${nf.format(Math.round(k * KM_TO_MI * 10) / 10)} mi)` : base;
}

/** "12 Mar 2027". Dates are stored as YYYY-MM-DD and shown unambiguously. */
export function date(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC", ...opts }).format(d);
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kathmandu", timeZoneName: "short" }).format(new Date(iso));
}

export function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function money(amount: number, currency: string, opts?: { estimate?: boolean }): string {
  const digits = currency === "NPR" || currency === "JPY" ? 0 : 0;
  const s = new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: digits, minimumFractionDigits: digits }).format(amount);
  return opts?.estimate ? `≈ ${s}` : s;
}

export function convert(amount: number, to: string, base: string, rates: Record<string, number>): number | null {
  if (to === base) return amount;
  const r = rates[to];
  return r && r > 0 ? amount * r : null;
}

export const difficultyLabel: Record<string, string> = {
  easy: "Easy",
  moderate: "Moderate",
  challenging: "Challenging",
  strenuous: "Strenuous",
};

export const gatewayLabel: Record<string, string> = { kathmandu: "Kathmandu", pokhara: "Pokhara" };

export function lines(s: string | null | undefined): string[] {
  return (s ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
}
