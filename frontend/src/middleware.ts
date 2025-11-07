import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getRequiredSecurityLevel,
  getSecurityRedirectPath,
  getGmailConnectPath,
} from "@/lib/auth/security";
import type { SecurityLevel, UserSecurityContext } from "@/lib/auth/security";

/**
 * List of public paths that don't require authentication
 */
const PUBLIC_PATHS = [
  "/_next",
  "/api",
  "/favicon.ico",
  "/icon.png",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
];

/**
 * Check if path is public (static assets, API routes, etc.)
 */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

/**
 * Verify JWT token and get user context from backend
 */
async function verifyToken(
  token: string,
  apiUrl: string
): Promise<UserSecurityContext | null> {
  try {
    const response = await fetch(`${apiUrl}/api/auth/me`, {
      headers: {
        Cookie: `token=${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.success || !data.data?.user) {
      return null;
    }

    const user = data.data.user;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      gmailConnected: user.gmailConnected || false,
      isAdmin: user.isAdmin || false,
    };
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

/**
 * Check if user has required security level
 */
function checkSecurityLevel(
  userContext: UserSecurityContext | null,
  requiredLevel: SecurityLevel
): boolean {
  if (requiredLevel === "public") {
    return true;
  }

  if (!userContext) {
    return false;
  }

  switch (requiredLevel) {
    case "authenticated":
      return true;
    case "gmailConnected":
      return userContext.gmailConnected;
    case "admin":
      return userContext.isAdmin === true;
    default:
      return false;
  }
}

/**
 * Middleware to protect routes based on authentication and security levels
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths (static assets, API routes, etc.)
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Get required security level for this route
  const requiredLevel = getRequiredSecurityLevel(pathname);

  // Public routes don't need auth check
  if (requiredLevel === "public") {
    return NextResponse.next();
  }

  // Get JWT token from httpOnly cookie
  const token = request.cookies.get("token")?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  // No token - redirect to login
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/login") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Verify token and get user context
  const userContext = await verifyToken(token, apiUrl);

  // Invalid token - clear cookie and redirect to login
  if (!userContext) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("token");
    return response;
  }

  // Check if user has required security level
  const hasAccess = checkSecurityLevel(userContext, requiredLevel);

  if (!hasAccess) {
    // Redirect based on missing security level
    if (requiredLevel === "gmailConnected" && !userContext.gmailConnected) {
      // Need Gmail connection
      const connectUrl = new URL(getGmailConnectPath(pathname), request.url);
      return NextResponse.redirect(connectUrl);
    } else if (requiredLevel === "admin" && !userContext.isAdmin) {
      // Admin required but user is not admin - forbidden
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } else {
      // Generic auth failure - redirect to login
      const loginUrl = new URL(
        getSecurityRedirectPath(requiredLevel, pathname),
        request.url
      );
      return NextResponse.redirect(loginUrl);
    }
  }

  // User has access - continue
  return NextResponse.next();
}

/**
 * Middleware configuration
 * Specify which routes to run middleware on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icon.png, etc (favicon files)
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-touch-icon.png|manifest.webmanifest).*)",
  ],
};
