"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

// Support both env var names
const POSTHOG_KEY =
  process.env.NEXT_PUBLIC_POSTHOG_KEY ||
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

/**
 * PostHogPageView - Tracks page views on client-side navigation
 *
 * Next.js App Router uses client-side navigation which doesn't trigger
 * full page loads. This component captures pageviews on route changes.
 */
function PostHogPageViewInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthogClient = usePostHog();
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || !posthogClient) return;

    // Build the full URL
    const url = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;

    // Only capture if URL actually changed (avoid double-fires)
    if (url !== lastUrl.current) {
      lastUrl.current = url;
      posthogClient.capture("$pageview", {
        $current_url: window.origin + url,
      });
    }
  }, [pathname, searchParams, posthogClient]);

  return null;
}

// Wrap in Suspense to handle useSearchParams during SSR
function PostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PostHogPageViewInner />
    </Suspense>
  );
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Only initialize in production and if key is set
    if (
      typeof window !== "undefined" &&
      POSTHOG_KEY &&
      process.env.NODE_ENV === "production"
    ) {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        person_profiles: "identified_only",
        // Disable automatic pageview - we handle it manually for App Router
        capture_pageview: false,
        capture_pageleave: true,
        // Respect Do Not Track
        respect_dnt: true,
        // Disable in development
        loaded: (posthog) => {
          if (process.env.NODE_ENV === "development") {
            posthog.opt_out_capturing();
          }
        },
      });
    }
  }, []);

  // In development or without key, just render children
  if (
    typeof window === "undefined" ||
    !POSTHOG_KEY ||
    process.env.NODE_ENV !== "production"
  ) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}
