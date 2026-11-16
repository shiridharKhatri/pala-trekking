import { getSettings } from "@/lib/data/public";
import { CurrencyProvider } from "@/components/CurrencyProvider";
import { Suspense } from "react";
import { SiteHeader, SiteHeaderFallback } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Altimeter } from "@/components/Altimeter";
import { CompareTray } from "@/components/Compare";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const settings = await getSettings();
  return (
    <CurrencyProvider settings={settings.currency}>
      <a href="#main" className="skip-link">Skip to content</a>
      {settings.previewNotice && (
        <div className="preview-notice" role="note">
          Preview build: prices, departure dates, capacities and exchange rates are sample data, not real offers.
        </div>
      )}
      <Suspense fallback={<SiteHeaderFallback />}><SiteHeader /></Suspense>
      <Suspense><Altimeter /></Suspense>
      <div className="with-rail">
        <main id="main">{children}</main>
        <SiteFooter settings={settings} />
      </div>
      <Suspense><CompareTray /></Suspense>
    </CurrencyProvider>
  );
}
