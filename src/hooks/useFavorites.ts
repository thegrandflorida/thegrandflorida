import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Favorite } from '@/types/database'

interface FavoritesResponse {
  data: Favorite[]
}

async function fetchFavorites(): Promise<FavoritesResponse> {
  const res = await fetch('/api/favorites')
  if (!res.ok) throw new Error('Failed to fetch favorites')
  return res.json()
}

async function addFavoriteFn(propertyId: string): Promise<void> {
  const res = await fetch('/api/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ property_id: propertyId }),
  })
  if (!res.ok) throw new Error('Failed to add favorite')
}

async function removeFavoriteFn(propertyId: string): Promise<void> {
  const res = await fetch(`/api/favorites/${propertyId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to remove favorite')
}

export function useFavorites() {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['favorites'],
    queryFn: fetchFavorites,
  })

  const addMutation = useMutation({
    mutationFn: addFavoriteFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  })

  const removeMutation = useMutation({
    mutationFn: removeFavoriteFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  })

  return {
    favorites: data?.data ?? [],
    isLoading,
    error,
    addFavorite: addMutation.mutate,
    removeFavorite: removeMutation.mutate,
  }
}
