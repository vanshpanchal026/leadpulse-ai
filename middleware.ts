import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME, isValidSessionToken } from './lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets, Next.js internals, and public routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/assets') ||
    pathname === '/favicon.ico' ||
    pathname.match(/\.(png|jpg|jpeg|svg|webp|gif|ico|woff2?|css|js|map)$/)
  ) {
    return NextResponse.next();
  }

  // Allow login page and login API
  if (pathname === '/login' || pathname === '/api/auth/login') {
    return NextResponse.next();
  }

  // Verify session cookie
  const sessionToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isAuthorized = await isValidSessionToken(sessionToken);

  if (!isAuthorized) {
    // Return 401 JSON for unauthenticated API requests
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid dashboard passcode required.' },
        { status: 401 }
      );
    }

    // Redirect to /login for page navigation
    const loginUrl = new URL('/login', request.url);
    // Optional: save intended path in query params if needed
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Allow authenticated API requests to reach Next.js API route handlers
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Rewrite all authenticated UI routes to the Port 3500 Vite client SPA
  return NextResponse.rewrite(new URL('/index.html', request.url));
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
