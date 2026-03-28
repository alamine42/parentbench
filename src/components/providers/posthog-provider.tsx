"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

// Support both env var names
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

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
        capture_pageview: true,
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

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
