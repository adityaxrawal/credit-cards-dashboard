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
  accessToken: string,
  apiUrl: string
): Promise<UserSecurityContext | null> {
  try {
    console.log(`[Middleware] Verifying token against: ${apiUrl}/api/auth/me`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(`${apiUrl}/api/auth/me`, {
      headers: {
        Cookie: `accessToken=${accessToken}`,
      },
      cache: "no-store",
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      console.error(`[Middleware] Token verification failed with status: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Backend returns the user object directly, not wrapped in { success: true, data: { user: ... } }
    // Check if we have a valid user object (has id and email)
    if (!data || !data.id || !data.email) {
      console.error("[Middleware] Token verification response invalid:", data);
      return null;
    }

    const user = data;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      gmailConnected: user.gmailConnected || false,
      isAdmin: user.isAdmin || false,
    };
  } catch (error) {
    console.error("[Middleware] Token verification network/parsing error:", error);
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
  const accessToken = request.cookies.get("accessToken")?.value;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  console.log(`[Middleware] Checking path: ${pathname}`);
  console.log(`[Middleware] All Cookies:`, request.cookies.getAll().map(c => `${c.name}=${c.value.substring(0, 10)}...`));
  console.log(`[Middleware] Access Token present: ${!!accessToken}`);

  // No access token - try to refresh using refresh token
  if (!accessToken) {
    const refreshToken = request.cookies.get("refreshToken")?.value;

    if (refreshToken) {
      console.log("[Middleware] Access token missing, attempting refresh with refresh token");
      try {
        // Call backend to refresh token
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const refreshResponse = await fetch(`${apiUrl}/api/auth/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `refreshToken=${refreshToken}`,
          },
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          const newAccessToken = data.accessToken;

          console.log("[Middleware] Token refresh successful");

          // Create response to continue to destination
          const response = NextResponse.next();

          // Forward the Set-Cookie headers from backend to browser
          const setCookieHeader = refreshResponse.headers.get('set-cookie');
          if (setCookieHeader) {
            // Next.js middleware needs careful handling of Set-Cookie
            // We can't easily parse all cookies from the header string in middleware
            // But we can manually set the new access token cookie for this response
            response.cookies.set("accessToken", newAccessToken, {
              httpOnly: true,
              secure: false, // Match backend
              sameSite: 'lax',
              path: '/',
              maxAge: 60 * 60 // 1 hour
            });

            // Also update the request cookies for the downstream handler (layout/page)
            // This is crucial so the server component sees the new token immediately
            request.cookies.set("accessToken", newAccessToken);

            // Re-verify with the new token to get user context
            const userContext = await verifyToken(newAccessToken, apiUrl);

            if (userContext) {
              // Check security level with new context
              const hasAccess = checkSecurityLevel(userContext, requiredLevel);
              if (!hasAccess) {
                // Handle access denial logic (same as below)
                if (requiredLevel === "gmailConnected" && !userContext.gmailConnected) {
                  return NextResponse.redirect(new URL(getGmailConnectPath(pathname), request.url));
                } else if (requiredLevel === "admin" && !userContext.isAdmin) {
                  return NextResponse.redirect(new URL("/dashboard", request.url));
                } else {
                  return NextResponse.redirect(new URL(getSecurityRedirectPath(requiredLevel, pathname), request.url));
                }
              }
              return response;
            }
          }
        } else {
          console.error("[Middleware] Token refresh failed with status:", refreshResponse.status);
        }
      } catch (error) {
        console.error("[Middleware] Token refresh error:", error);
      }
    }

    console.log("❌ Middleware: No valid tokens found. Redirecting to login.");
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/login") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Verify token and get user context
  const userContext = await verifyToken(accessToken, apiUrl);

  // Invalid token - clear cookie and redirect to login
  if (!userContext) {
    console.log("❌ Middleware: Token verification failed for path:", pathname);
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("accessToken");
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
