'use client'

import type { ScoringConfig } from '@/types/database'

interface ScoreBreakdownChartProps {
  scoreBreakdown: Record<string, number>
  config?: ScoringConfig
}

const FACTOR_LABELS: Record<string, string> = {
  price_score: 'Price per Acre',
  zoning_score: 'Zoning Flexibility',
  population_score: 'Population Growth',
  flood_score: 'Flood Risk',
  comps_score: 'Comparable Sales',
  dev_activity_score: 'Development Activity',
  utility_score: 'Utility Access',
  wetland_score: 'Wetland %',
  interstate_score: 'Interstate Distance',
}

export function ScoreBreakdownChart({ scoreBreakdown, config: _config }: ScoreBreakdownChartProps) {
  // Filter to the known factor keys and sort descending by value
  const entries = Object.entries(scoreBreakdown)
    .filter(([key]) => key in FACTOR_LABELS && key !== 'bonus' && key !== 'penalty')
    .sort(([, a], [, b]) => b - a)

  const total = typeof scoreBreakdown.bonus === 'number'
    ? entries.reduce((s, [, v]) => s + v, 0)
    : null

  if (entries.length === 0) return null

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => {
        const label = FACTOR_LABELS[key] ?? key
        const pct = Math.min(100, Math.max(0, (value / 25) * 100))
        return (
          <div key={key}>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-slate-400">{label}</span>
              <span className="text-slate-300 font-mono">{value.toFixed(1)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
      {total !== null && (
        <>
          <div className="border-t border-slate-700/60 mt-3 pt-3">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-300">Sub-score Total</span>
              <span className="text-teal-400 font-mono">{entries.reduce((s, [, v]) => s + v, 0).toFixed(1)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
