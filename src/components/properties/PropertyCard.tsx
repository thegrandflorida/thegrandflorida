'use client'

import { MapPin, Heart, Ruler } from 'lucide-react'
import type { PropertyWithRelations } from '@/types/database'
import { formatCurrency, formatAcres } from '@/lib/utils/format'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

interface PropertyCardProps {
  property: PropertyWithRelations
  onFavoriteToggle?: (propertyId: string) => void
}

function getScoreBadgeVariant(score: number): 'danger' | 'warning' | 'success' | 'info' {
  if (score >= 85) return 'info'
  if (score >= 70) return 'success'
  if (score >= 50) return 'warning'
  return 'danger'
}

export function PropertyCard({ property, onFavoriteToggle }: PropertyCardProps) {
  const score = property.opportunity_score?.overall_score
  const listing = property.listing
  const floodZone = property.flood_zone
  const showFlood = floodZone?.fema_zone_code && floodZone.fema_zone_code !== 'X'
  const askPrice = listing?.list_price ?? property.parcel_data?.total_value
  const zoning = property.zoning?.zoning_code

  return (
    <Card hover className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-slate-100 font-medium text-sm truncate">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">
              {property.address_street ?? 'Address unavailable'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 pl-5">
            {[property.address_city, property.address_zip].filter(Boolean).join(', ') || '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onFavoriteToggle?.(property.id)}
          className="shrink-0 text-slate-500 hover:text-red-400 transition-colors p-1 -m-1"
          aria-label="Toggle favorite"
        >
          <Heart className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {score != null && (
          <Badge variant={getScoreBadgeVariant(score)} size="sm">
            Score {score.toFixed(0)}
          </Badge>
        )}
        {listing ? (
          <Badge variant="info" size="sm">Listed</Badge>
        ) : (
          <Badge variant="muted" size="sm">Unlisted</Badge>
        )}
        {showFlood && (
          <Badge variant="danger" size="sm">Flood {floodZone.fema_zone_code}</Badge>
        )}
        {zoning && (
          <Badge variant="default" size="sm">{zoning}</Badge>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-slate-900/60 px-2 py-1.5">
          <div className="flex items-center justify-center gap-1 text-slate-400 mb-0.5">
            <Ruler className="w-3 h-3" />
          </div>
          <p className="text-xs font-medium text-slate-200">{formatAcres(property.lot_size_acres)}</p>
        </div>
        <div className="rounded-lg bg-slate-900/60 px-2 py-1.5">
          <p className="text-[10px] text-slate-400 mb-0.5">Price</p>
          <p className="text-xs font-medium text-slate-200">{formatCurrency(askPrice, { compact: true })}</p>
        </div>
        <div className="rounded-lg bg-slate-900/60 px-2 py-1.5">
          <p className="text-[10px] text-slate-400 mb-0.5">County</p>
          <p className="text-xs font-medium text-slate-200 truncate">{property.county?.name ?? '—'}</p>
        </div>
      </div>
    </Card>
  )
}
