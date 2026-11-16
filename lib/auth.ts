import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createHash, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db, C } from "./db";
import { oid } from "./serialize";
import type { AdminUser, Role } from "./types";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

export const SESSION_COOKIE = "pt_admin";
const SESSION_HOURS = 12;

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, N, r, p, saltB64, hashB64] = stored.split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(hashB64, "base64");
  const got = await scrypt(pw, Buffer.from(saltB64, "base64"), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
  await (await db()).collection(C.sessions).insertOne({ tokenHash: sha256(token), userId, expiresAt, createdAt: new Date() });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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
  if (!token) return null;
  const database = await db();
  const session = await database.collection(C.sessions).findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  const id = oid(String(session.userId));
  const u = id ? await database.collection(C.users).findOne({ _id: id, active: true }) : null;
  if (!u) return null;
  return { id: u._id.toHexString(), email: u.email, name: u.name, role: u.role as Role, mustChangePassword: !!u.mustChangePassword };
}

/** Authorisation gate for admin pages and every server action. */
export async function requireAdmin(roles: Role[] = ["admin", "content"]): Promise<AdminUser> {
  const u = await getAdmin();
  if (!u) redirect("/admin/login");
  if (!roles.includes(u.role)) redirect("/admin?denied=1");
  return u;
}

async function clientIp(): Promise<string> {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

// Login throttling: 8 failures per email or IP per 15 minutes (TTL index cleans up).
export async function loginBlocked(email: string): Promise<boolean> {
  const ip = await clientIp();
  const since = new Date(Date.now() - 15 * 60_000);
  const n = await (await db()).collection("loginAttempts").countDocuments({ $or: [{ email }, { ip }], at: { $gt: since } });
  return n >= 8;
}

export async function recordFailedLogin(email: string): Promise<void> {
  const ip = await clientIp();
  await (await db()).collection("loginAttempts").insertOne({ email, ip, at: new Date() });
}

export async function audit(user: AdminUser, action: string, target: string, detail?: unknown) {
  await (await db()).collection(C.audit).insertOne({ userId: user.id, email: user.email, action, target, detail: detail ?? null, at: new Date() });
}
