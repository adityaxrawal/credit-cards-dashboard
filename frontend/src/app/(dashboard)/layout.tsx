import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { UserProvider } from "@/lib/auth/user-context";
import type { User } from "@/lib/auth/user-context";
import DashboardLayoutClient from "./DashboardLayoutClient";

/**
 * Fetch user data from API (server-side)
 * Uses httpOnly accessToken cookie from backend
 */
async function fetchUser(): Promise<User | null> {
  const cookieStore = await cookies();

  // Backend uses 'accessToken' cookie (httpOnly)
  const accessToken = cookieStore.get("accessToken")?.value;

  if (!accessToken) {
    return null;
  }

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const response = await fetch(`${apiUrl}/api/auth/me`, {
      headers: {
        Cookie: `accessToken=${accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Backend returns user object directly
    if (!data || !data.id || !data.email) {
      return null;
    }

    const apiUser = data;

    return {
      id: apiUser.id,
      email: apiUser.email,
      name: apiUser.name,
      gmailConnected: apiUser.gmailConnected || false,
      isAdmin: apiUser.isAdmin || false,
      profilePicture: apiUser.profilePicture,
      monthlyBudget: apiUser.monthlyBudget,
    };
  } catch (error) {
    console.error("Failed to fetch user:", error);
    return null;
  }
}

/**
 * Dashboard Layout (Server Component)
 * Verifies authentication and provides user context
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch user on server
  const user = await fetchUser();

  // If no user, redirect to login
  if (!user) {
    redirect("/login");
  }

  // Provide user context to children
  return (
    <UserProvider user={user}>
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </UserProvider>
  );
}
