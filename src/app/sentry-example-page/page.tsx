"use client";

import * as Sentry from "@sentry/nextjs";
import { useState } from "react";

export default function SentryExamplePage() {
  const [apiStatus, setApiStatus] = useState<string | null>(null);

  const testServerError = async () => {
    setApiStatus("Calling API...");
    try {
      await fetch("/api/sentry-example-api");
      setApiStatus("API called (error should appear in Sentry)");
    } catch (e) {
      setApiStatus("API error triggered (check Sentry)");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8 max-w-lg">
        <h1 className="text-2xl font-bold text-foreground">Sentry Test Page</h1>
        <p className="text-muted">
          Use these buttons to verify Sentry is capturing errors correctly.
        </p>

        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-foreground mb-2">Client-Side Errors</h2>
            <div className="space-x-4">
              <button
                onClick={() => {
                  throw new Error("Sentry Test: Client-side error from ParentBench");
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Throw Error
              </button>
              <button
                onClick={() => {
                  Sentry.captureMessage("Sentry Test: Manual message from ParentBench");
                  alert("Test message sent to Sentry!");
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Send Message
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-medium text-foreground mb-2">Server-Side Errors</h2>
            <button
              onClick={testServerError}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
            >
              Trigger API Error
            </button>
            {apiStatus && (
              <p className="text-sm text-muted mt-2">{apiStatus}</p>
            )}
          </div>
        </div>

        <p className="text-sm text-muted mt-8 border-t border-card-border pt-4">
          After clicking, check your{" "}
          <a
            href="https://sentry.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Sentry dashboard
          </a>{" "}
          for the error/message.
        </p>
      </div>
    </div>
  );
}
