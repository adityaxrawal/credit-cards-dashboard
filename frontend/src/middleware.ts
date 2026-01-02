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
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
  "/.well-known",
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
  const fullUrl = request.url;
  const allCookies = request.cookies.getAll();

  console.log(`\n========== [Middleware] START ==========`);
  console.log(`[Middleware] Full URL: ${fullUrl}`);
  console.log(`[Middleware] Pathname: ${pathname}`);
  console.log(`[Middleware] Search params: ${request.nextUrl.searchParams.toString()}`);
  console.log(`[Middleware] Cookies present: ${allCookies.map(c => c.name).join(', ') || 'NONE'}`);

  // Allow public paths (static assets, API routes, etc.)
  if (isPublicPath(pathname)) {
    console.log(`[Middleware] ✅ Path is in PUBLIC_PATHS static list, passing through`);
    return NextResponse.next();
  }

  // Get required security level for this route
  const requiredLevel = getRequiredSecurityLevel(pathname);
  console.log(`[Middleware] Required security level for ${pathname}: ${requiredLevel}`);

  // Public routes don't need auth check - but redirect authenticated users away from login
  if (requiredLevel === "public") {
    console.log(`[Middleware] Route is PUBLIC (from security map)`);

    // If user is visiting login page and has a valid access token, redirect to dashboard
    if (pathname === "/login") {
      console.log(`[Middleware] On /login page, checking for existing auth...`);
      const accessToken = request.cookies.get("accessToken")?.value;
      console.log(`[Middleware] accessToken cookie exists: ${!!accessToken}`);

      if (accessToken) {
        console.log(`[Middleware] accessToken found: ${accessToken.substring(0, 20)}...`);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        console.log(`[Middleware] Verifying token with backend at: ${apiUrl}`);

        const userContext = await verifyToken(accessToken, apiUrl);
        console.log(`[Middleware] Token verification result: ${userContext ? 'VALID - user: ' + userContext.email : 'INVALID'}`);

        if (userContext) {
          // User is authenticated, redirect to dashboard (or to 'next' param if valid)
          const nextUrl = request.nextUrl.searchParams.get("next");
          console.log(`[Middleware] User authenticated, next param: ${nextUrl}`);

          // Only allow redirect to internal paths, not external URLs, and not to login itself
          const safeNextUrl = nextUrl && nextUrl.startsWith("/") && nextUrl !== "/login"
            ? nextUrl
            : "/dashboard";
          console.log(`[Middleware] 🔄 REDIRECTING authenticated user from /login to: ${safeNextUrl}`);
          console.log(`========== [Middleware] END ==========\n`);
          return NextResponse.redirect(new URL(safeNextUrl, request.url));
        }

        // Token is invalid - delete the invalid cookies and continue to login page
        console.log(`[Middleware] ⚠️ Token INVALID, deleting cookies and showing login`);
        const response = NextResponse.next();
        response.cookies.delete("accessToken");
        response.cookies.delete("refreshToken");
        console.log(`[Middleware] Deleted accessToken and refreshToken cookies`);
        console.log(`========== [Middleware] END ==========\n`);
        return response;
      }
      console.log(`[Middleware] No accessToken cookie, showing login page`);
    }
    console.log(`[Middleware] ✅ Passing through to public route`);
    console.log(`========== [Middleware] END ==========\n`);
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
    console.log(`[Middleware] ❌ No accessToken cookie found`);
    const refreshToken = request.cookies.get("refreshToken")?.value;
    console.log(`[Middleware] refreshToken cookie exists: ${!!refreshToken}`);

    if (refreshToken) {
      console.log(`[Middleware] Attempting token refresh with refreshToken: ${refreshToken.substring(0, 20)}...`);
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

    console.log(`[Middleware] ❌ No valid tokens found. Redirecting to login.`);
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/login") {
      loginUrl.searchParams.set("next", pathname);
      console.log(`[Middleware] Setting next param to: ${pathname}`);
    }
    console.log(`[Middleware] 🔄 REDIRECTING to: ${loginUrl.toString()}`);
    const response = NextResponse.redirect(loginUrl);
    // Clear potentially invalid refresh token to prevent infinite loop
    if (refreshToken) {
      console.log(`[Middleware] Deleting invalid refreshToken cookie`);
      response.cookies.delete("refreshToken");
    }
    console.log(`========== [Middleware] END ==========\n`);
    return response;
  }

  // Verify token and get user context
  console.log(`[Middleware] Verifying accessToken with backend...`);
  const userContext = await verifyToken(accessToken, apiUrl);
  console.log(`[Middleware] Token verification result: ${userContext ? 'VALID - user: ' + userContext.email : 'INVALID'}`);

  // Invalid token - try to refresh if we have a refresh token
  if (!userContext) {
    console.log(`[Middleware] ❌ Token verification FAILED for path: ${pathname}`);

    const refreshToken = request.cookies.get("refreshToken")?.value;
    console.log(`[Middleware] refreshToken exists for retry: ${!!refreshToken}`);

    if (refreshToken) {
      console.log(`[Middleware] Attempting token refresh after verification failure...`);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const refreshResponse = await fetch(`${apiUrl}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: `refreshToken=${refreshToken}` },
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

        console.log(`[Middleware] Refresh response status: ${refreshResponse.status}`);

        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          const newAccessToken = data.accessToken;
          console.log(`[Middleware] ✅ Token refresh SUCCESSFUL, got new accessToken`);

          const response = NextResponse.next();

          // Forward the Set-Cookie headers from backend if any
          const setCookieHeader = refreshResponse.headers.get('set-cookie');

          response.cookies.set("accessToken", newAccessToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60
          });

          request.cookies.set("accessToken", newAccessToken);

          // Re-verify with new token
          const retryUserContext = await verifyToken(newAccessToken, apiUrl);
          console.log(`[Middleware] Re-verification result: ${retryUserContext ? 'VALID' : 'INVALID'}`);

          if (retryUserContext) {
            // Check security level with new context
            const hasAccess = checkSecurityLevel(retryUserContext, requiredLevel);
            console.log(`[Middleware] Security check - required: ${requiredLevel}, hasAccess: ${hasAccess}`);
            if (!hasAccess) {
              // Security check fail logic
              if (requiredLevel === "gmailConnected" && !retryUserContext.gmailConnected) {
                console.log(`[Middleware] 🔄 REDIRECTING to Gmail connect`);
                console.log(`========== [Middleware] END ==========\n`);
                return NextResponse.redirect(new URL(getGmailConnectPath(pathname), request.url));
              } else if (requiredLevel === "admin" && !retryUserContext.isAdmin) {
                console.log(`[Middleware] 🔄 REDIRECTING to dashboard (not admin)`);
                console.log(`========== [Middleware] END ==========\n`);
                return NextResponse.redirect(new URL("/dashboard", request.url));
              } else {
                console.log(`[Middleware] 🔄 REDIRECTING to: ${getSecurityRedirectPath(requiredLevel, pathname)}`);
                console.log(`========== [Middleware] END ==========\n`);
                return NextResponse.redirect(new URL(getSecurityRedirectPath(requiredLevel, pathname), request.url));
              }
            }
            console.log(`[Middleware] ✅ Access GRANTED after refresh`);
            console.log(`========== [Middleware] END ==========\n`);
            return response;
          }
        } else {
          console.error(`[Middleware] ❌ Refresh FAILED with status: ${refreshResponse.status}`);
          try {
            const errorBody = await refreshResponse.text();
            console.error(`[Middleware] Refresh error body: ${errorBody}`);
          } catch { }
        }
      } catch (err) {
        console.error(`[Middleware] ❌ Error during refresh retry:`, err);
      }
    }

    // If refresh failed or no refresh token, redirect to login
    console.log(`[Middleware] 🔄 REDIRECTING to /login after failed verification/refresh`);
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("accessToken");
    response.cookies.delete("refreshToken");
    console.log(`[Middleware] Deleted both accessToken and refreshToken cookies`);
    console.log(`========== [Middleware] END ==========\n`);
    return response;
  }

  // Check if user has required security level
  const hasAccess = checkSecurityLevel(userContext, requiredLevel);
  console.log(`[Middleware] Security Check: User=${userContext?.email}, Required=${requiredLevel}, Access=${hasAccess}`);

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
