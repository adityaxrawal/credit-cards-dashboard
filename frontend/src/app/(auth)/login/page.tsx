import { Suspense } from "react";
import LoginForm from "@/features/auth/components/LoginForm";

/**
 * Login Page Content
 * Server-side component that renders the login form.
 * Note: We intentionally do NOT redirect authenticated users here.
 * The middleware handles all authentication redirects to avoid infinite loops
 * that can occur when users have an expired/invalid token cookie.
 */
function LoginPageContent() {
  console.log("[LoginPage] Server component rendering LoginPageContent");
  return <LoginForm />;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-primary-bg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-green mx-auto"></div>
            <p className="mt-4 text-secondary-text">Loading...</p>
          </div>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
