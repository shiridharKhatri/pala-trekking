import Image from "next/image";
import Link from "next/link";
import type { TrekCard as T } from "@/lib/types";
import { difficultyLabel, gatewayLabel, metres } from "@/lib/format";
import { Price } from "./CurrencyProvider";
import { CompareToggle } from "./Compare";

export function TrekCard({ trek, regionName, priority = false, style, marker = false }: { trek: T; regionName?: string; priority?: boolean; style?: React.CSSProperties; marker?: boolean }) {
  return (
    <article className="trek-card" style={style} data-alt={marker ? trek.maxAltitudeM : undefined} data-alt-label={marker ? trek.name : undefined}>
      <div className="trek-card__media">
        {trek.heroImage && (
          <Image src={trek.heroImage.src} alt={trek.heroImage.alt} fill sizes="(max-width: 700px) 92vw, 28rem" quality={72} priority={priority} style={{ objectFit: "cover" }} />
        )}
        <span className="chip trek-card__badge">From {gatewayLabel[trek.gateway]}</span>
      </div>
      <div className="trek-card__body">
        <h3 className="trek-card__title"><Link href={`/treks/${trek.slug}`}>{trek.name}</Link></h3>
        {regionName && <p className="label" style={{ margin: 0 }}>{regionName}</p>}
        <dl className="trek-card__facts">
          <div><dt>Days</dt><dd>{trek.durationDays}</dd></div>
          <div><dt>Max alt.</dt><dd>{metres(trek.maxAltitudeM)}</dd></div>
          <div><dt>Grade</dt><dd>{difficultyLabel[trek.difficulty]}</dd></div>
        </dl>
        <p className="trek-card__summary">{trek.summary}</p>
        <div className="trek-card__foot">
          <span className="price-from">From <strong><Price amount={trek.basePrice} /></strong> pp</span>
          <CompareToggle slug={trek.slug} name={trek.name} />
        </div>
      </div>
    </article>
  );
}
