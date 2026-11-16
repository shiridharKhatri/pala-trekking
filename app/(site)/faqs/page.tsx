import type { Metadata } from "next";
import Link from "next/link";
import { getFaqs } from "@/lib/data/public";

export const metadata: Metadata = { title: "FAQs", description: "Answers about booking requests, prices and currencies, route weather and departures.", alternates: { canonical: "/faqs" } };

export default async function FaqsPage() {
  const faqs = await getFaqs();
  const groups = [...new Set(faqs.map((f) => f.category))];
  const jsonLd = {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="page-head wrap">
        <ol className="crumbs"><li><Link href="/">Home</Link></li><li>FAQs</li></ol>
        <h1 className="display display--lg">Questions before you book</h1>
      </header>
      <section className="wrap" style={{ paddingBottom: "var(--sc-section)", display: "grid", gap: "var(--sc-7)" }}>
        {groups.map((g) => (
          <div key={g} className="trust" style={{ gridTemplateColumns: "minmax(0, 0.6fr) minmax(0, 1.4fr)" }}>
            <h2 className="display display--sm">{g}</h2>
            <ol>
              {faqs.filter((f) => f.category === g).map((f) => (
                <li key={f.id}><h3>{f.question}</h3><p>{f.answer}</p></li>
              ))}
            </ol>
          </div>
        ))}
        <p className="lede">Still unsure? <Link href="/contact">Contact us</Link>.</p>
      </section>
    </>
  );
}
