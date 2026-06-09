'use client'

import { useState, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'
import { useProperties } from '@/hooks/useProperties'
import { PropertyCard } from '@/components/properties/PropertyCard'
import { PropertyCardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { FilterPanel } from '@/components/forms/FilterPanel'
import type { PropertyFilters } from '@/types/database'
import { formatNumber } from '@/lib/utils/format'

function parseFiltersFromParams(params: URLSearchParams): Partial<PropertyFilters> {
  const filters: Partial<PropertyFilters> = {}
  const counties = params.get('counties')
  if (counties) filters.counties = counties.split(',')
  const priceMin = params.get('price_min')
  if (priceMin) filters.price_min = Number(priceMin)
  const priceMax = params.get('price_max')
  if (priceMax) filters.price_max = Number(priceMax)
  const lotMin = params.get('lot_min_acres')
  if (lotMin) filters.lot_min_acres = Number(lotMin)
  const lotMax = params.get('lot_max_acres')
  if (lotMax) filters.lot_max_acres = Number(lotMax)
  const scoreMin = params.get('score_min')
  if (scoreMin) filters.score_min = Number(scoreMin)
  if (params.get('vacant_only') === 'true') filters.vacant_only = true
  if (params.get('exclude_flood') === 'true') filters.exclude_flood = true
  if (params.get('opportunity_zone_only') === 'true') filters.opportunity_zone_only = true
  const search = params.get('search')
  if (search) filters.search = search
  return filters
}

function filtersToParams(filters: Partial<PropertyFilters>): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.counties?.length) params.set('counties', filters.counties.join(','))
  if (filters.price_min != null) params.set('price_min', String(filters.price_min))
  if (filters.price_max != null) params.set('price_max', String(filters.price_max))
  if (filters.lot_min_acres != null) params.set('lot_min_acres', String(filters.lot_min_acres))
  if (filters.lot_max_acres != null) params.set('lot_max_acres', String(filters.lot_max_acres))
  if (filters.score_min != null) params.set('score_min', String(filters.score_min))
  if (filters.vacant_only) params.set('vacant_only', 'true')
  if (filters.exclude_flood) params.set('exclude_flood', 'true')
  if (filters.opportunity_zone_only) params.set('opportunity_zone_only', 'true')
  if (filters.search) params.set('search', filters.search)
  return params
}

export default function SearchPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const filters = parseFiltersFromParams(searchParams)

  const { properties, total, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useProperties(filters)

  const handleFilterChange = useCallback(
    (newFilters: Partial<PropertyFilters>) => {
      const params = filtersToParams(newFilters)
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname]
  )

  const handleReset = useCallback(() => {
    router.push(pathname)
  }, [router, pathname])

  return (
    <div className="flex gap-6">
      <aside
        className={`${
          sidebarOpen ? 'fixed inset-0 z-40 flex' : 'hidden'
        } lg:relative lg:flex lg:inset-auto lg:z-auto w-72 shrink-0 flex-col`}
      >
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <div className="relative z-10 w-72 shrink-0 rounded-xl border border-slate-700/60 bg-slate-800/50 overflow-y-auto max-h-[calc(100vh-6rem)]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
            <p className="text-sm font-semibold text-slate-200">Filters</p>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <FilterPanel filters={filters} onChange={handleFilterChange} onReset={handleReset} />
        </div>
      </aside>

      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </Button>
            {!isLoading && (
              <p className="text-sm text-slate-400">
                {formatNumber(total)} {total === 1 ? 'property' : 'properties'}
              </p>
            )}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400">Failed to load properties. Please try again.</p>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <PropertyCardSkeleton key={i} />
            ))}
          </div>
        ) : properties.length === 0 ? (
          <EmptyState
            title="No properties found"
            description="Try adjusting your filters to see more results."
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {properties.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
            {hasNextPage && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  loading={isFetchingNextPage}
                >
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
