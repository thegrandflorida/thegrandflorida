'use client'

import { Building2, TrendingUp, List, Star } from 'lucide-react'
import { useKPIs } from '@/hooks/useKPIs'
import { KPICard } from '@/components/dashboard/KPICard'
import { OpportunityFeed } from '@/components/dashboard/OpportunityFeed'
import { formatNumber } from '@/lib/utils/format'

export default function DashboardPage() {
  const { kpis, isLoading } = useKPIs()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Deal Finder</h1>
        <p className="text-sm text-slate-400 mt-1">Discover high-opportunity land deals across South Florida.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Properties"
          value={kpis ? formatNumber(kpis.total_properties) : '—'}
          icon={<Building2 className="w-4 h-4" />}
          loading={isLoading}
        />
        <KPICard
          title="Avg Opportunity Score"
          value={kpis ? kpis.avg_opportunity_score.toFixed(1) : '—'}
          icon={<TrendingUp className="w-4 h-4" />}
          loading={isLoading}
        />
        <KPICard
          title="Active Listings"
          value={kpis ? formatNumber(kpis.active_listings) : '—'}
          icon={<List className="w-4 h-4" />}
          loading={isLoading}
        />
        <KPICard
          title="High-Score Properties"
          subtitle="Score ≥ 85"
          value={kpis ? formatNumber(kpis.high_score_properties) : '—'}
          icon={<Star className="w-4 h-4" />}
          loading={isLoading}
        />
      </div>

      <div>
        <h2 className="text-base font-semibold text-slate-200 mb-4">Top Opportunities</h2>
        <OpportunityFeed />
      </div>
    </div>
  )
}
