import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Next.js 16+ automatically supports instrumentation.ts
};

export default withSentryConfig(nextConfig, {
  // Sentry organization and project (set via env vars or directly)
  org: process.env.SENTRY_ORG ?? "parentbench",
  project: process.env.SENTRY_PROJECT ?? "javascript-nextjs",

  // Auth token for source map uploads
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload a larger set of source maps for better stack traces
  widenClientFileUpload: true,

  // Route to tunnel Sentry requests (bypasses ad-blockers)
  tunnelRoute: "/monitoring",

  // Only show upload logs in CI
  silent: !process.env.CI,
});
