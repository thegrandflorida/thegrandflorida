import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SavedSearch, PropertyFilters } from '@/types/database'

interface SavedSearchesResponse {
  data: SavedSearch[]
}

async function fetchSavedSearches(): Promise<SavedSearchesResponse> {
  const res = await fetch('/api/search/saved')
  if (!res.ok) throw new Error('Failed to fetch saved searches')
  return res.json()
}

async function createSearchFn({ name, filters }: { name: string; filters: Partial<PropertyFilters> }): Promise<void> {
  const res = await fetch('/api/search/saved', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, filters }),
  })
  if (!res.ok) throw new Error('Failed to create saved search')
}

async function deleteSearchFn(id: string): Promise<void> {
  const res = await fetch(`/api/search/saved/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete saved search')
}

export function useSavedSearches() {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['saved-searches'],
    queryFn: fetchSavedSearches,
  })

  const createMutation = useMutation({
    mutationFn: createSearchFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-searches'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSearchFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-searches'] }),
  })

  return {
    savedSearches: data?.data ?? [],
    isLoading,
    error,
    createSearch: (name: string, filters: Partial<PropertyFilters>) =>
      createMutation.mutate({ name, filters }),
    deleteSearch: deleteMutation.mutate,
  }
}
