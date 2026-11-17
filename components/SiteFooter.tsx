import Link from "next/link";
import type { SiteSettings } from "@/lib/types";

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  const c = settings.company;
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="site-footer__grid">
          <div>
            <p className="wordmark" style={{ marginBottom: "0.75rem" }}>Pala Trekking</p>
            {c.tagline && <p>{c.tagline}</p>}
            {c.address && <p>{c.address}</p>}
            {c.email && <p><a href={`mailto:${c.email}`}>{c.email}</a></p>}
            {c.phone && <p><a href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a></p>}
            {c.registration && <p className="mono">{c.registration}</p>}
          </div>
          <div>
            <h2>Treks</h2>
            <ul>
              <li><Link href="/treks">All treks</Link></li>
              <li><Link href="/gateways/kathmandu">From Kathmandu</Link></li>
              <li><Link href="/gateways/pokhara">From Pokhara</Link></li>
              <li><Link href="/compare">Compare treks</Link></li>
            </ul>
          </div>
          <div>
            <h2>Plan</h2>
            <ul>
              <li><Link href="/departures">Departure board</Link></li>
              <li><Link href="/experiences">Optional experiences</Link></li>
              <li><Link href="/faqs">FAQs</Link></li>
              <li><Link href="/guides">Our guides</Link></li>
              <li><Link href="/blog">Blog</Link></li>
              <li><Link href="/contact">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h2>Company</h2>
            <ul>
              <li><Link href="/about">About</Link></li>
              <li><Link href="/terms">Terms</Link></li>
              <li><Link href="/privacy">Privacy</Link></li>
              <li><Link href="/cancellation-policy">Cancellation policy</Link></li>
              <li><Link href="/credits">Photo credits</Link></li>
            </ul>
          </div>
        </div>
        <div className="site-footer__base">
          <span>Prices are set in {settings.currency.base}. Other currencies are estimates.</span>
          <span>{settings.weatherAttribution}</span>
        </div>
      </div>
    </footer>
  );
}
