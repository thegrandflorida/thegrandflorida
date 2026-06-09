import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { upsertUserProfile } from '@/lib/db/users'

// GET /api/auth/callback
// Supabase OAuth callback handler — exchanges code for session,
// then upserts a user profile row.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.error('[auth/callback] Exchange failed:', error?.message)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // Upsert profile — idempotent
  try {
    await upsertUserProfile(data.user.id, data.user.email!, {
      full_name: data.user.user_metadata?.full_name ?? null,
    })
  } catch (profileErr) {
    // Non-fatal — user can still access the app
    console.error('[auth/callback] Profile upsert failed:', profileErr)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
