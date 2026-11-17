import Image from "next/image";
import Link from "next/link";
import type { Guide, TrekCard } from "@/lib/types";

/** Initials stand in for a missing photo: no stock face for a real person. */
export function GuideAvatar({ guide, size = 88 }: { guide: Guide; size?: number }) {
  const initials = guide.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  return guide.photo ? (
    <Image className="guide-avatar" src={guide.photo.src} alt={guide.photo.alt} width={size * 2} height={size * 2} sizes={`${size}px`} quality={70} style={{ width: size, height: size }} />
  ) : (
    <span className="guide-avatar guide-avatar--initials" style={{ width: size, height: size, fontSize: size * 0.34 }} aria-hidden="true">{initials}</span>
  );
}

/**
 * Guide card. The cover is a real photo of a trek this guide leads (from the
 * trek catalogue), never a stand-in portrait; the guide's own photo, when one
 * is uploaded with consent, replaces the initials.
 */
export function GuideCard({ guide, treks = [] }: { guide: Guide; treks?: Pick<TrekCard, "id" | "slug" | "name" | "heroImage">[] }) {
  const cover = treks.find((t) => t.heroImage)?.heroImage ?? null;
  const facts = [
    guide.yearsLeading != null ? `${guide.yearsLeading} ${guide.yearsLeading === 1 ? "year" : "years"} leading treks` : null,
    guide.languages.length ? guide.languages.join(", ") : null,
  ].filter(Boolean);
  return (
    <article className="guide-card">
      <div className="guide-card__cover">
        {cover ? <Image src={cover.src} alt="" fill sizes="(max-width: 700px) 92vw, 26rem" quality={65} style={{ objectFit: "cover" }} /> : null}
        <span className="guide-card__shade" aria-hidden="true" />
      </div>
      <div className="guide-card__body">
        <div className="guide-card__avatar"><GuideAvatar guide={guide} size={76} /></div>
        <p className="guide-card__role">{guide.role}</p>
        <h3 className="guide-card__name"><Link href={`/guides/${guide.slug}`}>{guide.name}</Link></h3>
        {guide.summary && <p className="guide-card__summary">{guide.summary}</p>}
        {facts.length > 0 && <p className="guide-card__facts">{facts.join(" · ")}</p>}
        <span className="guide-card__more" aria-hidden="true">View profile →</span>
      </div>
    </article>
  );
}
