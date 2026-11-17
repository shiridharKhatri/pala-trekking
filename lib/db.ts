import "server-only";
import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGODB_DB ?? "palatrek";

declare global {
  var __palatrekMongo: Promise<MongoClient> | undefined;
}

function client(): Promise<MongoClient> {
  if (!globalThis.__palatrekMongo) {
    globalThis.__palatrekMongo = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    }).connect();
    globalThis.__palatrekMongo.catch(() => {
      globalThis.__palatrekMongo = undefined;
    });
  }
  return globalThis.__palatrekMongo;
}

export async function db(): Promise<Db> {
  return (await client()).db(dbName);
}

export const C = {
  gateways: "gateways",
  regions: "regions",
  treks: "treks",
  stayPoints: "stayPoints",
  experiences: "experiences",
  departures: "departures",
  bookings: "bookings",
  advisories: "advisories",
  settings: "settings",
  pages: "pages",
  faqs: "faqs",
  guides: "guides",
  posts: "posts",
  inquiries: "inquiries",
  users: "users",
  sessions: "sessions",
  audit: "audit",
} as const;
