import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 0.1, // 10% of transactions for performance monitoring

  // Session Replay - capture 1% of sessions, 100% on error
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Set environment
  environment: process.env.NODE_ENV,

  // Ignore common non-actionable errors
  ignoreErrors: [
    // Browser extensions
    /extensions\//i,
    /^chrome:\/\//i,
    // Network errors that users can't control
    "Network request failed",
    "Failed to fetch",
    "Load failed",
    // Next.js navigation (not actual errors)
    "NEXT_REDIRECT",
  ],

  // Before sending, filter out sensitive data
  beforeSend(event) {
    // Remove any potential PII from error messages
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
