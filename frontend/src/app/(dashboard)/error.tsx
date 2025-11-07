"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Error component for dashboard routes
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console or error reporting service
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-bg p-4">
      <div className="max-w-md w-full">
        <div className="bg-card-bg rounded-lg p-8 border border-border text-center">
          {/* Error Icon */}
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          {/* Error Message */}
          <h2 className="text-xl font-semibold text-primary-text mb-2">
            Something went wrong
          </h2>
          <p className="text-secondary-text mb-6">
            {error.message || "An unexpected error occurred. Please try again."}
          </p>

          {/* Actions */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-4 py-2 bg-primary-green hover:bg-primary-green/90 text-white font-medium rounded-lg transition-colors"
            >
              Try Again
            </button>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-card-bg hover:bg-hover border border-border text-primary-text font-medium rounded-lg transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>

          {/* Error Details (for development) */}
          {process.env.NODE_ENV === "development" && (
            <details className="mt-6 text-left">
              <summary className="text-sm text-secondary-text cursor-pointer">
                Error Details
              </summary>
              <pre className="mt-2 p-4 bg-black/20 rounded text-xs overflow-auto">
                {error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
