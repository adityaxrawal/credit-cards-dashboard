import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Suspense } from "react";
import LoginForm from "./LoginForm";

async function LoginPageContent() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (token) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${apiUrl}/api/auth/me`, {
        headers: {
          Cookie: `token=${token}`,
        },
        cache: "no-store",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.user) {
          redirect("/dashboard");
        }
      }
    } catch (error) {
      console.error("Auth verification failed:", error);
    }
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
