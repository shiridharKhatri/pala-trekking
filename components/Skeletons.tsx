// Public-site loading states. Each skeleton has the shape of the content it
// stands in for, so nothing jumps when the real page arrives. Server
// components, no JavaScript; motion stops under prefers-reduced-motion.

function S({ w, h = 14, r, className = "" }: { w: string; h?: number | string; r?: number; className?: string }) {
  return <span className={`skel ${className}`} style={{ width: w, height: h, borderRadius: r }} />;
}

function Status({ label }: { label: string }) {
  return <span className="vh" role="status">{label}</span>;
}

/** Brand loader: a Himalayan ridgeline that draws itself, left to right. */
export function RidgeLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="ridge-loader" role="status" aria-live="polite">
      <svg viewBox="0 0 160 48" aria-hidden="true" focusable="false">
        <path className="ridge-loader__line" pathLength={1} d="M2 44 L22 30 L31 34 L47 16 L56 22 L70 6 L84 24 L94 18 L108 32 L120 26 L134 36 L146 31 L158 44" />
        <circle className="ridge-loader__dot" cx="70" cy="6" r="3" />
      </svg>
      <span>{label}</span>
    </div>
  );
}

export function PageHeadSkeleton() {
  return (
    <header className="page-head wrap skel-head" aria-hidden="true">
      <S w="11rem" h={10} />
      <S w="min(34rem, 80%)" h="clamp(2.4rem, 5vw, 4rem)" r={6} />
      <S w="min(28rem, 70%)" h={16} />
    </header>
  );
}

export function TrekCardSkeleton() {
  return (
    <div className="trek-card skel-card" aria-hidden="true">
      <S w="100%" h="auto" className="skel-media" r={0} />
      <div className="trek-card__body">
        <S w="70%" h={20} />
        <S w="35%" h={10} />
        <div className="skel-facts"><S w="3rem" h={26} /><S w="4.5rem" h={26} /><S w="4rem" h={26} /></div>
        <S w="95%" h={12} /><S w="80%" h={12} />
        <div className="skel-foot"><S w="7rem" h={20} /><S w="5.5rem" h={36} r={4} /></div>
      </div>
    </div>
  );
}

export function CatalogueSkeleton() {
  return (
    <div className="catalogue">
      <Status label="Loading treks" />
      <div className="filters skel-filters" aria-hidden="true">
        <S w="100%" h={46} r={4} />
        {[3, 4, 3].map((n, i) => (
          <div key={i} className="skel-stack"><S w="5rem" h={12} /><div className="skel-chips">{Array.from({ length: n }, (_, j) => <S key={j} w={`${3.5 + ((i + j) % 3)}rem`} h={36} r={3} />)}</div></div>
        ))}
      </div>
      <div>
        <S w="7rem" h={12} className="skel-gap" />
        <div className="catalogue__grid">{Array.from({ length: 6 }, (_, i) => <TrekCardSkeleton key={i} />)}</div>
      </div>
    </div>
  );
}

export function BoardSkeleton({ rows = 6, filters = true }: { rows?: number; filters?: boolean }) {
  return (
    <div>
      <Status label="Loading departures" />
      {filters && (
        <div className="grid-2 skel-gap" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))" }} aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="skel-stack"><S w="4rem" h={12} /><S w="100%" h={46} r={4} /></div>)}
        </div>
      )}
      <div className="skel-board" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skel-board__row">
            <div className="skel-stack"><S w={`${9 + (i % 3) * 2}rem`} h={16} /><S w="8rem" h={10} /></div>
            <S w="10rem" h={14} /><S w="6rem" h={14} /><S w="6.5rem" h={14} /><S w="4.5rem" h={14} /><S w="8rem" h={36} r={4} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 3, label = "Loading" }: { rows?: number; cols?: number; label?: string }) {
  return (
    <div className="skel-table">
      <Status label={label} />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skel-table__row" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} aria-hidden="true">
          {Array.from({ length: cols }, (_, j) => <S key={j} w={`${55 + ((i * 7 + j * 13) % 40)}%`} h={14} />)}
        </div>
      ))}
    </div>
  );
}

export function CompareSkeleton() {
  return (
    <div className="skel-stack" style={{ gap: "var(--sc-6)" }}>
      <Status label="Loading comparison" />
      <div className="notice-box skel-stack" aria-hidden="true"><S w="14rem" h={14} /><div className="skel-chips">{Array.from({ length: 4 }, (_, i) => <S key={i} w="11rem" h={36} r={3} />)}</div></div>
      <div className="skel-compare" aria-hidden="true">
        <span />{Array.from({ length: 3 }, (_, i) => <div key={i} className="skel-stack"><S w="100%" h="auto" className="skel-media" r={4} /><S w="70%" h={18} /></div>)}
      </div>
      <TableSkeleton rows={7} cols={4} />
    </div>
  );
}

export function BookingSkeleton() {
  return (
    <>
      <PageHeadSkeleton />
      <section className="wrap" style={{ paddingBottom: "var(--sc-section)" }}>
        <Status label="Loading booking form" />
        <div className="booking" aria-hidden="true">
          <div className="booking__steps">
            {["When", "Optional experiences", "Your details"].map((t, i) => (
              <div key={t} className="skel-stack" style={{ gap: "var(--sc-4)" }}>
                <S w="12rem" h={24} r={4} />
                {Array.from({ length: i === 2 ? 2 : 3 }, (_, j) => <S key={j} w="100%" h={i === 1 ? 110 : 72} r={4} />)}
              </div>
            ))}
          </div>
          <div className="summary skel-stack"><S w="6rem" h={10} /><S w="80%" h={20} /><S w="100%" h={12} /><S w="100%" h={12} /><S w="60%" h={28} /></div>
        </div>
      </section>
    </>
  );
}

/** Trek / gateway hero while the page streams: dark ground, ridge drawing in. */
export function HeroSkeleton({ height = "92svh" }: { height?: string }) {
  return (
    <section className="trek-hero skel-hero" style={{ height }}>
      <div className="skel-hero__ridge"><RidgeLoader label="Loading the route" /></div>
      <div className="trek-hero__copy" aria-hidden="true">
        <S w="16rem" h={10} className="skel--light" />
        <S w="min(40rem, 85%)" h="clamp(2.6rem, 6vw, 5.5rem)" r={8} className="skel--light" />
        <S w="min(30rem, 70%)" h={16} className="skel--light" />
      </div>
    </section>
  );
}

export function DetailSkeleton() {
  return (
    <>
      <PageHeadSkeleton />
      <section className="wrap" style={{ paddingBottom: "var(--sc-section)" }}>
        <Status label="Loading" />
        <div className="detail-grid" aria-hidden="true">
          <div className="skel-stack" style={{ gap: "var(--sc-5)" }}>
            <S w="100%" h="auto" className="skel-media skel-media--wide" r={6} />
            {Array.from({ length: 5 }, (_, i) => <S key={i} w={`${90 - (i % 3) * 12}%`} h={14} />)}
          </div>
          <div className="book-panel skel-stack"><S w="7rem" h={10} /><S w="9rem" h={34} /><S w="100%" h={46} r={4} /></div>
        </div>
      </section>
    </>
  );
}
