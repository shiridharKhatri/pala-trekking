import "server-only";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { db } from "../db";

/** Paths offered in image pickers: bundled photos plus uploaded files. */
export async function mediaLibrary(): Promise<string[]> {
  const dir = path.join(process.cwd(), "public", "media", "photos");
  const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).map((f) => `/media/photos/${f}`);
  const uploads = await (await db()).collection("media").find({}, { projection: { src: 1 } }).sort({ createdAt: -1 }).limit(300).toArray();
  return [...uploads.map((u) => String(u.src)), ...files];
}
