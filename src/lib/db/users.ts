import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { User, Favorite, SavedSearch, Alert } from '@/types/database'

// -----------------------------------------------------------------------------
// Get current authenticated user profile
// -----------------------------------------------------------------------------

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to get user profile: ${error.message}`)
  }

  return data as User
}

// -----------------------------------------------------------------------------
// Upsert user profile (called after OAuth / email signup)
// -----------------------------------------------------------------------------

export async function upsertUserProfile(
  userId: string,
  email: string,
  updates: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>
): Promise<User> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        id: userId,
        email,
        ...updates,
      },
      { onConflict: 'id' }
    )
    .select()
    .single()

  if (error) throw new Error(`Failed to upsert user: ${error.message}`)
  return data as User
}

// -----------------------------------------------------------------------------
// Favorites
// -----------------------------------------------------------------------------

export async function getUserFavorites(userId: string): Promise<Favorite[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('favorites')
    .select('*, property:properties(*, opportunity_score:opportunity_scores(overall_score, score_grade))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to get favorites: ${error.message}`)
  return (data ?? []) as unknown as Favorite[]
}

export async function addFavorite(
  userId: string,
  propertyId: string
): Promise<Favorite> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('favorites')
    .insert({ user_id: userId, property_id: propertyId })
    .select()
    .single()

  if (error) throw new Error(`Failed to add favorite: ${error.message}`)
  return data as Favorite
}

export async function removeFavorite(
  userId: string,
  propertyId: string
): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('property_id', propertyId)

  if (error) throw new Error(`Failed to remove favorite: ${error.message}`)
}

export async function updateFavorite(
  userId: string,
  propertyId: string,
  updates: Pick<Partial<Favorite>, 'notes' | 'tags' | 'stage'>
): Promise<Favorite> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('favorites')
    .update(updates)
    .eq('user_id', userId)
    .eq('property_id', propertyId)
    .select()
    .single()

  if (error) throw new Error(`Failed to update favorite: ${error.message}`)
  return data as Favorite
}

// -----------------------------------------------------------------------------
// Saved searches
// -----------------------------------------------------------------------------

export async function getUserSavedSearches(userId: string): Promise<SavedSearch[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to get saved searches: ${error.message}`)
  return (data ?? []) as unknown as SavedSearch[]
}

export async function createSavedSearch(
  userId: string,
  search: Omit<SavedSearch, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'last_run_at' | 'last_result_count' | 'new_since_last_run'>
): Promise<SavedSearch> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('saved_searches')
    .insert({ ...search, user_id: userId })
    .select()
    .single()

  if (error) throw new Error(`Failed to create saved search: ${error.message}`)
  return data as SavedSearch
}

export async function deleteSavedSearch(
  userId: string,
  searchId: string
): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('saved_searches')
    .delete()
    .eq('id', searchId)
    .eq('user_id', userId)

  if (error) throw new Error(`Failed to delete saved search: ${error.message}`)
}

// -----------------------------------------------------------------------------
// Alerts
// -----------------------------------------------------------------------------

export async function getUserAlerts(
  userId: string,
  unreadOnly = false
): Promise<Alert[]> {
  const supabase = createAdminClient()

  let query = supabase
    .from('alerts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (unreadOnly) query = query.eq('is_read', false)

  const { data, error } = await query
  if (error) throw new Error(`Failed to get alerts: ${error.message}`)
  return (data ?? []) as unknown as Alert[]
}

export async function markAlertsRead(
  userId: string,
  alertIds: string[]
): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('alerts')
    .update({ is_read: true })
    .eq('user_id', userId)
    .in('id', alertIds)

  if (error) throw new Error(`Failed to mark alerts read: ${error.message}`)
}
