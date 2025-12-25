import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Suspense } from "react";
import LoginForm from "@/components/features/auth/LoginForm";

/**
 * Login Page Content
 * Server-side component that checks for existing authentication
 */
async function LoginPageContent() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;

  // If user has access token, redirect to dashboard
  // The dashboard layout will verify it properly
  if (accessToken) {
    redirect("/dashboard");
  }

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
