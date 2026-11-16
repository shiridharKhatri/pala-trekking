import Link from "next/link";
import type { PublicDeparture } from "@/lib/types";
import { addDays, date, gatewayLabel } from "@/lib/format";
import { bookable, departureStatusLabel } from "@/lib/departures";

/** Public departure board (PRD section 9). Anonymous counts only. */
export function DepartureBoard({ departures, showTrek = true, caption }: { departures: PublicDeparture[]; showTrek?: boolean; caption: string }) {
  if (!departures.length) {
    return <p className="empty">No upcoming departures are published yet. You can still request a preferred date on any trek.</p>;
  }
  return (
    <table className="board">
      <caption className="vh">{caption}</caption>
      <thead>
        <tr>
          {showTrek && <th scope="col">Trek</th>}
          <th scope="col">Dates</th>
          <th scope="col">Status</th>
          <th scope="col">Travellers</th>
          <th scope="col">Spaces</th>
          <th scope="col"><span className="vh">Action</span></th>
        </tr>
      </thead>
      <tbody>
        {departures.map((d) => {
          const cap = d.travellerCount + d.spacesLeft;
          return (
            <tr key={d.id}>
              {showTrek && (
                <td data-col="trek">
                  <Link className="board__trek" href={`/treks/${d.trekSlug}`}>{d.trekName}</Link>
                  <div className="label">From {gatewayLabel[d.gateway]} · {d.durationDays} days</div>
                </td>
              )}
              <td className="mono" data-col="dates">
                <time dateTime={d.startDate}>{date(d.startDate)}</time>
                <span aria-hidden="true"> to </span><span className="vh"> to </span>
                <time dateTime={addDays(d.startDate, d.durationDays - 1)}>{date(addDays(d.startDate, d.durationDays - 1), { year: undefined })}</time>
              </td>
              <td data-col="status"><span className={`status status--${d.status}`}>{departureStatusLabel[d.status]}</span></td>
              <td className="mono" data-col="seats">
                <span className="seats" aria-hidden="true">
                  {Array.from({ length: Math.min(cap, 16) }, (_, i) => <i key={i} data-taken={i < d.travellerCount ? "" : undefined} />)}
                </span>{" "}
                <span>{d.travellerCount} booked</span>
              </td>
              <td className="mono" data-col="spaces">{d.spacesLeft > 0 ? `${d.spacesLeft} left` : "None"}</td>
              <td data-col="action" style={{ textAlign: "right" }}>
                {bookable(d.status) ? (
                  <Link className="btn btn--small" href={`/book/${d.trekSlug}?departure=${d.id}`}>Request booking</Link>
                ) : (
                  <Link className="btn btn--ghost btn--small" href={`/treks/${d.trekSlug}`}>View trek</Link>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
