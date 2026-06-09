import { createClient } from '@/lib/supabase/server'
import type { User } from '@/types/database'

// Returns the current user profile or null — for use inside Route Handlers
export async function getAuthUser(): Promise<{
  authUser: { id: string; email: string } | null
  user: User | null
}> {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return { authUser: null, user: null }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  return {
    authUser: { id: authUser.id, email: authUser.email! },
    user: profile as User | null,
  }
}

// Require auth — throws structured error payload if not authenticated
export async function requireAuth() {
  const { authUser, user } = await getAuthUser()
  if (!authUser) {
    throw { code: 'UNAUTHORIZED', message: 'Authentication required', status: 401 }
  }
  return { authUser, user }
}

// Require specific role
export async function requireRole(role: 'admin' | 'analyst') {
  const { authUser, user } = await requireAuth()
  if (!user || (role === 'admin' && user.role !== 'admin')) {
    throw { code: 'FORBIDDEN', message: 'Insufficient permissions', status: 403 }
  }
  return { authUser, user }
}
