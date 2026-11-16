import Link from "next/link";
import type { PublicDeparture } from "@/lib/types";
import { addDays, date } from "@/lib/format";
import { bookable, departureStatusLabel } from "@/lib/departures";
import { MONTH_LONG } from "@/lib/season";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Month grid of the public departure board. Each departure is a chip on its
 * start day, coloured by status; a thin bar shows how many days it runs.
 * Anonymous counts only, same as the list view (PRD section 9).
 */
export function DepartureCalendar({ departures, month, hrefFor }: {
  departures: PublicDeparture[];
  month: string; // YYYY-MM
  hrefFor: (month: string) => string;
}) {
  const months = [...new Set(departures.map((d) => d.startDate.slice(0, 7)))].sort();
  const i = months.indexOf(month);
  const prev = i > 0 ? months[i - 1] : null;
  const next = i >= 0 && i < months.length - 1 ? months[i + 1] : null;
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const inMonth = departures.filter((d) => d.startDate.startsWith(month));
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, k) => k + 1)];
  while (cells.length % 7) cells.push(null);
  const title = `${MONTH_LONG[m - 1]} ${y}`;

  return (
    <div className="cal">
      <div className="cal__head">
        {prev ? <Link className="btn btn--ghost btn--small" href={hrefFor(prev)} scroll={false}>← <span className="vh">Previous month with departures, </span>{MONTH_LONG[Number(prev.slice(5)) - 1]}</Link> : <span />}
        <h2 className="cal__title" aria-live="polite">{title}</h2>
        {next ? <Link className="btn btn--ghost btn--small" href={hrefFor(next)} scroll={false}><span className="vh">Next month with departures, </span>{MONTH_LONG[Number(next.slice(5)) - 1]} →</Link> : <span />}
      </div>

      <div className="cal__grid" role="table" aria-label={`Departures in ${title}`}>
        <div role="row" className="cal__row cal__row--head">
          {WEEKDAYS.map((w) => <div key={w} role="columnheader" className="cal__wd">{w}</div>)}
        </div>
        {Array.from({ length: cells.length / 7 }, (_, r) => (
          <div role="row" className="cal__row" key={r}>
            {cells.slice(r * 7, r * 7 + 7).map((d, c) => {
              if (d == null) return <div role="cell" key={c} className="cal__cell cal__cell--empty" />;
              const iso = `${month}-${String(d).padStart(2, "0")}`;
              const here = inMonth.filter((x) => x.startDate === iso);
              return (
                <div role="cell" key={c} className="cal__cell" data-has={here.length > 0 || undefined}>
                  <span className="cal__day">{d}</span>
                  {here.map((x) => (
                    <Link
                      key={x.id}
                      href={bookable(x.status) ? `/book/${x.trekSlug}?departure=${x.id}` : `/treks/${x.trekSlug}`}
                      className={`cal__chip cal__chip--${x.status}`}
                      title={`${x.trekName}: ${date(x.startDate)} to ${date(addDays(x.startDate, x.durationDays - 1))}. ${departureStatusLabel[x.status]}, ${x.spacesLeft} spaces left`}
                    >
                      <span className="cal__chip-name">{x.trekName}</span>
                      <span className="cal__chip-meta">{departureStatusLabel[x.status]} · {x.spacesLeft} left</span>
                      <span className="vh">, {x.durationDays} days. {bookable(x.status) ? "Request booking" : "View trek"}</span>
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Phones: the grid shows dots, this agenda carries the detail. */}
      <ol className="cal__agenda" aria-label={`Departures in ${title}, as a list`}>
        {inMonth.map((x) => (
          <li key={x.id}>
            <span className="mono">{date(x.startDate, { year: undefined })}</span>
            <Link href={bookable(x.status) ? `/book/${x.trekSlug}?departure=${x.id}` : `/treks/${x.trekSlug}`}>{x.trekName}</Link>
            <span className={`status status--${x.status}`}>{departureStatusLabel[x.status]}</span>
          </li>
        ))}
      </ol>
      {!inMonth.length && <p className="empty">No departures match in {title}.</p>}
    </div>
  );
}
