'use client'

import { useState } from 'react'
import type { ScoringConfig } from '@/types/database'
import { Button } from '@/components/ui/Button'
import { Input, Range } from '@/components/ui/Input'

interface ScoringConfigEditorProps {
  config?: ScoringConfig
  onSave: () => void
  onCancel: () => void
}

const WEIGHT_FIELDS: { key: string; label: string }[] = [
  { key: 'price_per_acre', label: 'Price per Acre' },
  { key: 'zoning_flexibility', label: 'Zoning Flexibility' },
  { key: 'population_growth', label: 'Population Growth' },
  { key: 'flood_risk', label: 'Flood Risk' },
  { key: 'comparable_sales', label: 'Comparable Sales' },
  { key: 'development_activity', label: 'Development Activity' },
  { key: 'utility_access', label: 'Utility Access' },
  { key: 'wetland_pct', label: 'Wetland %' },
  { key: 'interstate_distance', label: 'Interstate Distance' },
]

const DEFAULT_WEIGHT_VALUES: Record<string, number> = {
  price_per_acre: 20,
  zoning_flexibility: 18,
  population_growth: 14,
  flood_risk: 13,
  comparable_sales: 12,
  development_activity: 10,
  utility_access: 7,
  wetland_pct: 4,
  interstate_distance: 2,
}

function weightsToPercent(weights: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {}
  for (const f of WEIGHT_FIELDS) {
    const v = weights[f.key] ?? 0
    result[f.key] = Math.round(v <= 1 ? v * 100 : v)
  }
  return result
}

function percentToDecimal(pct: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {}
  for (const f of WEIGHT_FIELDS) {
    result[f.key] = (pct[f.key] ?? 0) / 100
  }
  return result
}

export function ScoringConfigEditor({ config, onSave, onCancel }: ScoringConfigEditorProps) {
  const isCreate = !config

  const [name, setName] = useState(config?.name ?? '')
  const [description, setDescription] = useState(config?.description ?? '')
  const [propertyType, setPropertyType] = useState<string>(
    (config as (ScoringConfig & { property_type?: string }) | undefined)?.property_type ?? 'residential'
  )
  const [isDefault, setIsDefault] = useState(config?.is_default ?? false)
  const [weights, setWeights] = useState<Record<string, number>>(
    config?.weights ? weightsToPercent(config.weights) : { ...DEFAULT_WEIGHT_VALUES }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const total = Object.values(weights).reduce((s, v) => s + v, 0)
  const totalOk = total === 100

  function setWeight(key: string, value: number) {
    setWeights((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required.'); return }
    if (!totalOk) { setError('Weights must sum to 100%.'); return }

    setSaving(true)
    setError(null)
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        property_type: propertyType,
        is_default: isDefault,
        weights: percentToDecimal(weights),
      }
      const res = await fetch('/api/scoring/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error?.message ?? 'Failed to save config')
      }
      setSuccess(true)
      setTimeout(() => onSave(), 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {!isCreate && (
        <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          Note: To update an existing config, create a new one. The POST endpoint creates only.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Residential Default"
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-300">Property Type</label>
          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            className="h-9 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 px-3 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
          >
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="industrial">Industrial</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-300">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Optional description..."
          className="rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/50 resize-none placeholder:text-slate-500"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500/30"
        />
        <span className="text-sm text-slate-300">Set as default config</span>
      </label>

      {/* Weight sliders */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Factor Weights</p>
          <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${totalOk ? 'text-teal-400 bg-teal-500/10' : 'text-red-400 bg-red-500/10'}`}>
            Total: {total}%
          </span>
        </div>
        <div className="space-y-3">
          {WEIGHT_FIELDS.map((f) => (
            <Range
              key={f.key}
              label={f.label}
              valueLabel={`${weights[f.key] ?? 0}%`}
              min={0}
              max={100}
              step={1}
              value={weights[f.key] ?? 0}
              onChange={(e) => setWeight(f.key, Number(e.target.value))}
            />
          ))}
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-xs text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-lg px-3 py-2">Config created successfully.</p>
      )}

      <div className="flex gap-2 pt-1">
        <Button type="submit" variant="primary" loading={saving} disabled={!totalOk}>
          {isCreate ? 'Create Config' : 'Create New Config'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
