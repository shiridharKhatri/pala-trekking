import { requireAdmin, audit } from "@/lib/auth";
import { db, C } from "@/lib/db";
import { BOOKING_STATUSES } from "@/lib/types";

// CSV export of bookings (contains customer data: admin only, audited).
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Spreadsheet formula-injection guard: a cell that starts with = + - @ tab or
// CR would be executed by Excel/Sheets, so prefix it with an apostrophe.
function cell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  const user = await requireAdmin(["admin"]);
  const sp = new URL(req.url).searchParams;
  const filter: Record<string, unknown> = {};
  const status = sp.get("status") ?? "";
  const source = sp.get("source") ?? "";
  const trek = sp.get("trek") ?? "";
  const q = (sp.get("q") ?? "").trim().slice(0, 100);
  if (BOOKING_STATUSES.includes(status as never)) filter.status = status;
  if (["website", "offline"].includes(source)) filter.source = source;
  if (/^[a-f0-9]{24}$/.test(trek)) filter.trekId = trek;
  if (q) { const rx = new RegExp(esc(q), "i"); filter.$or = [{ ref: rx }, { "lead.name": rx }, { "lead.email": rx }, { trekName: rx }]; }

  const rows = await (await db()).collection(C.bookings).find(filter).sort({ createdAt: -1 }).limit(5000).toArray();
  const head = ["Reference", "Received (UTC)", "Status", "Channel", "Trek", "Start date", "Preferred date", "Travellers", "Trek subtotal", "Add-ons", "Add-on total", "Total", "Currency", "Lead traveller", "Email", "Phone", "Country", "Message", "Internal notes"];
  const lines = [head.map(cell).join(",")];
  for (const b of rows) {
    lines.push([
      b.ref, new Date(b.createdAt).toISOString(), b.status, b.source, b.trekName, b.departureDate, b.preferredDate, b.travellers, b.trekSubtotal,
      (b.addOns ?? []).map((a: { name: string }) => a.name).join("; "), b.addOnTotal, b.total, b.currency,
      b.lead?.name, b.lead?.email, b.lead?.phone, b.lead?.country, b.message, b.adminNotes,
    ].map(cell).join(","));
  }
  await audit(user, "booking.export", "bookings", { rows: rows.length, filters: { status, source, trek: !!trek, q: !!q } });
  return new Response("﻿" + lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pala-bookings-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
