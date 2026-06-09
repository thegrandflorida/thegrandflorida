'use client'

import { Zap } from 'lucide-react'
import { useProperties } from '@/hooks/useProperties'
import { PropertyCard } from '@/components/properties/PropertyCard'
import { PropertyCardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

export function OpportunityFeed() {
  const { properties, isLoading } = useProperties({ score_min: 0 })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <PropertyCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!properties.length) {
    return (
      <EmptyState
        icon={<Zap />}
        title="No opportunities found"
        description="No scored properties match your current criteria."
      />
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {properties.map((property) => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </div>
  )
}
