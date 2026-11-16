import Image from "next/image";
import Link from "next/link";
import { getPublishedTreks } from "@/lib/data/public";
import { metres } from "@/lib/format";
import { Mark } from "./SiteHeader";

/**
 * The public 404. Used for unmatched URLs (with its own slim header, since it
 * renders outside the site layout) and for missing treks/pages (inside it).
 * Gives a way forward instead of a dead end: search, the live treks, and the
 * main sections.
 */
export async function NotFoundView({ standalone = false }: { standalone?: boolean }) {
  let treks: Awaited<ReturnType<typeof getPublishedTreks>> = [];
  try {
    treks = (await getPublishedTreks()).slice(0, 4);
  } catch {
    // The 404 must render even if the database is unreachable.
  }
  return (
    <div className="nf">
      {standalone && (
        <header className="nf__bar">
          <Link href="/" className="wordmark"><Mark />Pala Trekking</Link>
          <nav aria-label="Main"><Link href="/treks">Treks</Link><Link href="/departures">Departures</Link><Link href="/contact">Contact</Link></nav>
        </header>
      )}
      <section className="nf__hero" aria-labelledby="nf-title">
        <div className="nf__img">
          <Image src="/media/photos/mountain-pass.jpg" alt="" fill priority sizes="100vw" quality={70} style={{ objectFit: "cover", objectPosition: "60% 40%" }} />
        </div>
        <div className="nf__scrim" />
        <div className="nf__copy wrap">
          <p className="nf__code"><span>404</span> Off route</p>
          <h1 id="nf-title" className="display display--xl">This trail doesn&apos;t go anywhere</h1>
          <p className="lede">The page may have moved, or the trek is no longer offered. Search the treks, or pick a way back below.</p>
          <form className="nf__search" method="get" action="/treks" role="search">
            <label htmlFor="nf-q" className="vh">Search treks</label>
            <input id="nf-q" className="input" type="search" name="q" placeholder="Search treks or places, e.g. Annapurna" />
            <button className="btn" type="submit">Search</button>
          </form>
          <div className="nf__actions">
            <Link className="btn btn--ghost" href="/treks">All treks</Link>
            <Link className="btn btn--ghost" href="/departures">Departure board</Link>
            <Link className="btn btn--ghost" href="/">Home</Link>
          </div>
        </div>
        <p className="nf__credit">Photo: Vyacheslav Argenberg, CC BY 4.0</p>
      </section>
      {treks.length > 0 && (
        <section className="wrap nf__treks" aria-labelledby="nf-treks">
          <h2 id="nf-treks" className="label">Treks you can book now</h2>
          <ul>
            {treks.map((t) => (
              <li key={t.id}>
                <Link href={`/treks/${t.slug}`}>
                  <span className="nf__trek">{t.name}</span>
                  <span className="mono">{t.durationDays} days · {metres(t.maxAltitudeM)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
