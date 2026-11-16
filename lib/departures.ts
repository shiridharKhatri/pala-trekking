import type { Departure, DepartureStatus } from "./types";

/** Days before start when public booking for a departure closes. */
export const BOOKING_CUTOFF_DAYS = 3;

export function departureState(
  d: Pick<Departure, "startDate" | "capacity" | "minGroup" | "offlineBooked" | "statusOverride">,
  websiteTravellers: number,
  todayIso: string,
): { status: DepartureStatus; booked: number; spacesLeft: number } {
  const booked = Math.max(0, (d.offlineBooked || 0) + websiteTravellers);
  const spacesLeft = Math.max(0, d.capacity - booked);
  if (d.statusOverride) return { status: d.statusOverride, booked, spacesLeft: d.statusOverride === "full" || d.statusOverride === "closed" ? 0 : spacesLeft };
  const cutoff = new Date(`${todayIso}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() + BOOKING_CUTOFF_DAYS);
  if (d.startDate < cutoff.toISOString().slice(0, 10)) return { status: "closed", booked, spacesLeft: 0 };
  if (spacesLeft <= 0) return { status: "full", booked, spacesLeft: 0 };
  if (spacesLeft <= Math.max(2, Math.ceil(d.capacity * 0.2))) return { status: "almost-full", booked, spacesLeft };
  if (booked >= Math.max(1, d.minGroup)) return { status: "confirmed", booked, spacesLeft };
  return { status: "forming", booked, spacesLeft };
}

export const departureStatusLabel: Record<DepartureStatus, string> = {
  forming: "Forming",
  confirmed: "Confirmed",
  "almost-full": "Almost full",
  full: "Full",
  closed: "Closed",
};

export const bookable = (s: DepartureStatus) => s === "forming" || s === "confirmed" || s === "almost-full";

/** Bookings that hold seats on a departure. */
export const SEAT_HOLDING = ["requested", "reviewing", "confirmed"];
