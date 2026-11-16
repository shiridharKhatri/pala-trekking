// Shared pagination maths. Pure functions, safe on server and client.

export interface Page {
  page: number; // 1-based, clamped into range
  pages: number;
  size: number;
  total: number;
  skip: number;
  from: number; // 1-based index of first item shown (0 when empty)
  to: number;
}

/** Parse ?page= defensively: anything that is not a positive integer is page 1. */
export function parsePage(v: unknown): number {
  const raw = Array.isArray(v) ? v[0] : v;
  const n = typeof raw === "string" && /^\d{1,6}$/.test(raw) ? parseInt(raw, 10) : 1;
  return n >= 1 ? n : 1;
}

export function paginate(total: number, requested: number, size: number): Page {
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(1, requested), pages);
  const skip = (page - 1) * size;
  return { page, pages, size, total, skip, from: total === 0 ? 0 : skip + 1, to: Math.min(total, skip + size) };
}

export function slicePage<T>(items: T[], requested: number, size: number): { items: T[]; p: Page } {
  const p = paginate(items.length, requested, size);
  return { items: items.slice(p.skip, p.skip + size), p };
}

/** Page numbers to render: first, last, current ±1, with null for gaps. */
export function pageWindow(page: number, pages: number): (number | null)[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const out: (number | null)[] = [];
  let prev = 0;
  for (const n of [...keep].sort((a, b) => a - b)) {
    if (n - prev > 1) out.push(null);
    out.push(n);
    prev = n;
  }
  return out;
}
