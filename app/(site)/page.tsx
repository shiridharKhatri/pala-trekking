import Image from "next/image";
import Link from "next/link";
import { ScrollStage } from "@/components/ScrollStage";
import { TrekCard } from "@/components/TrekCard";
import { DepartureBoard } from "@/components/DepartureBoard";
import { Price } from "@/components/CurrencyProvider";
import {
  getGateways, getPublicDepartures, getPublishedExperiences, getPublishedTreks, getRegions, getSettings,
} from "@/lib/data/public";
import { metres } from "@/lib/format";

export default async function Home() {
  const [settings, treks, gateways, regions, departures, experiences] = await Promise.all([
    getSettings(), getPublishedTreks(), getGateways(), getRegions(), getPublicDepartures(), getPublishedExperiences(),
  ]);
  const home = settings.home;
  const featured = treks.filter((t) => t.featured).slice(0, 6);
  const regionName = (id: string) => regions.find((r) => r.id === id)?.name;
  const closeTrek = treks.find((t) => t.gateway === "pokhara") ?? treks[0];

  return (
    <ScrollStage>
      {/* ---- 1. Hero: layered planes, headline between the peak and the cairns ---- */}
      <section className="hero" data-rail-hide data-sc-act="pin" data-sc-span="2.4" aria-labelledby="hero-title">
        <div className="hero__stage" data-sc-stage>
          <div className="hero__plane hero__far" data-sc-parallax="-0.4">
            <picture>
              <source media="(max-width: 700px)" srcSet="/media/hero/hero-far-m.webp" />
              <img src="/media/hero/hero-far.webp" alt="" width={2400} height={1600} fetchPriority="high" decoding="async" />
            </picture>
          </div>
          <div className="hero__titlescrim" aria-hidden="true" />
          <div className="hero__title">
            <h1 id="hero-title" className="display display--xl" data-sc-cue="0 0.62 0 0.3">{home.heroTitle}</h1>
          </div>
          <div className="hero__plane hero__near" data-sc-parallax="-1.8">
            <picture>
              <source media="(max-width: 700px)" srcSet="/media/hero/hero-near-v7-m.webp" />
              <img
                src="/media/hero/hero-near-v7.webp"
                alt="Ama Dablam above stone memorial cairns and prayer flags on the trail in the Khumbu"
                width={2400} height={2000} fetchPriority="high" decoding="async"
              />
            </picture>
          </div>
          <div className="hero__haze" />
          <div className="hero__scrim" />
          <div className="hero__copy" data-sc-cue="0 0.5 0 0.25">
            <p className="lede">{home.heroSubtitle}</p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <Link href="/treks" className="btn">Find a trek</Link>
              <Link href="/departures" className="btn btn--ghost" style={{ color: "#f4f5f0", borderColor: "rgba(255,255,255,0.4)" }}>Departures</Link>
            </div>
          </div>
          <p className="hero__second" data-sc-cue="0.55 1 0.2 0.1">{home.heroSecondLine}</p>
        </div>
      </section>

      {/* ---- 2. Gateways ---- */}
      <section aria-labelledby="gateways-title">
        <div className="wrap section--tight" data-sc-in data-sc-stagger="70">
          <h2 id="gateways-title" className="display display--lg">{home.gatewaysTitle}</h2>
          <p className="lede" style={{ marginTop: "1rem" }}>{home.gatewaysIntro}</p>
        </div>
        <div className="gateways">
          {gateways.map((g) => {
            const gRegions = regions.filter((r) => r.gateway === g.slug);
            const count = treks.filter((t) => t.gateway === g.slug).length;
            return (
              <article key={g.id} className="gateway" data-alt={g.elevationM ?? undefined} data-alt-label={g.name}>
                {g.image && (
                  <div className="gateway__img" data-sc-reveal="up" data-sc-reveal-at="0.05 0.45">
                    <Image src={g.image.src} alt={g.image.alt} fill sizes="(max-width: 860px) 100vw, 50vw" quality={72} style={{ objectFit: "cover" }} />
                  </div>
                )}
                {g.elevationM != null && <p className="gateway__elev">{metres(g.elevationM, true)}</p>}
                <h3 className="display display--md">{g.name}</h3>
                <p>{g.summary}</p>
                <ul className="gateway__regions">
                  {gRegions.map((r) => (
                    <li key={r.id}>
                      <Link href={`/treks?region=${r.slug}`}>{r.name}<span>{treks.filter((t) => t.regionId === r.id).length} treks</span></Link>
                    </li>
                  ))}
                </ul>
                <Link className="link-arrow" href={`/gateways/${g.slug}`}>{count} treks from {g.name}</Link>
              </article>
            );
          })}
        </div>
      </section>

      {/* ---- 3. Featured treks: lateral rail ---- */}
      {featured.length > 0 && (
        <section className="rail-act" data-sc-act="pan" data-sc-span={String(featured.length + 1.6)} aria-labelledby="featured-title">
          <div data-sc-stage>
            <div className="rail" data-sc-pan="0.04">
              <div className="rail__intro">
                <h2 id="featured-title" className="display display--lg">{home.featuredTitle}</h2>
                <p className="lede">Duration, highest point and grade, side by side. Add up to three to compare.</p>
              </div>
              {featured.map((t, i) => (
                <TrekCard key={t.id} trek={t} marker regionName={regionName(t.regionId)} style={{ ["--i" as string]: i }} />
              ))}
              <div className="rail__end">
                <p className="display display--sm">{treks.length} treks in the catalogue</p>
                <Link className="btn" href="/treks">See all treks</Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---- 4. Departure board excerpt ---- */}
      <section className="ground-paper section" aria-labelledby="dep-title">
        <div className="wrap">
          <div className="split-head" data-sc-in data-sc-stagger="60">
            <div>
              <h2 id="dep-title" className="display display--lg">Upcoming departures</h2>
              <p className="lede" style={{ marginTop: "0.75rem" }}>Only Pala Trekking groups. We show how many are going, never who.</p>
            </div>
            <Link className="link-arrow" href="/departures">Full departure board</Link>
          </div>
          <DepartureBoard departures={departures.slice(0, 5)} caption="Next five Pala Trekking departures" />
        </div>
      </section>

      {/* ---- 5. Optional experiences ---- */}
      {experiences.length > 0 && (
        <section className="section" aria-labelledby="exp-title">
          <div className="wrap">
            <div className="split-head" data-sc-in>
              <h2 id="exp-title" className="display display--lg">Before or after the trail</h2>
              <Link className="link-arrow" href="/experiences">All experiences</Link>
            </div>
            {experiences.slice(0, 2).map((e, i) => (
              <div className="exp" key={e.id}>
                <div className="exp__media" data-sc-reveal={i === 0 ? "iris" : "left"} data-sc-reveal-at="0.1 0.5">
                  {e.image && <Image src={e.image.src} alt={e.image.alt} width={1200} height={960} sizes="(max-width: 860px) 92vw, 50vw" quality={72} />}
                </div>
                <div className="exp__body" data-sc-in data-sc-stagger="60">
                  <p className="label">{e.location} · {e.durationNights} {e.durationNights === 1 ? "night" : "nights"}</p>
                  <h3 className="display display--md">{e.name}</h3>
                  <p className="prose" style={{ margin: 0 }}>{e.summary}</p>
                  <p style={{ margin: 0 }}>Adds <strong><Price amount={e.price} /></strong> to your booking. Optional.</p>
                  <Link className="link-arrow" href={`/experiences/${e.slug}`}>About this experience</Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- 6. What you see before you commit ---- */}
      <section className="section ground-paper" aria-labelledby="trust-title">
        <div className="wrap trust">
          <h2 id="trust-title" className="display display--lg" data-sc-in>{home.trustTitle}</h2>
          <ol data-sc-in data-sc-stagger="70">
            {home.trustPoints.map((p) => (
              <li key={p.title}><h3>{p.title}</h3><p>{p.body}</p></li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- 7. Close ---- */}
      <section className="close" aria-labelledby="close-title">
        <div className="close__img">
          <Image src="/media/photos/machapuchare.jpg" alt="Machhapuchhre's summit lit by the last sun above dark ridges" fill sizes="100vw" quality={72} style={{ objectFit: "cover", objectPosition: "60% 40%" }} />
        </div>
        <div className="close__copy" data-sc-in data-sc-stagger="80">
          <h2 id="close-title" className="display display--lg">{home.closeTitle}</h2>
          <p className="lede">{home.closeBody}</p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Link className="btn" href="/treks">Find a trek</Link>
            {closeTrek && <Link className="btn btn--ghost" style={{ color: "#f4f5f0", borderColor: "rgba(255,255,255,0.4)" }} href="/compare">Compare treks</Link>}
          </div>
        </div>
      </section>
    </ScrollStage>
  );
}
