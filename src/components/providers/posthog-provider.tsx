"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Only initialize in production and if key is set
    if (
      typeof window !== "undefined" &&
      process.env.NEXT_PUBLIC_POSTHOG_KEY &&
      process.env.NODE_ENV === "production"
    ) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host:
          process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
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
    !process.env.NEXT_PUBLIC_POSTHOG_KEY ||
    process.env.NODE_ENV !== "production"
  ) {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
