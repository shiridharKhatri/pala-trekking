import Image from "next/image";
import Link from "next/link";
import type { Post } from "@/lib/types";
import { date } from "@/lib/format";

export function PostCard({ post, priority = false }: { post: Post; priority?: boolean }) {
  return (
    <article className="post-card">
      {post.cover && (
        <div className="post-card__media">
          <Image src={post.cover.src} alt={post.cover.alt} fill sizes="(max-width: 700px) 92vw, 26rem" quality={70} priority={priority} style={{ objectFit: "cover" }} />
        </div>
      )}
      <div className="post-card__body">
        <p className="label" style={{ margin: 0 }}>
          {post.publishedAt && <time dateTime={post.publishedAt}>{date(post.publishedAt)}</time>}
          {post.tags.length > 0 && <> · {post.tags.slice(0, 2).join(", ")}</>}
        </p>
        <h3 className="post-card__title"><Link href={`/blog/${post.slug}`}>{post.title}</Link></h3>
        <p className="post-card__excerpt">{post.excerpt}</p>
      </div>
    </article>
  );
}
