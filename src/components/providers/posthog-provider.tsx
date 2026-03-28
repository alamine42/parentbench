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

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Only initialize on client, in production, with API key
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const apiHost =
      process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

    if (apiKey && process.env.NODE_ENV === "production") {
      posthog.init(apiKey, {
        api_host: apiHost,
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
