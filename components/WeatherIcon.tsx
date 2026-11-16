import type { WeatherIcon as Kind } from "@/lib/weather-codes";

// Drawn line icons (no emoji), sized by CSS, coloured by currentColor.
// Optional x/y/size place it inside another SVG (the elevation profile).
export function WeatherIcon({ kind, label, className = "wx__icon", x, y, size }: { kind: Kind; label: string; className?: string; x?: number; y?: number; size?: number }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const cloud = <path {...s} d="M9 25h15a5 5 0 0 0 .6-9.97A7 7 0 0 0 11.2 13.3 6 6 0 0 0 9 25z" />;
  return (
    <svg className={className} viewBox="0 0 34 34" role="img" aria-label={label} x={x} y={y} width={size} height={size}>
      {kind === "clear" && (<g {...s}><circle cx="17" cy="17" r="5.5" />{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (<line key={a} x1="17" y1="5" x2="17" y2="8" transform={`rotate(${a} 17 17)`} />))}</g>)}
      {kind === "partly" && (<g><g {...s}><circle cx="12" cy="12" r="4" /><line x1="12" y1="4" x2="12" y2="5.5" /><line x1="4" y1="12" x2="5.5" y2="12" /><line x1="6.3" y1="6.3" x2="7.4" y2="7.4" /></g>{cloud}</g>)}
      {kind === "cloud" && cloud}
      {kind === "fog" && (<g {...s}><line x1="7" y1="13" x2="27" y2="13" /><line x1="5" y1="18" x2="25" y2="18" /><line x1="9" y1="23" x2="29" y2="23" /></g>)}
      {kind === "rain" && (<g>{cloud}<g {...s}><line x1="12" y1="28" x2="11" y2="31" /><line x1="17" y1="28" x2="16" y2="31" /><line x1="22" y1="28" x2="21" y2="31" /></g></g>)}
      {kind === "snow" && (<g>{cloud}<g fill="currentColor"><circle cx="12" cy="29.5" r="1.1" /><circle cx="17" cy="31" r="1.1" /><circle cx="22" cy="29.5" r="1.1" /></g></g>)}
      {kind === "storm" && (<g>{cloud}<path {...s} d="M17 26l-2.5 4h4L16 33" /></g>)}
    </svg>
  );
}
