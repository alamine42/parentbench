import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // instrumentation.ts is automatically enabled in Next.js 16+
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Only upload source maps in production builds
  silent: true,

  // Organization and project are set via env vars:
  // SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Upload a larger set of source maps for better stack traces
  widenClientFileUpload: true,
};

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
