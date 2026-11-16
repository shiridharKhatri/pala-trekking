import Link from "next/link";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/data/public";
import { RichText } from "./RichText";
import { dateTime } from "@/lib/format";

export async function ContentPageView({ slug }: { slug: string }) {
  const page = await getPage(slug);
  if (!page) notFound();
  return (
    <>
      <header className="page-head wrap">
        <ol className="crumbs"><li><Link href="/">Home</Link></li><li>{page.title}</li></ol>
        <h1 className="display display--lg">{page.title}</h1>
        {page.draft && <p className="chip" style={{ marginTop: "1rem" }}>Draft content, pending client review</p>}
      </header>
      <section className="wrap" style={{ paddingBottom: "var(--sc-section)" }}>
        <RichText text={page.body} />
        <p className="label" style={{ marginTop: "var(--sc-7)" }}>Last updated {dateTime(page.updatedAt)}</p>
      </section>
    </>
  );
}

export async function contentMetadata(slug: string) {
  const page = await getPage(slug);
  return page ? { title: page.title, description: page.seoDescription, alternates: { canonical: `/${slug}` } } : {};
}
