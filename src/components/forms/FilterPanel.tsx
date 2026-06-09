'use client'

import { Input, Range } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { PropertyFilters } from '@/types/database'

const COUNTY_OPTIONS = ['Broward', 'Palm Beach', 'Martin', 'St. Lucie', 'Indian River']

interface FilterPanelProps {
  filters: Partial<PropertyFilters>
  onChange: (filters: Partial<PropertyFilters>) => void
  onReset: () => void
}

export function FilterPanel({ filters, onChange, onReset }: FilterPanelProps) {
  function toggleCounty(county: string) {
    const current = filters.counties ?? []
    const next = current.includes(county)
      ? current.filter((c) => c !== county)
      : [...current, county]
    onChange({ ...filters, counties: next.length ? next : undefined })
  }

  function setFilter<K extends keyof PropertyFilters>(key: K, value: PropertyFilters[K] | undefined) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="space-y-6 p-4">
      <div>
        <p className="text-xs font-medium text-slate-300 mb-2">Counties</p>
        <div className="space-y-1.5">
          {COUNTY_OPTIONS.map((county) => (
            <label key={county} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.counties?.includes(county) ?? false}
                onChange={() => toggleCounty(county)}
                className="rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500/30"
              />
              <span className="text-sm text-slate-300">{county}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-300 mb-2">Price Range</p>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={filters.price_min ?? ''}
            onChange={(e) => setFilter('price_min', e.target.value ? Number(e.target.value) : undefined)}
          />
          <Input
            type="number"
            placeholder="Max"
            value={filters.price_max ?? ''}
            onChange={(e) => setFilter('price_max', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-300 mb-2">Acres Range</p>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={filters.lot_min_acres ?? ''}
            onChange={(e) => setFilter('lot_min_acres', e.target.value ? Number(e.target.value) : undefined)}
          />
          <Input
            type="number"
            placeholder="Max"
            value={filters.lot_max_acres ?? ''}
            onChange={(e) => setFilter('lot_max_acres', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </div>

      <div>
        <Range
          label="Min Opportunity Score"
          min={0}
          max={100}
          step={1}
          value={filters.score_min ?? 0}
          valueLabel={`${filters.score_min ?? 0}`}
          onChange={(e) => setFilter('score_min', Number(e.target.value) || undefined)}
        />
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.vacant_only ?? false}
            onChange={(e) => setFilter('vacant_only', e.target.checked || undefined)}
            className="rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500/30"
          />
          <span className="text-sm text-slate-300">Vacant only</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.exclude_flood ?? false}
            onChange={(e) => setFilter('exclude_flood', e.target.checked || undefined)}
            className="rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500/30"
          />
          <span className="text-sm text-slate-300">Exclude flood zone</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.opportunity_zone_only ?? false}
            onChange={(e) => setFilter('opportunity_zone_only', e.target.checked || undefined)}
            className="rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500/30"
          />
          <span className="text-sm text-slate-300">Opportunity zones only</span>
        </label>
      </div>

      <Button variant="ghost" size="sm" onClick={onReset} className="w-full">
        Reset filters
      </Button>
    </div>
  )
}
