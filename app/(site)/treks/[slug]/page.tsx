import type { Metadata } from "next";
import { Suspense, ViewTransition } from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import {
  getActiveAdvisories, getExperiencesForTrek, getPublicDepartures, getPublishedSlugs, getRegions,
  getSettings, getStayPoints, getTrekBySlug,
} from "@/lib/data/public";
import { getRouteWeather } from "@/lib/weather";
import { ScrollStage } from "@/components/ScrollStage";
import { Ascent } from "@/components/Ascent";
import { DepartureBoard } from "@/components/DepartureBoard";
import { ChargeNote, Price } from "@/components/CurrencyProvider";
import { CompareToggle } from "@/components/Compare";
import { difficultyLabel, feet, gatewayLabel, metres } from "@/lib/format";
import { bookable } from "@/lib/departures";
import { HeroSkeleton } from "@/components/Skeletons";

export async function generateStaticParams() {
  const slugs = await getPublishedSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/treks/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTrekBySlug(slug);
  if (!t) return { title: "Trek not found" };
  return {
    title: t.seoTitle || t.name,
    description: t.seoDescription || t.summary,
    alternates: { canonical: `/treks/${t.slug}` },
    openGraph: { title: t.seoTitle || t.name, description: t.seoDescription || t.summary, images: t.heroImage ? [{ url: t.heroImage.src, alt: t.heroImage.alt }] : [] },
  };
}

export default function TrekPage({ params }: PageProps<"/treks/[slug]">) {
  return (
    <Suspense fallback={<HeroSkeleton />}>
      <TrekDetail params={params} />
    </Suspense>
  );
}

async function TrekDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trek = await getTrekBySlug(slug);
  if (!trek) notFound();

  const stayIds = [...new Set(trek.itinerary.map((d) => d.stayPointId).filter(Boolean) as string[])];
  const [settings, regions, stayPoints, experiences, allDepartures, advisories] = await Promise.all([
    getSettings(), getRegions(), getStayPoints(stayIds), getExperiencesForTrek(trek.id), getPublicDepartures(), getActiveAdvisories(),
  ]);
  const region = regions.find((r) => r.id === trek.regionId);
  const departures = allDepartures.filter((d) => d.trekId === trek.id);
  const relevant = advisories.filter((a) => a.trekIds.includes(trek.id) || a.stayPointIds.some((s) => stayIds.includes(s)));
  const suspended = relevant.some((a) => a.suspendBooking);
  const weatherDisabled = relevant.filter((a) => a.disableWeather).flatMap((a) => (a.stayPointIds.length ? a.stayPointIds : stayIds));
  const ascentProps = { itinerary: trek.itinerary, stayPoints, weatherDisabled, departures, attribution: settings.weatherAttribution };
  const nextBookable = departures.filter((d) => bookable(d.status)).slice(0, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: trek.name,
    description: trek.summary,
    touristType: trek.travellerProfile,
    image: trek.heroImage ? [trek.heroImage.src] : undefined,
    itinerary: {
      "@type": "ItemList",
      itemListElement: trek.itinerary.map((d) => ({ "@type": "ListItem", position: d.day, name: `Day ${d.day}: ${d.destination}`, description: d.activities })),
    },
    provider: { "@type": "Organization", name: "Pala Trekking" },
    ...(trek.sample ? {} : { offers: { "@type": "Offer", price: trek.basePrice, priceCurrency: settings.currency.base, url: `/treks/${trek.slug}` } }),
  };

  return (
    <ScrollStage>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {/* Cinematic introduction: the image recedes while the title holds */}
      <section className="trek-hero" data-rail-hide data-sc-act="flow" aria-labelledby="trek-title" data-alt={trek.maxAltitudeM} data-alt-label={`Highest point, ${trek.name}`}>
        {trek.heroImage && (
          <div className="trek-hero__img" data-sc-parallax="1.6">
            <ViewTransition name={`trek-photo-${trek.slug}`} share="trek-morph" default="none">
              <div className="trek-hero__photo">
                <Image src={trek.heroImage.src} alt={trek.heroImage.alt} fill priority sizes="100vw" quality={80} style={{ objectFit: "cover" }} />
              </div>
            </ViewTransition>
          </div>
        )}
        <div className="trek-hero__scrim" />
        <div className="trek-hero__copy">
          <ol className="crumbs">
            <li><Link href="/treks">Treks</Link></li>
            <li><Link href={`/gateways/${trek.gateway}`}>{gatewayLabel[trek.gateway]}</Link></li>
            {region && <li><Link href={`/treks?region=${region.slug}`}>{region.name}</Link></li>}
          </ol>
          <h1 id="trek-title" className="display display--xl" data-sc-kinetic="lines" data-sc-cue="0 1 0 0">{trek.name}</h1>
          <p className="lede" style={{ color: "#e4e7e1" }}>{trek.summary}</p>
        </div>
      </section>

      <section className="wrap section--tight" aria-label="Key facts">
        <dl className="facts">
          <div><dt>Duration</dt><dd>{trek.durationDays} days</dd></div>
          <div><dt>Difficulty</dt><dd>{difficultyLabel[trek.difficulty]}</dd></div>
          <div><dt>Maximum altitude</dt><dd>{metres(trek.maxAltitudeM)}<small>{feet(trek.maxAltitudeM)}</small></dd></div>
          <div><dt>Daily walking</dt><dd>{trek.walkingHoursMin} to {trek.walkingHoursMax} hours</dd></div>
          <div><dt>Best season</dt><dd>{trek.bestSeason}</dd></div>
          <div><dt>Gateway</dt><dd>{gatewayLabel[trek.gateway]}</dd></div>
          <div><dt>Trailhead</dt><dd>{trek.trailhead}</dd></div>
          <div><dt>From</dt><dd><Price amount={trek.basePrice} /><small>per person, {settings.currency.base} base</small></dd></div>
        </dl>
        <ol className="route-line" aria-label="Route" style={{ marginTop: "var(--sc-5)" }}>
          <li>Pickup <b>{trek.pickupPoint}</b></li>
          <li>Trailhead <b>{trek.trailhead}</b></li>
          <li>Destination <b>{trek.destination}</b></li>
          <li>Ends <b>{trek.endingPoint}</b></li>
          <li>Return <b>{trek.returnCity}</b></li>
        </ol>
      </section>

      {relevant.length > 0 && (
        <section className="wrap" aria-label="Route advisories" style={{ display: "grid", gap: "var(--sc-3)" }}>
          {relevant.map((a) => (
            <div key={a.id} className={`advisory advisory--${a.severity}`} role="note">
              <h3>{a.title}</h3>
              <p>{a.body}</p>
            </div>
          ))}
        </section>
      )}

      <section className="wrap section--tight">
        <div className="detail-grid">
          <div style={{ display: "grid", gap: "var(--sc-7)" }}>
            <div data-sc-in data-sc-stagger="60">
              <h2 className="display display--md">Overview</h2>
              <p className="prose" style={{ marginTop: "1rem" }}>{trek.overview}</p>
            </div>
            <div className="two-col-list" data-sc-in>
              <div>
                <h3 className="label">Highlights</h3>
                <ul>{trek.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
              </div>
              <div>
                <h3 className="label">Who it suits</h3>
                <p className="prose">{trek.travellerProfile}</p>
                <h3 className="label" style={{ marginTop: "var(--sc-5)" }}>Fitness</h3>
                <p className="prose">{trek.fitness}</p>
              </div>
            </div>
          </div>
          <aside className="book-panel" aria-label="Booking">
            <div className="book-panel__price">
              <span className="label">From, per person</span>
              <strong><Price amount={trek.basePrice} /></strong>
              <ChargeNote amount={trek.basePrice} />
            </div>
            {suspended ? (
              <p className="notice-box">Bookings for this trek are paused while a route advisory is active.</p>
            ) : (
              <>
                {nextBookable.length > 0 && (
                  <ul aria-label="Next departures">
                    {nextBookable.map((d) => (
                      <li key={d.id}>
                        <Link href={`/book/${trek.slug}?departure=${d.id}`}>
                          <span className="mono">{new Date(`${d.startDate}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</span>
                          <span>{d.spacesLeft} left</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <Link className="btn btn--block" href={`/book/${trek.slug}`}>Request booking</Link>
              </>
            )}
            <CompareToggle slug={trek.slug} name={trek.name} />
          </aside>
        </div>
      </section>

      <section className="wrap section" aria-labelledby="itinerary-title">
        <div className="split-head">
          <div>
            <h2 id="itinerary-title" className="display display--lg">Day by day</h2>
            <p className="lede" style={{ marginTop: "0.75rem" }}>Follow the route as the profile draws. Each overnight stop carries its own weather.</p>
          </div>
        </div>
        {/* Weather streams in; the itinerary is complete without it. */}
        <Suspense fallback={<Ascent {...ascentProps} weather={null} loading />}>
          <AscentWithWeather {...ascentProps} />
        </Suspense>
      </section>

      <section className="ground-paper section" aria-labelledby="included-title">
        <div className="wrap" style={{ display: "grid", gap: "var(--sc-8)" }}>
          <div>
            <h2 id="included-title" className="display display--lg">What is included</h2>
            <div className="two-col-list" style={{ marginTop: "var(--sc-6)" }}>
              <div><h3 className="label">Included</h3><ul>{trek.inclusions.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div><h3 className="label">Not included</h3><ul>{trek.exclusions.map((x) => <li key={x}>{x}</li>)}</ul></div>
            </div>
          </div>
          <dl className="facts" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))" }}>
            <div><dt>Accommodation</dt><dd style={{ fontSize: "var(--sc-t-base)", fontWeight: 400 }}>{trek.accommodation}</dd></div>
            <div><dt>Meals</dt><dd style={{ fontSize: "var(--sc-t-base)", fontWeight: 400 }}>{trek.meals}</dd></div>
            <div><dt>Transport</dt><dd style={{ fontSize: "var(--sc-t-base)", fontWeight: 400 }}>{trek.transport}</dd></div>
            <div><dt>Guide and porters</dt><dd style={{ fontSize: "var(--sc-t-base)", fontWeight: 400 }}>{trek.guidePorter}</dd></div>
            <div><dt>Supplements</dt><dd style={{ fontSize: "var(--sc-t-base)", fontWeight: 400 }}>{trek.supplements}</dd></div>
            <div><dt>Cancellation</dt><dd style={{ fontSize: "var(--sc-t-base)", fontWeight: 400 }}>{trek.cancellation} <Link href="/cancellation-policy">Read the policy</Link></dd></div>
          </dl>
        </div>
      </section>

      <section className="wrap section" aria-labelledby="prep-title">
        <h2 id="prep-title" className="display display--lg">Preparation</h2>
        <div className="two-col-list" style={{ marginTop: "var(--sc-6)" }}>
          <div className="prose">
            <h3 className="label">Altitude</h3><p>{trek.altitudeInfo}</p>
            <h3 className="label">Safety</h3><p>{trek.safety}</p>
            <h3 className="label">Insurance</h3><p>{trek.insurance}</p>
            <h3 className="label">Permits</h3><p>{trek.permits}</p>
          </div>
          <div>
            <h3 className="label">Packing</h3>
            <ul>{trek.packing.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        </div>
      </section>

      {experiences.length > 0 && (
        <section className="wrap section--tight" aria-labelledby="addons-title">
          <h2 id="addons-title" className="display display--md">Optional experiences for this trek</h2>
          <p className="lede" style={{ marginTop: "0.75rem" }}>Add one when you book, or don&apos;t. Each adds a fixed price to your total.</p>
          <div className="catalogue__grid" style={{ marginTop: "var(--sc-6)" }}>
            {experiences.map((e) => (
              <article key={e.id} className="trek-card">
                {e.image && <div className="trek-card__media"><Image src={e.image.src} alt={e.image.alt} fill sizes="(max-width: 700px) 92vw, 28rem" quality={72} style={{ objectFit: "cover" }} /></div>}
                <div className="trek-card__body">
                  <h3 className="trek-card__title"><Link href={`/experiences/${e.slug}`}>{e.name}</Link></h3>
                  <p className="label" style={{ margin: 0 }}>{e.location} · {e.durationNights} {e.durationNights === 1 ? "night" : "nights"}</p>
                  <p className="trek-card__summary">{e.summary}</p>
                  <div className="trek-card__foot"><span className="price-from">Adds <strong><Price amount={e.price} /></strong></span></div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="ground-paper section" aria-labelledby="deps-title">
        <div className="wrap">
          <div className="split-head">
            <h2 id="deps-title" className="display display--md">Departures</h2>
            {!suspended && <Link className="link-arrow" href={`/book/${trek.slug}`}>Request another date</Link>}
          </div>
          <DepartureBoard departures={departures} showTrek={false} caption={`Departures for ${trek.name}`} />
        </div>
      </section>

      {trek.gallery.length > 0 && (
        <section className="wrap section" aria-labelledby="gallery-title">
          <h2 id="gallery-title" className="display display--md" style={{ marginBottom: "var(--sc-6)" }}>Along the route</h2>
          <div className="gallery">
            {trek.gallery.map((g, i) => (
              <figure key={g.src + i} data-sc-reveal={i === 0 ? "up" : undefined} data-sc-reveal-at="0.05 0.4">
                <Image src={g.src} alt={g.alt} width={1600} height={1200} sizes={i === 0 ? "(max-width: 760px) 92vw, 60vw" : "(max-width: 760px) 92vw, 30vw"} quality={72} />
              </figure>
            ))}
          </div>
        </section>
      )}
    </ScrollStage>
  );
}

async function AscentWithWeather(props: Omit<React.ComponentProps<typeof Ascent>, "weather" | "loading">) {
  // Request time only: the build and the static shell never depend on the provider.
  await connection();
  const points = props.stayPoints
    .filter((s) => s.weatherEnabled && !props.weatherDisabled.includes(s.id))
    .map((s) => ({ id: s.id, lat: s.lat, lon: s.lon, elevationM: s.elevationM }));
  const weather = await getRouteWeather(points);
  return <Ascent {...props} weather={weather} />;
}
