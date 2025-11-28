"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";

/**
 * Root Page
 * Redirects to login if not authenticated, or to dashboard if authenticated
 */
export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // User is authenticated, redirect to dashboard
        router.push("/dashboard");
      } else {
        // User is not authenticated, redirect to login
        router.push("/login");
      }
    }
  }, [user, loading, router]);

  // Show loading state while checking authentication
  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-bg">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-green mx-auto"></div>
        <p className="mt-4 text-secondary-text">Loading...</p>
      </div>
    </div>
  );
}
