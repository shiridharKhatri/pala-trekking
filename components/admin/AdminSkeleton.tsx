// Admin loading states. Skeletons mirror the real layout (sidebar, header,
// stat tiles, chart cards, table) so content replaces them without a jump.
// Purely presentational: no JavaScript, shimmer stops under reduced motion.

function Bar({ w, h = 12, r = 4 }: { w: string; h?: number; r?: number }) {
  return <span className="a-skel" style={{ width: w, height: h, borderRadius: r }} />;
}

export function AdminMainSkeleton({ variant = "dashboard" }: { variant?: "dashboard" | "list" }) {
  return (
    <div className="a-skelpage" role="status" aria-live="polite" aria-busy="true">
      <span className="vh">Loading…</span>
      <div className="a-loadbar" aria-hidden="true" />
      <div className="a-skelhead" aria-hidden="true">
        <div><Bar w="11rem" h={26} r={6} /><Bar w="16rem" /></div>
        <Bar w="14rem" h={36} r={6} />
      </div>
      <div className="a-statstrip" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="a-card a-skelcard">
            <Bar w="45%" h={10} />
            <Bar w="60%" h={28} r={6} />
            <Bar w="35%" h={10} />
          </div>
        ))}
      </div>
      {variant === "dashboard" ? (
        <div className="a-grid12" aria-hidden="true">
          <div className="a-span-8"><div className="a-card a-skelcard a-skelchart"><Bar w="12rem" h={14} /><Bar w="8rem" h={10} /><span className="a-skel a-skelplot" /></div></div>
          <div className="a-span-4"><div className="a-card a-skelcard a-skelchart"><Bar w="10rem" h={14} /><span className="a-skel a-skelring" /><Bar w="70%" /><Bar w="60%" /><Bar w="65%" /></div></div>
        </div>
      ) : null}
      <div className="a-card a-skelcard" aria-hidden="true">
        {Array.from({ length: variant === "dashboard" ? 5 : 9 }, (_, i) => (
          <div key={i} className="a-skelrow"><Bar w="7rem" /><Bar w="9rem" /><Bar w="12rem" /><Bar w="5rem" /><Bar w="4.5rem" h={18} /></div>
        ))}
      </div>
    </div>
  );
}

/** First load: the whole shell (the session is checked before anything renders). */
export function AdminShellSkeleton() {
  return (
    <div className="a-shell">
      <aside className="a-side" aria-hidden="true">
        <span className="a-brand">Pala Trekking</span>
        <div className="a-skelnav">
          {[5, 5, 4].map((n, g) => (
            <div key={g}>
              <span className="a-skel a-skel--dark" style={{ width: "4.5rem", height: 9 }} />
              {Array.from({ length: n }, (_, i) => <span key={i} className="a-skel a-skel--dark" style={{ width: `${60 + ((i * 17 + g * 11) % 30)}%`, height: 12 }} />)}
            </div>
          ))}
        </div>
      </aside>
      <main className="a-main"><AdminMainSkeleton /></main>
    </div>
  );
}
