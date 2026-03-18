"use client";

import { useState } from "react";

type NewsletterSignupProps = {
  variant?: "full" | "compact";
};

export function NewsletterSignup({ variant = "full" }: NewsletterSignupProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    try {
      const formData = new FormData();
      formData.append("form-name", "newsletter");
      formData.append("email", email);

      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(formData as unknown as Record<string, string>).toString(),
      });

      if (response.ok) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className={variant === "full" ? "rounded-2xl border border-green-200 bg-green-50 p-8 text-center dark:border-green-800 dark:bg-green-900/20" : "text-center"}>
        <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor" className="text-green-600 dark:text-green-400">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-green-800 dark:text-green-300">You&apos;re subscribed!</h3>
        <p className="mt-1 text-green-700 dark:text-green-400">We&apos;ll notify you when we evaluate new models.</p>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row" data-netlify="true" name="newsletter">
        <input type="hidden" name="form-name" value="newsletter" />
        <input
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="flex-1 rounded-lg border border-card-border bg-background px-4 py-2 text-sm placeholder:text-muted focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          {status === "loading" ? "..." : "Subscribe"}
        </button>
        {status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400">Something went wrong. Please try again.</p>
        )}
      </form>
    );
  }

  return (
    <div className="rounded-2xl border border-card-border bg-gradient-to-br from-green-50/50 to-background p-8 dark:from-green-950/20">
      {/* Hidden form for Netlify detection */}
      <form name="newsletter" data-netlify="true" hidden>
        <input type="email" name="email" />
      </form>

      <div className="mx-auto max-w-xl text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold">Stay Updated</h2>
        <p className="mt-2 text-muted">
          Get notified when we evaluate new AI models or update our methodology.
          No spam, just safety insights.
        </p>

        <form onSubmit={handleSubmit} className="mt-6" data-netlify="true" name="newsletter">
          <input type="hidden" name="form-name" value="newsletter" />
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              className="flex-1 rounded-lg border border-card-border bg-background px-4 py-3 placeholder:text-muted focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="rounded-lg bg-green-600 px-6 py-3 font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              {status === "loading" ? "Subscribing..." : "Subscribe"}
            </button>
          </div>
          {status === "error" && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              Something went wrong. Please try again.
            </p>
          )}
        </form>

        <p className="mt-4 text-xs text-muted">
          We respect your privacy. Unsubscribe anytime.
        </p>
      </div>
    </div>
  );
}
