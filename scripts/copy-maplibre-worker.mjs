// Serves MapLibre's map worker from our own origin (/vendor/maplibre/), so the
// Content Security Policy needs no blob: or third-party script source.
// Runs before `next dev` and `next build`; the copied file is not committed.
import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs");
const dir = path.join(root, "public/vendor/maplibre");
await mkdir(dir, { recursive: true });
await copyFile(src, path.join(dir, "maplibre-gl-worker.mjs"));
console.log("maplibre worker copied to public/vendor/maplibre/");
