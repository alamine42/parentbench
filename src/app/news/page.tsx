import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts, formatDate } from "@/lib/posts";
import { categoryLabels } from "@/types/post";

export const metadata: Metadata = {
  title: "News",
  description: "ParentBench changelog and announcements.",
};

export default function NewsPage() {
  const posts = getAllPosts();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">ParentBench news</h1>
      <p className="mt-4 text-lg text-muted">Feature launches, methodology updates, and partner announcements.</p>

      <div className="mt-12 space-y-8">
        {posts.length === 0 ? (
          <p className="text-muted">No posts yet. Check back soon!</p>
        ) : (
          posts.map((post) => (
            <article
              key={post.slug}
              className="group rounded-xl border border-card-border bg-card-bg p-6 transition hover:border-blue-500/50 dark:hover:border-blue-400/40"
            >
              <div className="flex items-center gap-3 text-sm">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${getCategoryStyles(post.category)}`}>
                  {categoryLabels[post.category]}
                </span>
                <time dateTime={post.publishedAt} className="text-muted">
                  {formatDate(post.publishedAt)}
                </time>
              </div>
              <Link href={`/news/${post.slug}`} className="mt-3 block">
                <h2 className="text-xl font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400">{post.title}</h2>
              </Link>
              <p className="mt-2 text-muted">{post.description}</p>
              <div className="mt-4 flex items-center justify-between text-sm text-muted">
                <span>By {post.author}</span>
                <Link href={`/news/${post.slug}`} className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">
                  Read more →
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function getCategoryStyles(category: string): string {
  switch (category) {
    case "evaluation":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "methodology":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    case "announcement":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  }
}
