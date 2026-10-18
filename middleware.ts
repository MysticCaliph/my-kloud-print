import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function redirectToHome(
  request: NextRequest,
  error: 'unauthorized' | 'forbidden',
  cookiesFrom?: NextResponse,
) {
  const url = request.nextUrl.clone()
  url.pathname = '/'
  url.search = ''
  url.searchParams.set('error', error)
  const redirect = NextResponse.redirect(url)
  cookiesFrom?.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
  return redirect
}

function unavailable(message: string) {
  console.error(message)
  return new Response('Admin authorization is temporarily unavailable.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return unavailable('Admin route blocked: Supabase URL or anonymous key is not configured.')
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/login', request.url)
    const redirect = NextResponse.redirect(loginUrl)
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    return unavailable(`Admin role lookup failed: ${error.message}`)
  }

  if (profile?.role !== 'operator' && profile?.role !== 'admin') {
    return redirectToHome(request, 'forbidden', response)
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
