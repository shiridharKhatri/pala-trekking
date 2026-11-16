import Link from "next/link";
import { pageWindow, type Page } from "@/lib/pagination";

type Params = Record<string, string | string[] | undefined>;

/** Query string for page n, keeping every other active filter (page=1 is omitted). */
function href(path: string, params: Params, n: number): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === "page") continue;
    const val = Array.isArray(v) ? v[0] : v;
    if (val) q.set(k, val);
  }
  if (n > 1) q.set("page", String(n));
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/**
 * Server-rendered pager. Plain links, so it works without JavaScript and every
 * page is crawlable. `variant="admin"` picks the admin stylesheet's classes.
 */
export function Pagination({ p, path, params, noun = "results", variant = "site" }: {
  p: Page; path: string; params: Params; noun?: string; variant?: "site" | "admin";
}) {
  const cls = variant === "admin" ? "a-pager" : "pager";
  if (p.total === 0) return null;
  const summary = (
    <p className={`${cls}__count`} role="status">
      Showing <b>{p.from}</b> to <b>{p.to}</b> of <b>{p.total}</b> {noun}
    </p>
  );
  if (p.pages <= 1) return <div className={cls}>{summary}</div>;
  return (
    <div className={cls}>
      {summary}
      <nav className={`${cls}__nav`} aria-label={`Pagination, ${noun}`}>
        {p.page > 1
          ? <Link className={`${cls}__btn`} href={href(path, params, p.page - 1)} rel="prev">Previous</Link>
          : <span className={`${cls}__btn`} aria-disabled="true">Previous</span>}
        <ol>
          {pageWindow(p.page, p.pages).map((n, i) => n == null
            ? <li key={`gap${i}`} aria-hidden="true" className={`${cls}__gap`}>…</li>
            : <li key={n}>
                <Link className={`${cls}__btn`} href={href(path, params, n)} aria-current={n === p.page ? "page" : undefined} aria-label={`Page ${n}${n === p.page ? ", current page" : ""}`}>{n}</Link>
              </li>)}
        </ol>
        {p.page < p.pages
          ? <Link className={`${cls}__btn`} href={href(path, params, p.page + 1)} rel="next">Next</Link>
          : <span className={`${cls}__btn`} aria-disabled="true">Next</span>}
      </nav>
    </div>
  );
}
