'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, Heart, MapPin } from 'lucide-react'
import { useProperty } from '@/hooks/useProperty'
import { useFavorites } from '@/hooks/useFavorites'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge, GradeBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { FeasibilityCalculator } from '@/components/properties/FeasibilityCalculator'
import { PropertyComps } from '@/components/properties/PropertyComps'
import { AISummary } from '@/components/properties/AISummary'
import { PropertyNotes } from '@/components/properties/PropertyNotes'
import { formatCurrency, formatAcres, formatDate, formatAddress } from '@/lib/utils/format'

type Tab = 'overview' | 'financials' | 'comps' | 'ai' | 'notes'

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-slate-700/40 last:border-0">
      <span className="text-xs text-slate-400 shrink-0">{label}</span>
      <span className="text-xs text-slate-200 text-right">{value ?? '—'}</span>
    </div>
  )
}

export default function PropertyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : ''
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const { property, isLoading, error } = useProperty(id)
  const { favorites, addFavorite, removeFavorite } = useFavorites()

  const isFavorited = favorites.some((f) => f.property_id === id)

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !property) {
    return (
      <EmptyState
        title="Property not found"
        description="This property does not exist or you do not have access to it."
        action={
          <Button onClick={() => router.back()} variant="secondary" size="sm">
            Go back
          </Button>
        }
      />
    )
  }

  const score = property.opportunity_score
  const listing = property.listing
  const zoning = property.zoning
  const flood = property.flood_zone
  const wetland = property.wetland
  const utilities = property.utility_access
  const askPrice = listing?.list_price ?? property.parcel_data?.total_value
  const pricePerAcre =
    askPrice && property.lot_size_acres ? askPrice / property.lot_size_acres : null

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'financials', label: 'Financials' },
    { id: 'comps', label: 'Comps' },
    { id: 'ai', label: 'AI Summary' },
    { id: 'notes', label: 'Notes' },
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoreBreakdownKeys: { key: string; label: string }[] = [
    { key: 'location_score', label: 'Location' },
    { key: 'zoning_upside_score', label: 'Zoning Upside' },
    { key: 'value_dislocation_score', label: 'Value Dislocation' },
    { key: 'distress_signal_score', label: 'Distress Signal' },
    { key: 'environmental_risk_score', label: 'Environmental Risk' },
    { key: 'market_velocity_score', label: 'Market Velocity' },
    { key: 'utility_readiness_score', label: 'Utility Readiness' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Breadcrumb + back */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <nav className="text-xs text-slate-400 flex items-center gap-1.5">
          <span
            className="hover:text-slate-200 cursor-pointer"
            onClick={() => router.push('/search')}
          >
            Search
          </span>
          <span>/</span>
          <span className="text-slate-200 truncate max-w-xs">
            {formatAddress(
              property.address_street,
              property.address_city,
              property.address_state,
              property.address_zip
            )}
          </span>
        </nav>
      </div>

      {/* Header card */}
      <Card className="p-5">
        <div className="flex items-start gap-4">
          {score && (
            <div className="shrink-0">
              <GradeBadge
                grade={score.score_grade}
                score={score.overall_score}
                size="lg"
              />
              <p className="text-[10px] text-slate-400 text-center mt-1">Score</p>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <MapPin className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" />
              <h1 className="text-lg font-semibold text-slate-100 leading-tight">
                {formatAddress(
                  property.address_street,
                  property.address_city,
                  property.address_state,
                  property.address_zip
                )}
              </h1>
            </div>
            <div className="flex gap-2 flex-wrap mt-2">
              {property.county && (
                <Badge variant="info" size="sm">{property.county.name} County</Badge>
              )}
              {zoning?.zoning_code && (
                <Badge variant="default" size="sm">{zoning.zoning_code}</Badge>
              )}
              {listing ? (
                <Badge variant="success" size="sm">Listed</Badge>
              ) : (
                <Badge variant="muted" size="sm">Unlisted</Badge>
              )}
              {score?.in_opportunity_zone && (
                <Badge variant="warning" size="sm">Opportunity Zone</Badge>
              )}
              {score?.in_cra && (
                <Badge variant="warning" size="sm">CRA</Badge>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              isFavorited ? removeFavorite(id) : addFavorite(id)
            }
            className={`shrink-0 p-2 rounded-lg transition-colors ${
              isFavorited
                ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
                : 'text-slate-400 hover:text-red-400 hover:bg-slate-700'
            }`}
            aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart className="w-5 h-5" fill={isFavorited ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Key stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5">
          {[
            { label: 'Ask Price', value: formatCurrency(askPrice) },
            { label: 'Lot Size', value: formatAcres(property.lot_size_acres) },
            { label: 'Frontage', value: property.frontage_ft ? `${property.frontage_ft} ft` : '—' },
            { label: 'Depth', value: property.depth_ft ? `${property.depth_ft} ft` : '—' },
            { label: 'Price/Acre', value: formatCurrency(pricePerAcre) },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg bg-slate-900/60 px-3 py-2.5 text-center">
              <p className="text-[10px] text-slate-400 mb-0.5">{stat.label}</p>
              <p className="text-sm font-semibold text-slate-100">{stat.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Main layout: tabs + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-700/60">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors rounded-t-md ${
                  activeTab === tab.id
                    ? 'text-teal-400 border-b-2 border-teal-400 -mb-px'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Zoning details */}
              <Card>
                <CardHeader>
                  <CardTitle>Zoning Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DetailRow label="Zoning Code" value={zoning?.zoning_code} />
                  <DetailRow label="Description" value={zoning?.zoning_description} />
                  <DetailRow label="Category" value={zoning?.zoning_category} />
                  <DetailRow label="Max Height" value={zoning?.max_height_ft ? `${zoning.max_height_ft} ft` : null} />
                  <DetailRow label="Max Units/Acre" value={zoning?.max_density_units_per_acre?.toString()} />
                  <DetailRow label="Max FAR" value={zoning?.max_far?.toString()} />
                  <DetailRow
                    label="Setbacks"
                    value={
                      zoning
                        ? `F: ${zoning.setback_front_ft ?? '—'} ft  R: ${zoning.setback_rear_ft ?? '—'} ft  S: ${zoning.setback_side_ft ?? '—'} ft`
                        : null
                    }
                  />
                  <DetailRow label="Upzoning Potential" value={zoning?.upzoning_potential} />
                </CardContent>
              </Card>

              {/* Flood zone */}
              <Card>
                <CardHeader>
                  <CardTitle>Flood Zone</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DetailRow label="FEMA Zone Code" value={flood?.fema_zone_code} />
                  <DetailRow label="Panel Number" value={flood?.firm_panel_number} />
                  <DetailRow
                    label="Base Flood Elevation"
                    value={flood?.base_flood_elevation_ft != null ? `${flood.base_flood_elevation_ft} ft` : null}
                  />
                  <DetailRow
                    label="Special Flood Hazard"
                    value={flood != null ? (flood.is_special_flood_hazard ? 'Yes' : 'No') : null}
                  />
                  <DetailRow
                    label="Insurance Required"
                    value={flood != null ? (flood.flood_insurance_required ? 'Yes' : 'No') : null}
                  />
                </CardContent>
              </Card>

              {/* Utilities */}
              <Card>
                <CardHeader>
                  <CardTitle>Utilities</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DetailRow
                    label="Water"
                    value={
                      utilities != null
                        ? utilities.water_available
                          ? `Available${utilities.water_at_site ? ' (at site)' : ''}`
                          : 'Not available'
                        : null
                    }
                  />
                  <DetailRow
                    label="Sewer"
                    value={
                      utilities != null
                        ? utilities.sewer_available
                          ? `Available${utilities.sewer_at_site ? ' (at site)' : ''}`
                          : 'Not available'
                        : null
                    }
                  />
                  <DetailRow
                    label="Electric"
                    value={
                      utilities != null
                        ? utilities.electric_available
                          ? `Available${utilities.electric_three_phase ? ' (3-phase)' : ''}`
                          : 'Not available'
                        : null
                    }
                  />
                  <DetailRow
                    label="Gas"
                    value={
                      utilities != null
                        ? utilities.gas_available
                          ? `Available (${utilities.gas_provider ?? 'unknown provider'})`
                          : 'Not available'
                        : null
                    }
                  />
                  <DetailRow label="Road Frontage" value={utilities?.road_frontage_type} />
                  <DetailRow label="Road Name" value={utilities?.road_name} />
                </CardContent>
              </Card>

              {/* Location details */}
              <Card>
                <CardHeader>
                  <CardTitle>Location Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DetailRow
                    label="Coordinates"
                    value={
                      property.latitude != null && property.longitude != null
                        ? `${property.latitude.toFixed(6)}, ${property.longitude.toFixed(6)}`
                        : null
                    }
                  />
                  <DetailRow label="Parcel ID" value={property.parcel_id} />
                  <DetailRow label="Corner Lot" value={property.is_corner_lot ? 'Yes' : 'No'} />
                  <DetailRow label="Vacant" value={property.is_vacant ? 'Yes' : 'No'} />
                  <DetailRow label="Distressed" value={property.is_distressed ? 'Yes' : 'No'} />
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'financials' && (
            <FeasibilityCalculator property={property} />
          )}

          {activeTab === 'comps' && (
            <PropertyComps propertyId={id} />
          )}

          {activeTab === 'ai' && (
            <AISummary propertyId={id} property={property} />
          )}

          {activeTab === 'notes' && (
            <PropertyNotes propertyId={id} />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Listing info */}
          <Card>
            <CardHeader>
              <CardTitle>Listing Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <DetailRow label="Source" value={listing?.listing_source} />
              <DetailRow
                label="Listing URL"
                value={
                  listing?.listing_url ? (
                    <a
                      href={listing.listing_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-400 hover:text-teal-300 flex items-center gap-1"
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : null
                }
              />
              <DetailRow label="Listed Date" value={formatDate(listing?.list_date)} />
              <DetailRow
                label="Days on Market"
                value={listing?.days_on_market != null ? `${listing.days_on_market} days` : null}
              />
              <DetailRow label="Status" value={listing?.status} />
            </CardContent>
          </Card>

          {/* Opportunity Score Breakdown */}
          {score && (
            <Card>
              <CardHeader>
                <CardTitle>Score Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {scoreBreakdownKeys.map(({ key, label }) => {
                    const val = (score as unknown as Record<string, unknown>)[key] as number | null | undefined
                    if (val == null) return null
                    const pct = Math.min(100, Math.max(0, val))
                    return (
                      <div key={String(key)}>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-slate-400">{label}</span>
                          <span className="text-slate-300">{val.toFixed(1)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-teal-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Wetlands */}
          {wetland && (
            <Card>
              <CardHeader>
                <CardTitle>Wetlands</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <DetailRow
                  label="Has Wetlands"
                  value={
                    <Badge
                      variant={wetland.has_wetlands ? 'danger' : 'success'}
                      size="sm"
                    >
                      {wetland.has_wetlands ? 'Yes' : 'No'}
                    </Badge>
                  }
                />
                {wetland.wetland_pct != null && (
                  <DetailRow
                    label="Wetland %"
                    value={
                      <Badge
                        variant={
                          wetland.wetland_pct > 50
                            ? 'danger'
                            : wetland.wetland_pct > 20
                            ? 'warning'
                            : 'success'
                        }
                        size="sm"
                      >
                        {wetland.wetland_pct.toFixed(1)}%
                      </Badge>
                    }
                  />
                )}
                <DetailRow
                  label="SFWMD Jurisdiction"
                  value={wetland.sfwmd_jurisdiction ? 'Yes' : 'No'}
                />
                <DetailRow
                  label="Army Corps Jurisdiction"
                  value={wetland.army_corps_jurisdiction ? 'Yes' : 'No'}
                />
              </CardContent>
            </Card>
          )}

          {/* External Links */}
          <Card>
            <CardHeader>
              <CardTitle>External Links</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <a
                  href="#"
                  className="flex items-center gap-2 text-xs text-teal-400 hover:text-teal-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  County GIS
                </a>
                <a
                  href="#"
                  className="flex items-center gap-2 text-xs text-teal-400 hover:text-teal-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Property Appraiser
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
