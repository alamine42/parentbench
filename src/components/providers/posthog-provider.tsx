"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

// Initialize PostHog at module level (runs once when module loads on client)
if (typeof window !== "undefined") {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

  if (key && process.env.NODE_ENV === "production" && !posthog.__loaded) {
    posthog.init(key, {
      api_host: host,
      person_profiles: "identified_only",
      capture_pageview: false, // We handle manually for App Router
      capture_pageleave: true,
      respect_dnt: true,
      loaded: (ph) => {
        // Capture initial pageview after load
        ph.capture("$pageview");
      },
    });
  }
}

/**
 * PostHogPageView - Tracks page views on client-side navigation
 */
function PostHogPageViewInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;

    const url = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;

    // Skip initial pageview (handled by loaded callback)
    if (lastUrl.current === null) {
      lastUrl.current = url;
      return;
    }

    // Only capture if URL actually changed
    if (url !== lastUrl.current) {
      lastUrl.current = url;
      posthog.capture("$pageview", {
        $current_url: window.origin + url,
      });
    }
  }, [pathname, searchParams]);

  return null;
}

function PostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PostHogPageViewInner />
    </Suspense>
  );
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  // Always render PHProvider - posthog-js handles uninitialized state gracefully
  // The init happens at module level above, so by render time it's ready
  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}

