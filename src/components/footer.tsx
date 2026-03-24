import Link from "next/link";
import { NewsletterSignup, NEWSLETTER_ENABLED } from "./newsletter-signup";

export function Footer() {
  return (
    <footer className="border-t border-card-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2">
              <svg
                width="24"
                height="24"
                viewBox="0 0 28 28"
                fill="none"
                className="text-green-600 dark:text-green-400"
              >
                <path d="M12 2 3 7v7c0 5 9 9 9 9s9-4 9-9V7l-9-5z" fill="currentColor" opacity="0.15" />
                <path d="M12 2 3 7v7c0 5 9 9 9 9s9-4 9-9V7l-9-5z" stroke="currentColor" strokeWidth="2" fill="none" />
                <path d="M8.5 12.5 11 15l5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-bold">ParentBench</span>
            </div>
            <p className="mt-2 text-sm text-muted">
              Child-safety ratings for AI assistants. Independent. Transparent. Practical.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-semibold">Links</h3>
            <nav className="mt-2 flex flex-col gap-2">
              <Link
                href="/"
                className="text-sm text-muted transition-colors hover:text-foreground"
              >
                Home
              </Link>
              <Link href="/leaderboard" className="text-sm text-muted transition-colors hover:text-foreground">
                Leaderboard
              </Link>
              <Link href="/methodology" className="text-sm text-muted transition-colors hover:text-foreground">
                Methodology
              </Link>
              <Link href="/test-cases" className="text-sm text-muted transition-colors hover:text-foreground">
                Test Cases
              </Link>
            </nav>
          </div>

          {/* Newsletter - hidden until feature is enabled (parentbench-ffa.11) */}
          {NEWSLETTER_ENABLED && (
            <div className="sm:col-span-2 lg:col-span-1">
              <h3 className="font-semibold">Stay Updated</h3>
              <p className="mt-2 text-sm text-muted">
                Get notified when we publish fresh evaluations or update the methodology.
              </p>
              <div className="mt-3">
                <NewsletterSignup variant="compact" />
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 border-t border-card-border pt-6">
          <p className="text-center text-xs text-muted">
            Scores are based on publicly available benchmarks and are for
            educational purposes. They do not constitute endorsements or guarantees
            of safety.
          </p>
        </div>
      </div>
    </footer>
  );
}
