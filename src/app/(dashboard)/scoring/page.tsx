'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useScoringConfigs } from '@/hooks/useScoringConfigs'
import { ScoringConfigEditor } from '@/components/scoring/ScoringConfigEditor'
import type { ScoringConfig } from '@/types/database'

type Tab = 'configs' | 'batch' | 'how'

// ── How It Works static data ──────────────────────────────────────────────────

const FACTORS = [
  {
    name: 'Price per Acre',
    weight: '20%',
    description: 'Compares subject price/acre to county median. Higher discount = higher score.',
    calculation: 'Discount ratio vs county median; ≥40% discount → 100, at median → 40, premium → near 0',
  },
  {
    name: 'Zoning Flexibility',
    weight: '18%',
    description: 'Measures density upside from current zoning vs FLU max, plus upzoning potential.',
    calculation: 'Density upside pct mapped to 20–90 base, ±10 for upzoning potential, +2/conditional use (max +8)',
  },
  {
    name: 'Population Growth',
    weight: '14%',
    description: 'Tract 5-yr growth rate, relative to county, plus income growth and permit velocity.',
    calculation: 'Growth % → 0–100 base, modifiers for relative growth, income trend, and permit volume',
  },
  {
    name: 'Flood Risk',
    weight: '13%',
    description: 'FEMA zone code plus % of parcel in flood zone. Zone X (best) → 100, VE (worst) → 5.',
    calculation: 'Zone base score, adjusted by flood zone %, +elevation bonus for AE zones',
  },
  {
    name: 'Comparable Sales',
    weight: '12%',
    description: 'Sales trend, velocity, and subject discount to comps over trailing 12 months.',
    calculation: '40% trend + 25% velocity + 35% discount-to-comps',
  },
  {
    name: 'Development Activity',
    weight: '10%',
    description: 'Active construction within 0.5 mi and new permits within 1 mi over 12 months.',
    calculation: '55% construction count + 45% permit count, ×1.15 if major anchor present',
  },
  {
    name: 'Utility Access',
    weight: '7%',
    description: 'Points awarded for water, sewer, electric, road frontage, fiber, gas.',
    calculation: 'Water at site +30, sewer at site +30, paved road +20, electric +8, fiber +4, gas +3 (out of 98)',
  },
  {
    name: 'Wetland %',
    weight: '4%',
    description: 'Lower wetland coverage = higher score. Jurisdictional wetlands penalized further.',
    calculation: '>50% → 0, >30% → 15, >20% → 35, >10% → 55, >5% → 75, >0 → 90, none → 100; jurisdiction −8/−15',
  },
  {
    name: 'Interstate Distance',
    weight: '2%',
    description: 'Proximity to nearest interstate. Industrial and commercial zoning get a multiplier.',
    calculation: '≤0.5 mi → 100, ≤1 mi → 95, ≤2 mi → 85, ≤5 mi → 55, >15 mi → 3; ×1.20 industrial, ×1.10 commercial',
  },
]

const GRADE_BANDS = [
  { grade: 'A', range: '85 – 100', color: 'text-teal-400', description: 'Exceptional opportunity — strong buy signal' },
  { grade: 'B', range: '70 – 84', color: 'text-green-400', description: 'Good opportunity — warrants deeper analysis' },
  { grade: 'C', range: '50 – 69', color: 'text-yellow-400', description: 'Average — proceed with caution' },
  { grade: 'D', range: '30 – 49', color: 'text-orange-400', description: 'Below average — significant risks present' },
  { grade: 'F', range: '0 – 29', color: 'text-red-400', description: 'Poor — avoid or requires major discount' },
]

// ── Configs tab ───────────────────────────────────────────────────────────────

function ConfigCard({
  config,
  onEdit,
}: {
  config: ScoringConfig
  onEdit: (c: ScoringConfig) => void
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-100">{config.name}</span>
              {config.is_default && (
                <Badge variant="success" size="sm">Default</Badge>
              )}
              {!config.is_active && (
                <Badge variant="muted" size="sm">Inactive</Badge>
              )}
            </div>
            {config.description && (
              <p className="text-xs text-slate-400 mt-1">{config.description}</p>
            )}
            <p className="text-[10px] text-slate-500 mt-1.5">
              Created: {new Date(config.created_at).toLocaleDateString()}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => onEdit(config)}>
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Batch Scoring tab ─────────────────────────────────────────────────────────

function BatchScoringTab({ configs }: { configs: ScoringConfig[] }) {
  const [selectedId, setSelectedId] = useState<string>(
    configs.find((c) => c.is_default)?.id ?? configs[0]?.id ?? ''
  )
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleBatchScore() {
    setLoading(true)
    setStatus('idle')
    setMessage('')
    try {
      const res = await fetch('/api/webhooks/inngest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'property/batch-score.requested',
          data: { config_id: selectedId || null },
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStatus('success')
      setMessage('Batch scoring job triggered successfully. Monitor progress in the Inngest dashboard.')
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Failed to trigger batch score')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Run Batch Score</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-400">
            Re-score all properties using the selected config. This runs as a background job and may take
            several minutes depending on property count.
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-300">Scoring Config</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="h-9 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 px-3 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            >
              {configs.length === 0 && (
                <option value="">No configs available</option>
              )}
              {configs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.is_default ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="primary"
            onClick={handleBatchScore}
            loading={loading}
            disabled={!selectedId || configs.length === 0}
          >
            Run Batch Score
          </Button>

          {status === 'success' && (
            <p className="text-xs text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-lg px-3 py-2">
              {message}
            </p>
          )}
          {status === 'error' && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              Error: {message}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <p className="text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Last run:</span> Check the{' '}
            <a
              href="https://app.inngest.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-400 hover:text-teal-300"
            >
              Inngest dashboard
            </a>{' '}
            for run history and logs.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// ── How It Works tab ──────────────────────────────────────────────────────────

function HowItWorksTab() {
  return (
    <div className="space-y-8 max-w-3xl">
      {/* Factor table */}
      <Card>
        <CardHeader>
          <CardTitle>Scoring Factors</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/60">
                  <th className="text-left text-slate-400 font-medium px-5 py-3 w-40">Factor</th>
                  <th className="text-left text-slate-400 font-medium px-5 py-3 w-16">Weight</th>
                  <th className="text-left text-slate-400 font-medium px-5 py-3">Description</th>
                  <th className="text-left text-slate-400 font-medium px-5 py-3">Calculation</th>
                </tr>
              </thead>
              <tbody>
                {FACTORS.map((f, i) => (
                  <tr
                    key={f.name}
                    className={`border-b border-slate-700/40 last:border-0 ${i % 2 === 0 ? 'bg-slate-900/20' : ''}`}
                  >
                    <td className="px-5 py-3 font-medium text-slate-200 whitespace-nowrap">{f.name}</td>
                    <td className="px-5 py-3 text-teal-400 font-mono font-semibold">{f.weight}</td>
                    <td className="px-5 py-3 text-slate-400">{f.description}</td>
                    <td className="px-5 py-3 text-slate-500">{f.calculation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bonuses & Penalties */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Bonuses (max +10 pts)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li><span className="text-teal-400">+5</span> — HUD Opportunity Zone</li>
              <li><span className="text-teal-400">+4</span> — CRA district</li>
              <li><span className="text-teal-400">+4</span> — Assemblage potential</li>
              <li><span className="text-teal-400">+3</span> — Distressed with tax liens</li>
              <li><span className="text-teal-400">+2</span> — Out-of-state owner</li>
              <li><span className="text-teal-400">+2</span> — Vacant &amp; held ≥5 yrs</li>
              <li><span className="text-teal-400">+2</span> — Assessed/market ratio &lt;60%</li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Penalties (max −25 pts)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li><span className="text-red-400">−10</span> — Active lis pendens</li>
              <li><span className="text-red-400">−10</span> — No road frontage</li>
              <li><span className="text-red-400">−7</span> — Tax liens</li>
              <li><span className="text-red-400">−4</span> — Code violations</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Grade bands */}
      <Card>
        <CardHeader>
          <CardTitle>Score Grades (0–100 scale)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {GRADE_BANDS.map((g) => (
              <div key={g.grade} className="flex items-center gap-4">
                <span className={`text-lg font-bold w-6 ${g.color}`}>{g.grade}</span>
                <span className="text-xs font-mono text-slate-400 w-20">{g.range}</span>
                <span className="text-xs text-slate-400">{g.description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ScoringPage() {
  const [activeTab, setActiveTab] = useState<Tab>('configs')
  const [editingConfig, setEditingConfig] = useState<ScoringConfig | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { configs, isLoading, refetch } = useScoringConfigs()

  const tabs: { id: Tab; label: string }[] = [
    { id: 'configs', label: 'Configs' },
    { id: 'batch', label: 'Batch Scoring' },
    { id: 'how', label: 'How It Works' },
  ]

  function handleSaved() {
    setEditingConfig(null)
    setShowCreate(false)
    refetch()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Scoring Engine</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage scoring configurations, run batch jobs, and understand the 9-factor algorithm.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-700/60">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-teal-400 border-teal-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Configs tab */}
      {activeTab === 'configs' && (
        <div className="space-y-4 max-w-2xl">
          {isLoading && (
            <p className="text-sm text-slate-400">Loading configs...</p>
          )}

          {!isLoading && configs.length === 0 && (
            <p className="text-sm text-slate-400">No scoring configs found.</p>
          )}

          {configs.map((c) => (
            <div key={c.id}>
              <ConfigCard
                config={c}
                onEdit={(cfg) => {
                  setShowCreate(false)
                  setEditingConfig(cfg)
                }}
              />
              {editingConfig?.id === c.id && (
                <Card className="mt-2 border-teal-500/30">
                  <CardContent className="pt-4">
                    <p className="text-xs font-semibold text-slate-300 mb-4 uppercase tracking-wide">
                      Create new config based on: {c.name}
                    </p>
                    <ScoringConfigEditor
                      config={c}
                      onSave={handleSaved}
                      onCancel={() => setEditingConfig(null)}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          ))}

          {!showCreate ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setEditingConfig(null); setShowCreate(true) }}
            >
              + Create New Config
            </Button>
          ) : (
            <Card className="border-teal-500/30">
              <CardHeader>
                <CardTitle>New Scoring Config</CardTitle>
              </CardHeader>
              <CardContent>
                <ScoringConfigEditor
                  onSave={handleSaved}
                  onCancel={() => setShowCreate(false)}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Batch Scoring tab */}
      {activeTab === 'batch' && (
        <BatchScoringTab configs={configs} />
      )}

      {/* How It Works tab */}
      {activeTab === 'how' && (
        <HowItWorksTab />
      )}
    </div>
  )
}
