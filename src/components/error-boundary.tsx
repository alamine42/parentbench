"use client";

import React, { Component, type ReactNode } from "react";

// ============================================================================
// TYPES
// ============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ============================================================================
// ERROR BOUNDARY COMPONENT
// ============================================================================

/**
 * React Error Boundary for catching and handling runtime errors
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary fallback={<ErrorFallback />}>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 *
 * Or with render prop:
 * ```tsx
 * <ErrorBoundary
 *   fallback={(error, reset) => (
 *     <div>
 *       <p>Error: {error.message}</p>
 *       <button onClick={reset}>Try Again</button>
 *     </div>
 *   )}
 * >
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const { fallback } = this.props;

      // Render prop fallback
      if (typeof fallback === "function") {
        return fallback(this.state.error, this.handleReset);
      }

      // Component fallback
      if (fallback) {
        return fallback;
      }

      // Default fallback
      return (
        <DefaultErrorFallback
          error={this.state.error}
          reset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// DEFAULT FALLBACK
// ============================================================================

interface ErrorFallbackProps {
  error: Error;
  reset: () => void;
}

function DefaultErrorFallback({ error, reset }: ErrorFallbackProps) {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 mb-6 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-red-600 dark:text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Something went wrong
        </h2>

        {/* Message */}
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          We encountered an unexpected error. Please try again.
        </p>

        {/* Error details in development */}
        {isDev && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              Error details
            </summary>
            <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs text-red-600 dark:text-red-400 overflow-auto max-h-48">
              {error.message}
              {error.stack && (
                <>
                  {"\n\n"}
                  {error.stack}
                </>
              )}
            </pre>
          </details>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PAGE-LEVEL ERROR BOUNDARY
// ============================================================================

interface PageErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Full-page error boundary with centered error message
 */
export function PageErrorBoundary({ children }: PageErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <DefaultErrorFallback error={error} reset={reset} />
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

// ============================================================================
// CARD-LEVEL ERROR BOUNDARY
// ============================================================================

interface CardErrorBoundaryProps {
  children: ReactNode;
  title?: string;
}

/**
 * Inline error boundary for individual cards/sections
 */
export function CardErrorBoundary({
  children,
  title = "Component Error",
}: CardErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/10">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg
                className="w-5 h-5 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
                {title}
              </h4>
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {error.message}
              </p>
              <button
                onClick={reset}
                className="mt-2 text-sm font-medium text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200"
              >
                Try again →
              </button>
            </div>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

// ============================================================================
// SUSPENSE + ERROR BOUNDARY COMBO
// ============================================================================

import { Suspense } from "react";

interface AsyncBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  errorFallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
}

/**
 * Combined Suspense + ErrorBoundary for async components
 */
export function AsyncBoundary({
  children,
  fallback = <DefaultLoadingFallback />,
  errorFallback,
}: AsyncBoundaryProps) {
  return (
    <ErrorBoundary fallback={errorFallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  );
}

function DefaultLoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  );
}
