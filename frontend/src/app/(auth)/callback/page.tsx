"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";

/**
 * OAuth Callback Page Content
 * Handles Google OAuth callback and completes authentication
 */
function CallbackPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get("code");
        const error = searchParams.get("error");
        const returnUrl = searchParams.get("state") || "/";

        if (error) {
          setStatus("error");
          setError("Authentication was cancelled or failed");
          return;
        }

        if (!code) {
          setStatus("error");
          setError("No authorization code received");
          return;
        }

        // Exchange code for tokens via backend
        await login(code);

        setStatus("success");

        // Redirect after a brief success message
        setTimeout(() => {
          router.push(decodeURIComponent(returnUrl));
        }, 1500);
      } catch (err) {
        console.error("OAuth callback error:", err);
        setStatus("error");
        setError(err instanceof Error ? err.message : "Authentication failed");
      }
    };

    handleCallback();
  }, [searchParams, login, router]);

  const handleRetry = () => {
    router.push("/login");
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center">
        <div className="bg-card-bg rounded-xl p-8 shadow-lg max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-primary-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-green"></div>
          </div>
          <h1 className="text-xl font-semibold text-primary-text mb-2">
            Completing Authentication
          </h1>
          <p className="text-secondary-text">
            Please wait while we sign you in...
          </p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center">
        <div className="bg-card-bg rounded-xl p-8 shadow-lg max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-success"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-primary-text mb-2">
            Authentication Successful!
          </h1>
          <p className="text-secondary-text">
            Redirecting you to your dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center">
        <div className="bg-card-bg rounded-xl p-8 shadow-lg max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-error"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-primary-text mb-2">
            Authentication Failed
          </h1>
          <p className="text-error mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full bg-primary-green hover:bg-primary-green/90 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push("/")}
              className="w-full bg-hover-bg hover:bg-hover-bg/80 text-secondary-text px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Go to Homepage
            </button>
          </div>
          <div className="mt-6 pt-6 border-t border-muted-text/20">
            <p className="text-xs text-muted-text">
              Need help?{" "}
              <a
                href="mailto:support@example.com"
                className="text-primary-green hover:underline"
              >
                Contact Support
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * OAuth Callback Page with Suspense wrapper
 * Handles the OAuth callback flow from Google
 */
export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-primary-bg flex items-center justify-center">
          <div className="text-secondary-text">Loading...</div>
        </div>
      }
    >
      <CallbackPageContent />
    </Suspense>
  );
}
