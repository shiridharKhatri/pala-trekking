import type { Metadata } from "next";
import { NotFoundView } from "@/components/NotFoundView";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

// Unmatched URLs anywhere in the app. Renders inside the root layout only, so
// the view brings its own slim header.
export default function NotFound() {
  return <main id="main"><NotFoundView standalone /></main>;
}
