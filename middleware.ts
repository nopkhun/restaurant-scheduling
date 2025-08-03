import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import createMiddleware from 'next-intl/middleware';

// Create the intl middleware
const intlMiddleware = createMiddleware({
  locales: ['en', 'th'],
  defaultLocale: 'en',
  localePrefix: 'always'
});

export async function middleware(request: NextRequest) {
  // Handle internationalization first
  const intlResponse = intlMiddleware(request);
  if (intlResponse) {
    return intlResponse;
  }
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired - required for Server Components
  const { data: { user }, error } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Extract locale from pathname
  const localePattern = /^\/(en|th)(\/.*)?$/;
  const localeMatch = pathname.match(localePattern);
  const locale = localeMatch ? localeMatch[1] : null;
  const pathWithoutLocale = localeMatch ? (localeMatch[2] || '/') : pathname;

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/register', '/forgot-password'];
  const isPublicRoute = publicRoutes.some(route => 
    pathWithoutLocale === route || pathWithoutLocale.startsWith('/api/auth/')
  );

  // If accessing a public route, allow access
  if (isPublicRoute) {
    return response;
  }

  // If no user and trying to access protected route, redirect to login
  if (!user && !isPublicRoute) {
    const loginPath = locale ? `/${locale}/login` : '/login';
    const redirectUrl = new URL(loginPath, request.url);
    redirectUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If user is authenticated and trying to access auth pages, redirect to dashboard
  if (user && (pathWithoutLocale === '/login' || pathWithoutLocale === '/register')) {
    const dashboardPath = locale ? `/${locale}/dashboard` : '/dashboard';
    return NextResponse.redirect(new URL(dashboardPath, request.url));
  }

  // API route protection
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Add user information to headers for API routes
    response.headers.set('x-user-id', user.id);
    response.headers.set('x-user-email', user.email || '');
    
    // Add custom claims if available
    const role = user.user_metadata?.role || user.app_metadata?.role || 'employee';
    const branchId = user.user_metadata?.branch_id || user.app_metadata?.branch_id || '';
    
    response.headers.set('x-user-role', role);
    response.headers.set('x-user-branch-id', branchId);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};