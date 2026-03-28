"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

/**
 * PostHogPageView - Tracks page views on client-side navigation
 */
function PostHogPageViewInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthogClient = usePostHog();
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || !posthogClient) return;

    const url = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;

    if (url !== lastUrl.current) {
      lastUrl.current = url;
      posthogClient.capture("$pageview", {
        $current_url: window.origin + url,
      });
    }
  }, [pathname, searchParams, posthogClient]);

  return null;
}

function PostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PostHogPageViewInner />
    </Suspense>
  );
}

// Debug: Check if env vars are bundled at build time
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

// Log at module level (will appear in server logs during build)
if (typeof window === "undefined") {
  console.log("[PostHog] Build-time check - KEY exists:", !!POSTHOG_KEY);
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Debug: Log what we see at runtime
    console.log("[PostHog] Runtime init - KEY:", POSTHOG_KEY ? "present" : "missing", "ENV:", process.env.NODE_ENV);

    if (POSTHOG_KEY && process.env.NODE_ENV === "production") {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        person_profiles: "identified_only",
        capture_pageview: false, // We handle manually for App Router
        capture_pageleave: true,
        respect_dnt: true,
      });
      setIsReady(true);
    }
  }, []);

  // Always render children - only wrap with PHProvider when ready
  if (!isReady) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}

