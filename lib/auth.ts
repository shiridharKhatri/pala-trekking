import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createHash, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db, C } from "./db";
import { oid } from "./serialize";
import { clientIp } from "./net";
import type { AdminUser, Role } from "./types";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

const PROD = process.env.NODE_ENV === "production";
// __Host- prefix (production, HTTPS): the browser only accepts the cookie when
// it is Secure, host-only and path=/, so a sibling subdomain cannot plant or
// overwrite the session.
export const SESSION_COOKIE = PROD ? "__Host-pt_admin" : "pt_admin";
const SESSION_HOURS = 12;

const SCRYPT = { N: 16384, r: 8, p: 1 };
const MAX_N = 1 << 17; // reject absurd stored parameters (DoS guard)

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pw, salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, N, r, p, saltB64, hashB64] = String(stored).split("$");
  if (alg !== "scrypt" || !saltB64 || !hashB64) return false;
  const n = Number(N), rr = Number(r), pp = Number(p);
  if (!(n >= 1024 && n <= MAX_N && rr >= 1 && rr <= 16 && pp >= 1 && pp <= 4)) return false;
  const expected = Buffer.from(hashB64, "base64");
  if (expected.length < 32) return false;
  const got = await scrypt(pw.slice(0, 1024), Buffer.from(saltB64, "base64"), expected.length, { N: n, r: rr, p: pp, maxmem: 256 * 1024 * 1024 });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

// Hash checked when the email is unknown, so a failed login costs the same
// time whether or not the account exists (no account enumeration by timing).
let dummyHash: Promise<string> | null = null;
export async function verifyAgainstDummy(pw: string): Promise<false> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(pw, await dummyHash);
  return false;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
  await (await db()).collection(C.sessions).insertOne({ tokenHash: sha256(token), userId, expiresAt, createdAt: new Date() });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: PROD,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await (await db()).collection(C.sessions).deleteOne({ tokenHash: sha256(token) });
  jar.delete(SESSION_COOKIE);
}

/** Current admin or null. Reads the request, so call it inside <Suspense>. */
export async function getAdmin(): Promise<(AdminUser & { mustChangePassword: boolean }) | null> {
  await connection(); // always evaluated per request
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 128) return null;
  const database = await db();
  const session = await database.collection(C.sessions).findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  const id = oid(String(session.userId));
  const u = id ? await database.collection(C.users).findOne({ _id: id, active: true }) : null;
  if (!u) return null;
  return { id: u._id.toHexString(), email: u.email, name: u.name, role: u.role as Role, mustChangePassword: !!u.mustChangePassword };
}

/**
 * Authorisation gate for admin pages and every server action.
 * Accounts still on a temporary password can only reach the account page,
 * change their password and sign out (allowPendingPassword).
 */
export async function requireAdmin(
  roles: Role[] = ["admin", "content"],
  opts: { allowPendingPassword?: boolean } = {},
): Promise<AdminUser> {
  const u = await getAdmin();
  if (!u) redirect("/admin/login");
  if (u.mustChangePassword && !opts.allowPendingPassword) redirect("/admin/account?first=1");
  if (!roles.includes(u.role)) redirect("/admin?denied=1");
  return u;
}

// Login throttling: 8 failures per email, or 20 per client IP, per 15 minutes
// (TTL index cleans up). The email bucket holds even when the IP is unknown or
// spoofed, so brute force against one account is always capped.
export async function loginBlocked(email: string): Promise<boolean> {
  const ip = await clientIp();
  const since = new Date(Date.now() - 15 * 60_000);
  const coll = (await db()).collection("loginAttempts");
  const [byEmail, byIp] = await Promise.all([
    coll.countDocuments({ email, at: { $gt: since } }),
    coll.countDocuments({ ip, at: { $gt: since } }),
  ]);
  return byEmail >= 8 || byIp >= 20;
}

export async function recordFailedLogin(email: string): Promise<void> {
  const ip = await clientIp();
  await (await db()).collection("loginAttempts").insertOne({ email, ip, at: new Date() });
}

export async function audit(user: AdminUser, action: string, target: string, detail?: unknown) {
  await (await db()).collection(C.audit).insertOne({ userId: user.id, email: user.email, action, target, detail: detail ?? null, at: new Date() });
}
