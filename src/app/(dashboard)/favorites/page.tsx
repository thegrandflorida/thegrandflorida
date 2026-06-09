'use client'

import { Heart } from 'lucide-react'
import { useFavorites } from '@/hooks/useFavorites'
import { useProperties } from '@/hooks/useProperties'
import { PropertyCard } from '@/components/properties/PropertyCard'
import { PropertyCardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

export default function FavoritesPage() {
  const { favorites, isLoading: favLoading, removeFavorite } = useFavorites()
  const favoriteIds = favorites.map((f) => f.property_id)

  const { properties, isLoading: propsLoading } = useProperties(
    favoriteIds.length ? { search: favoriteIds.join(',') } : {}
  )

  const favoritedProperties = properties.filter((p) => favoriteIds.includes(p.id))
  const isLoading = favLoading || propsLoading

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Favorites</h1>
        <p className="text-sm text-slate-400 mt-1">Properties you&apos;ve saved for later.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <PropertyCardSkeleton key={i} />
          ))}
        </div>
      ) : favoritedProperties.length === 0 ? (
        <EmptyState
          icon={<Heart />}
          title="No favorites yet"
          description="Heart a property to save it here for quick access."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {favoritedProperties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onFavoriteToggle={(id) => removeFavorite(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
