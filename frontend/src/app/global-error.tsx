"use client";

import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global error page for critical errors that crash the entire app
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  React.useEffect(() => {
    // Log the error to error reporting service
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body className="bg-[#1A1D21] text-white">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-[#25282E] rounded-lg p-8 max-w-lg w-full text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-red-500/10 p-4 rounded-full">
                <AlertTriangle className="w-12 h-12 text-red-500" />
              </div>
            </div>

            <h1 className="text-3xl font-bold text-white mb-4">
              Critical Error
            </h1>

            <p className="text-gray-400 mb-6 leading-relaxed">
              A critical error has occurred that prevented the application from
              loading properly. Please refresh the page or contact support if
              the issue persists.
            </p>

            {process.env.NODE_ENV === "development" && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 text-left">
                <h3 className="text-red-400 font-semibold mb-2">
                  Error Details:
                </h3>
                <pre className="text-sm text-red-300 whitespace-pre-wrap">
                  {error.message}
                </pre>
                {error.digest && (
                  <p className="text-xs text-red-200 mt-2">
                    Error ID: {error.digest}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <Button onClick={reset} className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>

              <Link href="/">
                <Button variant="secondary" className="flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  Go Home
                </Button>
              </Link>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-700">
              <p className="text-gray-500 text-sm">
                Error Code: {error.digest || "UNKNOWN"}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                Time: {new Date().toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
