import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Replace this array with an array of paths for pages in your app that do not require the
// user to be authenticated, e.g. a login page
const UNAUTHENTICATED_PAGES = [];


export async function middleware(req: NextRequest) {
  const cookieAuthToken = req.cookies.get('privy-token');
  const cookieSession = req.cookies.get('privy-session');

  // Bypass middleware when `privy_oauth_code` is a query parameter, as
  // we are in the middle of an authentication flow
  if (req.nextUrl.searchParams.get('privy_oauth_code')) return NextResponse.next();

  // Bypass middleware when the /refresh page is fetched, otherwise
  // we will enter an infinite loop
  if (req.url.includes('/')) return NextResponse.next();

  // If the user has `privy-token`, they are definitely authenticated
  const definitelyAuthenticated = Boolean(cookieAuthToken);
  // If user has `privy-session`, they also have `privy-refresh-token` and
  // may be authenticated once their session is refreshed in the client
  const maybeAuthenticated = Boolean(cookieSession);

  if (!definitelyAuthenticated && maybeAuthenticated) {
    // If user is not authenticated, but is maybe authenticated
    // redirect them to the `/refresh` page to trigger client-side refresh flow
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

// Configure the middleware to run on specific paths
export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Match Privy authentication routes
    '/api/proxy/privy/:path*',
    // Exclude static files, but include all other routes
    '/((?!_next/static|_next/image|favicon.ico|images|public).*)',
    // Match specific paths that might need CORS headers
    '/((?!_next/static|_next/image|favicon.ico).*)',
    // Special handling for Privy endpoints
    '/api/proxy/privy/user_signers/authenticate',
    '/api/proxy/privy/analytics_events',
  ],
};
