import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { getActiveAdvisories, getExperiencesForTrek, getPublicDepartures, getTrekBySlug } from "@/lib/data/public";
import { BookingForm } from "@/components/BookingForm";
import { countryOptions } from "@/lib/countries";
import { addDays } from "@/lib/format";
import { BookingSkeleton } from "@/components/Skeletons";

export const metadata: Metadata = { title: "Request a booking", robots: { index: false } };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default function BookPage({ params, searchParams }: PageProps<"/book/[slug]">) {
  return (
    <Suspense fallback={<BookingSkeleton />}>
      <Book params={params} searchParams={searchParams as Promise<SP>} />
    </Suspense>
  );
}

async function Book({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  await connection();
  const trek = await getTrekBySlug(slug);
  if (!trek) notFound();
  const [departures, experiences, advisories] = await Promise.all([getPublicDepartures(), getExperiencesForTrek(trek.id), getActiveAdvisories()]);
  const suspended = advisories.some((a) => a.suspendBooking && a.trekIds.includes(trek.id));
  const minDate = addDays(new Date().toISOString().slice(0, 10), 7);
  return (
    <>
      <header className="page-head wrap">
        <ol className="crumbs"><li><Link href="/treks">Treks</Link></li><li><Link href={`/treks/${trek.slug}`}>{trek.name}</Link></li><li>Booking</li></ol>
        <h1 className="display display--lg">Request a booking</h1>
        <p className="lede">{trek.name}, {trek.durationDays} days. Choose a departure, decide on any extras, and send your details.</p>
      </header>
      <section className="wrap" style={{ paddingBottom: "var(--sc-section)" }}>
        {suspended ? (
          <p className="notice-box">Bookings for this trek are paused while a route advisory is active. <Link href={`/treks/${trek.slug}`}>See the advisory</Link> or <Link href="/contact">contact us</Link>.</p>
        ) : (
          <BookingForm
            trek={{ slug: trek.slug, name: trek.name, basePrice: trek.basePrice, durationDays: trek.durationDays }}
            departures={departures.filter((d) => d.trekId === trek.id)}
            experiences={experiences}
            countries={countryOptions()}
            initialDeparture={one(sp.departure)}
            initialAddOn={one(sp.addon)}
            minDate={minDate}
          />
        )}
      </section>
    </>
  );
}
