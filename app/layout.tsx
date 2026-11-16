import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "@/vendor/scrollcraft/scrollcraft.css";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono", display: "swap" });

const SITE = process.env.SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Pala Trekking | Treks in Nepal from Kathmandu and Pokhara", template: "%s | Pala Trekking" },
  description: "Compare and book treks in Nepal from Kathmandu and Pokhara, with day-by-day itineraries, altitude, weather at each overnight stop and live departures.",
  openGraph: { type: "website", siteName: "Pala Trekking", locale: "en_GB" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#0d1114", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexMono.variable}`}>
      <head>
        {/* Without JavaScript, scroll-driven content must still be visible. */}
        <noscript>
          <style>{`[data-sc-cue],[data-sc-in],[data-sc-stagger]>*{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body>{children}</body>
    </html>
  );
}
