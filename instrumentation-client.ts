import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of transactions for performance monitoring in prod, 100% in dev
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Session Replay: capture 10% of sessions, 100% when errors occur
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Enable structured logging
  enableLogs: true,

  // Integrations
  integrations: [
    Sentry.replayIntegration(),
  ],

  // Filter out common non-actionable errors
  ignoreErrors: [
    // Browser extensions
    /extensions\//i,
    /^chrome:\/\//i,
    // Network errors users can't control
    "Network request failed",
    "Failed to fetch",
    "Load failed",
    // Next.js navigation (not actual errors)
    "NEXT_REDIRECT",
  ],

  // Redact PII from error messages
  beforeSend(event) {
    if (event.exception?.values) {
      event.exception.values.forEach((exception) => {
        if (exception.value) {
          // Redact email addresses
          exception.value = exception.value.replace(
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
            "[REDACTED_EMAIL]"
          );
        }
      });
    }
    return event;
  },
});

// Export for Next.js App Router navigation tracking
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
