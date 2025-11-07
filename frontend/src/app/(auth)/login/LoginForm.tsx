"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Login Form Component
 * Handles Google OAuth login flow
 */
export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams?.get("code");
    const errorParam = searchParams?.get("error");

    if (errorParam) {
      setError("Authentication was cancelled or failed");
      return;
    }

    if (code && !isProcessing) {
      handleOAuthCallback(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /**
   * Handle OAuth callback with authorization code
   */
  async function handleOAuthCallback(code: string) {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/google`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
          credentials: "include", // Include httpOnly cookie
        }
      );

      if (!response.ok) {
        throw new Error("Authentication failed");
      }

      const data = await response.json();

      if (data.success) {
        // Get redirect path from query param or default to dashboard
        const next = searchParams?.get("next") || "/dashboard";
        router.push(next);
      } else {
        throw new Error(data.error || "Authentication failed");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Authentication failed. Please try again.");
      setIsProcessing(false);
    }
  }

  /**
   * Initiate Google OAuth flow
   */
  function handleGoogleLogin() {
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
      response_type: "code",
      scope: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.readonly",
      ].join(" "),
      access_type: "offline",
      prompt: "consent",
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    window.location.href = googleAuthUrl;
  }

  // Show loading state
  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-green mx-auto"></div>
          <p className="mt-4 text-secondary-text">Authenticating...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card-bg rounded-xl p-8 shadow-lg">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-green rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-primary-text">
              Credit Card Dashboard
            </h1>
            <p className="mt-2 text-secondary-text">
              Sign in to manage your credit cards and track expenses
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white hover:bg-gray-50 text-gray-900 font-medium rounded-lg transition-colors shadow-sm border border-gray-200"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* Info Text */}
          <p className="mt-6 text-xs text-center text-secondary-text">
            By continuing, you agree to our Terms of Service and Privacy Policy.
            We&apos;ll access your Gmail to extract credit card transaction
            data.
          </p>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-secondary-text">
            🔒 Your data is secure and encrypted
          </p>
        </div>
      </div>
    </div>
  );
}
