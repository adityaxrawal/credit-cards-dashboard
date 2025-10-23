import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { config as envConfig } from './lib/config/env';

export async function middleware(request: NextRequest) {
  // Skip middleware for Vite client requests (development only)
  if (request.nextUrl.pathname.startsWith('/@vite/')) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    envConfig.supabase.url,
    envConfig.supabase.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh the session to ensure it's up to date
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    // Only log errors that are not AuthSessionMissingError
    if (error && error.message !== 'Auth session missing!') {
      console.error('Error getting user in middleware:', error);
    }

    // Optional: Add user info to headers for use in API routes
    if (user) {
      response.headers.set('x-user-id', user.id);
      response.headers.set('x-user-email', user.email || '');
    }
  } catch (error) {
    console.error('Unexpected error in middleware:', error);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - @vite/ (Vite development client)
     * Also exclude files with extensions
     */
    '/((?!api|_next/static|_next/image|favicon.ico|@vite/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};

// Type definitions for cookie options
interface CookieOptions {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: Date;
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

// Helper function to create secure cookie options
export function createSecureCookieOptions(options: Partial<CookieOptions> = {}): CookieOptions {
  return {
    name: options.name || '',
    value: options.value || '',
    path: options.path || '/',
    httpOnly: options.httpOnly ?? true,
    secure: options.secure ?? process.env.NODE_ENV === 'production',
    sameSite: options.sameSite || 'lax',
    maxAge: options.maxAge || 60 * 60 * 24 * 7, // 7 days default
    ...options,
  };
}