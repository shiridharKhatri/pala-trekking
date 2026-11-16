import "server-only";
import { headers } from "next/headers";

/**
 * Client IP for rate limiting.
 *
 * The leftmost X-Forwarded-For entry is whatever the client sent, so it must
 * never be trusted. Behind a reverse proxy or platform (Vercel, Nginx, a load
 * balancer) the trustworthy value is the one *our* proxy appended: `x-real-ip`
 * when the platform sets it, otherwise the entry TRUSTED_PROXY_HOPS positions
 * from the right (default 1). Deploy behind a proxy that overwrites these
 * headers; when the app is reached directly there is no trustworthy client IP
 * at all, which is why every limiter also has an email or global cap.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const hops = Math.max(1, Math.floor(Number(process.env.TRUSTED_PROXY_HOPS ?? 1)) || 1);
  const real = h.get("x-real-ip")?.trim();
  if (real && process.env.TRUST_X_REAL_IP !== "false") return real.slice(0, 64);
  const xff = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return (xff.length >= hops ? xff[xff.length - hops] : "direct").slice(0, 64);
}
