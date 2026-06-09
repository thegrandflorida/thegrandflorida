'use client'

import { useState, useCallback } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { MapView } from '@/components/map/MapView'
import { FilterPanel } from '@/components/forms/FilterPanel'
import type { PropertyFilters } from '@/types/database'

export default function MapPage() {
  const [filters, setFilters] = useState<Partial<PropertyFilters>>({})
  const [filterOpen, setFilterOpen] = useState(false)
  const [propertyCount, setPropertyCount] = useState<number | null>(null)

  const handlePropertySelect = useCallback((propertyId: string) => {
    // Selection handled inside MapView via popup
    void propertyId
  }, [])

  const handleFilterChange = useCallback((newFilters: Partial<PropertyFilters>) => {
    setFilters(newFilters)
  }, [])

  const handleReset = useCallback(() => {
    setFilters({})
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Map fills entire area */}
      <MapView filters={filters} onPropertySelect={handlePropertySelect} />

      {/* Filter toggle button */}
      <button
        type="button"
        onClick={() => setFilterOpen((o) => !o)}
        className="absolute top-4 left-4 z-20 flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/85 backdrop-blur-sm px-3 py-2 text-sm text-slate-300 hover:text-slate-100 transition-colors"
        aria-label="Toggle filters"
      >
        <SlidersHorizontal className="w-4 h-4" />
        Filters
      </button>

      {/* Property count badge */}
      {propertyCount != null && (
        <div className="absolute top-4 right-16 z-20 rounded-full border border-slate-700/60 bg-slate-900/85 backdrop-blur-sm px-3 py-1 text-xs text-slate-300">
          {propertyCount.toLocaleString()} {propertyCount === 1 ? 'property' : 'properties'}
        </div>
      )}

      {/* Collapsible filter panel */}
      {filterOpen && (
        <>
          {/* Backdrop on mobile */}
          <div
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
            onClick={() => setFilterOpen(false)}
          />
          <aside className="absolute top-0 left-0 z-30 h-full w-72 overflow-y-auto border-r border-slate-700/60 bg-slate-900/95 backdrop-blur-md">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
              <p className="text-sm font-semibold text-slate-200">Filters</p>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <FilterPanel filters={filters} onChange={handleFilterChange} onReset={handleReset} />
          </aside>
        </>
      )}
    </div>
  )
}
