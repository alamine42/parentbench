import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostBySlug, getPostSlugs, formatDate } from "@/lib/posts";
import { categoryLabels, type PostSection } from "@/types/post";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const slugs = getPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return { title: "Post not found" };
  }

  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.publishedAt,
      authors: [post.author],
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <header>
        <div className="flex items-center gap-3 text-sm">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${getCategoryStyles(post.category)}`}>
            {categoryLabels[post.category]}
          </span>
          <time dateTime={post.publishedAt} className="text-muted">
            {formatDate(post.publishedAt)}
          </time>
        </div>
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{post.title}</h1>
        <p className="mt-3 text-lg text-muted">{post.description}</p>
        <p className="mt-3 text-sm text-muted">By {post.author}</p>
      </header>

      <div className="mt-10 space-y-6">
        {post.content.map((section, index) => (
          <ContentSection key={index} section={section} />
        ))}
      </div>

      <div className="mt-12 flex items-center justify-between border-t border-card-border pt-8">
        <Link
          href="/news"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M12.78 4.22a.75.75 0 00-1.06 0L7.47 8.47a.75.75 0 000 1.06l4.25 4.25a.75.75 0 001.06-1.06L9.31 9.75H16a.75.75 0 000-1.5H9.31l3.47-3.47a.75.75 0 000-1.06z"
              clipRule="evenodd"
            />
          </svg>
          All posts
        </Link>
        <Link href="/leaderboard" className="text-sm font-medium text-muted hover:text-foreground">
          View leaderboard →
        </Link>
      </div>
    </article>
  );
}

function ContentSection({ section }: { section: PostSection }) {
  switch (section.type) {
    case "heading":
      return <h2 className="text-xl font-bold tracking-tight">{section.content}</h2>;
    case "paragraph":
      return <p className="text-muted leading-relaxed">{section.content}</p>;
    case "list":
      return (
        <ul className="space-y-2 text-muted">
          {section.items?.map((item, index) => (
            <li key={index} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "callout":
      return (
        <div className={`rounded-lg border p-4 ${getCalloutStyles(section.variant)}`}>
          <p className="text-sm">{section.content}</p>
        </div>
      );
    default:
      return null;
  }
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
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
  }
}

function getCalloutStyles(variant?: string): string {
  switch (variant) {
    case "warning":
      return "border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-200";
    case "success":
      return "border-green-300 bg-green-50 text-green-900 dark:border-green-700 dark:bg-green-900/20 dark:text-green-200";
    case "info":
    default:
      return "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-200";
  }
}
