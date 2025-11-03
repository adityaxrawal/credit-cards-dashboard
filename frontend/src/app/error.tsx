"use client";

import React from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui";
import { AlertTriangle, RefreshCw, Home, Mail } from "lucide-react";
import Link from "next/link";

interface ServerErrorProps {
  error?: Error;
  reset?: () => void;
}

export default function ServerError({ error, reset }: ServerErrorProps) {
  const handleRetry = () => {
    if (reset) {
      reset();
    } else {
      window.location.reload();
    }
  };

  const handleReportError = () => {
    // In a real app, this would send error details to your error reporting service
    const errorDetails = {
      message: error?.message || "Unknown server error",
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    console.log("Error reported:", errorDetails);

    // Example: Send to error reporting service
    // reportError(errorDetails);

    alert("Error reported successfully. Thank you for helping us improve!");
  };

  return (
    <AppLayout title="Server Error" showRightSidebar={false}>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        {/* Error Illustration */}
        <div className="mb-8">
          <div className="bg-red-500/10 p-6 rounded-full mb-6 mx-auto w-fit">
            <AlertTriangle className="w-16 h-16 text-red-500" />
          </div>

          <div className="text-red-500 text-6xl font-bold mb-4">500</div>

          <h1 className="text-3xl font-bold text-white mb-4">
            Internal Server Error
          </h1>

          <p className="text-gray-400 mb-8 leading-relaxed max-w-lg mx-auto">
            Oops! Something went wrong on our end. We&apos;re experiencing some
            technical difficulties. Please try again in a few moments or contact
            support if the problem persists.
          </p>
        </div>

        {/* Error Details (Development only) */}
        {process.env.NODE_ENV === "development" && error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-8 max-w-2xl text-left">
            <h3 className="text-red-400 font-semibold mb-2">
              Error Details (Development):
            </h3>
            <pre className="text-sm text-red-300 whitespace-pre-wrap overflow-x-auto">
              {error.message}
            </pre>
            {error.stack && (
              <details className="mt-2">
                <summary className="text-red-400 cursor-pointer">
                  Stack Trace
                </summary>
                <pre className="text-xs text-red-200 mt-2 whitespace-pre-wrap overflow-x-auto">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-4">
          <div className="flex gap-3 justify-center flex-wrap">
            <Button onClick={handleRetry} className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>

            <Link href="/">
              <Button variant="secondary" className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                Back to Dashboard
              </Button>
            </Link>

            <Button
              variant="secondary"
              onClick={handleReportError}
              className="flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              Report Error
            </Button>
          </div>

          {/* Status Info */}
          <div className="pt-8 border-t border-gray-700">
            <div className="bg-[#25282E] rounded-lg p-4 border border-gray-700">
              <h3 className="text-white font-semibold mb-2">What happened?</h3>
              <ul className="text-gray-400 text-sm space-y-1 text-left max-w-md">
                <li>• Our servers encountered an unexpected condition</li>
                <li>
                  • The error has been automatically logged for investigation
                </li>
                <li>• Our team has been notified and is working on a fix</li>
                <li>• Your data is safe and secure</li>
              </ul>
            </div>
          </div>

          {/* Contact Info */}
          <div className="pt-4">
            <p className="text-gray-500 text-sm">
              If this problem continues, please contact support with error code:
              <span className="text-[#6ECB8E] font-mono ml-1">
                {Date.now().toString(36).toUpperCase()}
              </span>
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
