import { useInfiniteQuery } from '@tanstack/react-query'
import type { PropertyWithRelations, PropertyFilters, PaginationMeta } from '@/types/database'

interface PropertiesResponse {
  data: PropertyWithRelations[]
  meta: PaginationMeta
}

async function fetchProperties(filters: Partial<PropertyFilters>, cursor?: string): Promise<PropertiesResponse> {
  const params = new URLSearchParams()

  if (filters.counties?.length) params.set('counties', filters.counties.join(','))
  if (filters.zoning_categories?.length) params.set('zoning_categories', filters.zoning_categories.join(','))
  if (filters.zoning_codes?.length) params.set('zoning_codes', filters.zoning_codes.join(','))
  if (filters.lot_min_acres != null) params.set('lot_min_acres', String(filters.lot_min_acres))
  if (filters.lot_max_acres != null) params.set('lot_max_acres', String(filters.lot_max_acres))
  if (filters.price_min != null) params.set('price_min', String(filters.price_min))
  if (filters.price_max != null) params.set('price_max', String(filters.price_max))
  if (filters.score_min != null) params.set('score_min', String(filters.score_min))
  if (filters.score_max != null) params.set('score_max', String(filters.score_max))
  if (filters.vacant_only) params.set('vacant_only', 'true')
  if (filters.listed_only) params.set('listed_only', 'true')
  if (filters.exclude_flood) params.set('exclude_flood', 'true')
  if (filters.opportunity_zone_only) params.set('opportunity_zone_only', 'true')
  if (filters.cra_only) params.set('cra_only', 'true')
  if (filters.no_wetlands) params.set('no_wetlands', 'true')
  if (filters.distressed_only) params.set('distressed_only', 'true')
  if (filters.search) params.set('search', filters.search)
  if (cursor) params.set('cursor', cursor)

  const res = await fetch(`/api/properties?${params.toString()}`)
  if (!res.ok) throw new Error('Failed to fetch properties')
  return res.json()
}

export function useProperties(filters: Partial<PropertyFilters> = {}) {
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['properties', filters],
    queryFn: ({ pageParam }) => fetchProperties(filters, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.cursor ?? undefined,
  })

  const properties = data?.pages.flatMap((p) => p.data) ?? []
  const total = data?.pages[0]?.meta.total ?? 0
  const nextCursor = data?.pages[data.pages.length - 1]?.meta.cursor ?? null

  return { properties, total, nextCursor, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage }
}
