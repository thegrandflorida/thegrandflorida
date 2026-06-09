import { useQuery } from '@tanstack/react-query'
import type { PropertyWithRelations } from '@/types/database'

async function fetchProperty(id: string): Promise<PropertyWithRelations> {
  const res = await fetch(`/api/properties/${id}`)
  if (!res.ok) throw new Error('Failed to fetch property')
  const json = await res.json()
  return json.data
}

export function useProperty(id: string) {
  const { data: property, isLoading, error } = useQuery({
    queryKey: ['property', id],
    queryFn: () => fetchProperty(id),
    enabled: Boolean(id),
  })

  return { property, isLoading, error }
}
