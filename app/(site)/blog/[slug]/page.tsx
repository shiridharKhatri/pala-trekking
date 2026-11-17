import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getPostBySlug, getPublishedGuides, getPublishedPosts, getPublishedTreks, getRegions } from "@/lib/data/public";
import { RichText } from "@/components/RichText";
import { TrekCard } from "@/components/TrekCard";
import { PostCard } from "@/components/PostCard";
import { GuideAvatar } from "@/components/GuideCard";
import { date } from "@/lib/format";
import { DetailSkeleton } from "@/components/Skeletons";

export async function generateStaticParams() {
  return (await getPublishedPosts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPostBySlug(slug);
  if (!p) return { title: "Post not found" };
  return {
    title: p.title,
    description: p.seoDescription || p.excerpt,
    alternates: { canonical: `/blog/${p.slug}` },
    openGraph: { type: "article", title: p.title, description: p.seoDescription || p.excerpt, publishedTime: p.publishedAt ?? undefined, images: p.cover ? [{ url: p.cover.src, alt: p.cover.alt }] : [] },
  };
}

export default function PostPage({ params }: PageProps<"/blog/[slug]">) {
  return <Suspense fallback={<DetailSkeleton />}><Article params={params} /></Suspense>;
}

async function Article({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();
  const [guides, treks, regions, all] = await Promise.all([getPublishedGuides(), getPublishedTreks(), getRegions(), getPublishedPosts()]);
  const author = post.authorGuideId ? guides.find((g) => g.id === post.authorGuideId) ?? null : null;
  const related = treks.filter((t) => post.relatedTrekIds.includes(t.id));
  const more = all.filter((p) => p.id !== post.id && (p.tags.some((t) => post.tags.includes(t)) || p.relatedTrekIds.some((t) => post.relatedTrekIds.includes(t)))).slice(0, 3);
  const regionName = (id: string) => regions.find((r) => r.id === id)?.name;
  const jsonLd = {
    "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title, description: post.excerpt,
    datePublished: post.publishedAt ?? undefined, dateModified: post.updatedAt, image: post.cover ? [post.cover.src] : undefined,
    author: author ? { "@type": "Person", name: author.name } : { "@type": "Organization", name: "Pala Trekking" },
  };
  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="page-head wrap post-head">
        <ol className="crumbs"><li><Link href="/">Home</Link></li><li><Link href="/blog">Blog</Link></li><li>{post.title}</li></ol>
        <p className="label">
          {post.publishedAt && <time dateTime={post.publishedAt}>{date(post.publishedAt)}</time>}
          {post.tags.length > 0 && <> · {post.tags.map((t, i) => <span key={t}>{i > 0 && ", "}<Link href={`/blog?tag=${encodeURIComponent(t)}`}>{t}</Link></span>)}</>}
        </p>
        <h1 className="display display--lg">{post.title}</h1>
        <p className="lede">{post.excerpt}</p>
        {post.sample && <p className="notice-box">Sample post. Replace or edit it before launch.</p>}
      </header>
      {post.cover && (
        <div className="wrap post-cover">
          <Image src={post.cover.src} alt={post.cover.alt} width={1800} height={1000} sizes="(max-width: 1200px) 92vw, 72rem" quality={75} priority style={{ width: "100%", height: "auto" }} />
        </div>
      )}
      <section className="wrap post-body">
        <RichText text={post.body} />
        <aside className="post-author" aria-label="Author">
          {author ? (
            <>
              <GuideAvatar guide={author} size={56} />
              <div><p className="label" style={{ margin: 0 }}>Written by</p><Link href={`/guides/${author.slug}`}>{author.name}</Link><span className="label" style={{ display: "block" }}>{author.role}</span></div>
            </>
          ) : (
            <div><p className="label" style={{ margin: 0 }}>Written by</p><span>The Pala Trekking team</span></div>
          )}
        </aside>
      </section>
      {related.length > 0 && (
        <section className="wrap section--tight" aria-labelledby="related-treks">
          <h2 id="related-treks" className="display display--md">Treks in this story</h2>
          <div className="catalogue__grid" style={{ marginTop: "var(--sc-5)" }}>{related.map((t) => <TrekCard key={t.id} trek={t} regionName={regionName(t.regionId)} />)}</div>
        </section>
      )}
      {more.length > 0 && (
        <section className="wrap section--tight" aria-labelledby="more-posts" style={{ paddingBottom: "var(--sc-section)" }}>
          <h2 id="more-posts" className="display display--md">Keep reading</h2>
          <div className="post-grid" style={{ marginTop: "var(--sc-5)" }}>{more.map((p) => <PostCard key={p.id} post={p} />)}</div>
        </section>
      )}
    </article>
  );
}
