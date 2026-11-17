import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getPublishedPosts } from "@/lib/data/public";
import { PostCard } from "@/components/PostCard";
import { Pagination } from "@/components/Pagination";
import { parsePage, slicePage } from "@/lib/pagination";
import { TableSkeleton } from "@/components/Skeletons";

export const metadata: Metadata = {
  title: "Blog",
  description: "Notes from the trail: planning, altitude, seasons and stories from Pala Trekking and our guides.",
  alternates: { canonical: "/blog" },
};

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default function BlogPage({ searchParams }: PageProps<"/blog">) {
  return (
    <>
      <header className="page-head wrap">
        <ol className="crumbs"><li><Link href="/">Home</Link></li><li>Blog</li></ol>
        <h1 className="display display--lg">From the trail</h1>
        <p className="lede">Planning notes, altitude advice and stories from our guides.</p>
      </header>
      <section className="wrap" style={{ paddingBottom: "var(--sc-section)" }}>
        <Suspense fallback={<TableSkeleton rows={4} cols={2} label="Loading posts" />}>
          <List searchParams={searchParams as Promise<SP>} />
        </Suspense>
      </section>
    </>
  );
}

async function List({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tag = one(sp.tag);
  const posts = await getPublishedPosts();
  const tags = [...new Set(posts.flatMap((p) => p.tags))].sort();
  const shown = tag ? posts.filter((p) => p.tags.includes(tag)) : posts;
  const { items, p } = slicePage(shown, parsePage(sp.page), 9);
  return (
    <>
      {tags.length > 0 && (
        <nav className="tag-filter" aria-label="Filter posts by tag">
          <Link href="/blog" aria-current={!tag ? "page" : undefined}>All</Link>
          {tags.map((t) => <Link key={t} href={`/blog?tag=${encodeURIComponent(t)}`} aria-current={t === tag ? "page" : undefined}>{t}</Link>)}
        </nav>
      )}
      {items.length ? (
        <div className="post-grid">{items.map((post, i) => <PostCard key={post.id} post={post} priority={i < 2 && p.page === 1} />)}</div>
      ) : (
        <p className="empty">{tag ? `No posts tagged ${tag} yet.` : "No posts published yet."}</p>
      )}
      <Pagination p={p} path="/blog" params={sp} noun="posts" />
    </>
  );
}
