import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define redirect mappings from old pages to new Post-Sale tabs
const postSaleRedirects: Record<string, string> = {
  '/creatives': '/post-sale?tab=creative',
  '/orders': '/post-sale?tab=orders', 
  '/contracts': '/post-sale?tab=contracts',
  '/ad-approvals': '/post-sale?tab=creative&view=approvals',
}

// Routes that don't require authentication
const publicRoutes = [
  '/login',
  '/signup',
  '/accept-invitation',
  '/reset-password',
  '/forgot-password',
  '/api/auth/login',
  '/api/auth/check',
  '/api/auth/reset-password/validate',
  '/api/auth/reset-password/confirm',
  '/api/auth/password-reset', // PUT endpoint for public password reset requests
  '/api/invitations/accept', // Allow invitation acceptance endpoint
  '/api/cache-bust',
  '/api/test-cookies',
  '/api/debug-auth',
  '/privacy',
  '/terms',
  // Add impersonate routes as public since they handle auth internally
  '/master/impersonate',
  '/master/impersonate-standalone',
]

// Routes that require specific roles
const roleBasedRoutes = {
  '/master': ['master'],
  '/admin': ['admin', 'master'],
  '/seller': ['sales', 'admin', 'master'],
  '/producer': ['producer', 'admin', 'master'],
  '/talent': ['talent', 'admin', 'master'],
  '/client': ['client', 'admin', 'master'],
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Add comprehensive logging
  console.log('🔍 Middleware: Processing request for:', pathname)

  // Create Supabase client
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired
  const { data: { user } } = await supabase.auth.getUser()

  // Check if current path should be redirected to Post-Sale Management
  const redirectTarget = postSaleRedirects[pathname]
  
  if (redirectTarget) {
    // Check if user is authenticated
    if (user) {
      // Check if auto-redirect is enabled
      // Now enabled since old pages have been archived
      const shouldAutoRedirect = true // Enabled after archiving old pages
      
      if (shouldAutoRedirect) {
        const url = request.nextUrl.clone()
        const [path, query] = redirectTarget.split('?')
        url.pathname = path
        if (query) {
          const params = new URLSearchParams(query)
          params.forEach((value, key) => {
            url.searchParams.set(key, value)
          })
        }
        console.log(`🔍 Middleware: Redirecting ${pathname} to ${url.toString()}`)
        return NextResponse.redirect(url)
      }
    }
  }

  // Allow public routes (including impersonate pages)
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    console.log('🔍 Middleware: Public route, allowing access:', pathname)
    return supabaseResponse
  }

  // Allow static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // files with extensions
  ) {
    return supabaseResponse
  }

  // TEMPORARY: Allow episode detail pages to handle their own auth
  // This prevents middleware from redirecting before the page can check auth
  if (pathname.match(/^\/episodes\/[^\/]+$/)) {
    console.log('🔍 Middleware: Episode detail page, delegating auth to page component:', pathname)
    return supabaseResponse
  }

  // For API routes, we can't use Prisma directly in middleware
  // So we'll let the API routes handle their own auth
  if (pathname.startsWith('/api')) {
    return supabaseResponse
  }

  // Check authentication with Supabase
  if (!user) {
    console.log(`🔍 Middleware: No authenticated user for path ${pathname}`)
    
    // Redirect to login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // For non-API routes, user is authenticated
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (opt out completely, no auth middleware)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}