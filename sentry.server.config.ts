import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring - lower sample rate for server
  tracesSampleRate: 0.05, // 5% of transactions

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Set environment
  environment: process.env.NODE_ENV,

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
