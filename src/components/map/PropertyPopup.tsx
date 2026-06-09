'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import { Popup } from 'react-map-gl/mapbox'
import { useProperty } from '@/hooks/useProperty'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatCurrency, formatAcres } from '@/lib/utils/format'

interface PropertyPopupProps {
  propertyId: string
  latitude: number
  longitude: number
  onClose: () => void
}

export function PropertyPopup({ propertyId, latitude, longitude, onClose }: PropertyPopupProps) {
  const { property, isLoading } = useProperty(propertyId)

  const score = property?.opportunity_score?.overall_score ?? null
  const scoreVariant =
    score == null ? 'muted'
    : score >= 85 ? 'info'
    : score >= 70 ? 'success'
    : score >= 50 ? 'warning'
    : 'danger'

  return (
    <Popup
      latitude={latitude}
      longitude={longitude}
      onClose={onClose}
      closeButton={false}
      closeOnClick={false}
      anchor="bottom"
      maxWidth="280px"
      className="mapbox-popup-dark"
    >
      <div className="rounded-lg border border-slate-700/60 bg-slate-900 p-3 min-w-[240px] text-sm">
        <div className="flex items-start justify-between gap-2 mb-2">
          {isLoading ? (
            <Skeleton className="h-4 w-40" />
          ) : (
            <p className="font-semibold text-slate-200 leading-tight">
              {property?.address_street ?? 'Unknown address'}
              {property?.address_city ? `, ${property.address_city}` : ''}
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        ) : (
          <div className="space-y-1.5 text-slate-400">
            {property?.listing?.list_price != null && (
              <p className="text-teal-400 font-semibold">
                {formatCurrency(property.listing.list_price)}
              </p>
            )}
            {property?.lot_size_acres != null && (
              <p>{formatAcres(property.lot_size_acres)}</p>
            )}
            {property?.zoning?.zoning_code && (
              <p>Zoning: <span className="text-slate-300">{property.zoning.zoning_code}</span></p>
            )}
            <div className="flex items-center gap-2 pt-1">
              {score != null && (
                <Badge variant={scoreVariant} size="sm">
                  Score {score.toFixed(0)}
                </Badge>
              )}
              {property?.zoning?.zoning_category && (
                <Badge variant="muted" size="sm">
                  {property.zoning.zoning_category}
                </Badge>
              )}
            </div>
          </div>
        )}

        {!isLoading && property && (
          <div className="mt-3">
            <Link href={`/properties/${propertyId}`}>
              <Button size="sm" className="w-full">
                View Details
              </Button>
            </Link>
          </div>
        )}
      </div>
    </Popup>
  )
}
