'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Map, {
  NavigationControl,
  ScaleControl,
  GeolocateControl,
  Source,
  Layer,
  type MapRef,
} from 'react-map-gl/mapbox'
import type { MapMouseEvent } from 'react-map-gl/mapbox'
import type { LayerProps } from 'react-map-gl/mapbox'
import type { GeoJSON } from 'geojson'
import type { PropertyFilters } from '@/types/database'
import { MapLegend } from './MapLegend'
import { MapControls } from './MapControls'
import { PropertyPopup } from './PropertyPopup'

interface MapPoint {
  property_id: string
  latitude: number
  longitude: number
  opportunity_score: number | null
}

interface SelectedFeature {
  propertyId: string
  latitude: number
  longitude: number
}

interface MapViewProps {
  filters: Partial<PropertyFilters>
  onPropertySelect: (propertyId: string) => void
}

function pointsToGeoJSON(points: MapPoint[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [p.longitude, p.latitude],
      },
      properties: {
        property_id: p.property_id,
        opportunity_score: p.opportunity_score ?? -1,
      },
    })),
  }
}

const clusterLayer: LayerProps = {
  id: 'clusters',
  type: 'circle',
  source: 'properties',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': '#475569',
    'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 28],
    'circle-stroke-width': 2,
    'circle-stroke-color': '#64748b',
  },
}

const clusterCountLayer: LayerProps = {
  id: 'cluster-count',
  type: 'symbol',
  source: 'properties',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
    'text-size': 12,
  },
  paint: {
    'text-color': '#e2e8f0',
  },
}

const unclusteredPointLayer: LayerProps = {
  id: 'unclustered-point',
  type: 'circle',
  source: 'properties',
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-radius': ['case', ['boolean', ['feature-state', 'hover'], false], 12, 8],
    'circle-color': [
      'case',
      ['>=', ['get', 'opportunity_score'], 85], '#14b8a6',
      ['>=', ['get', 'opportunity_score'], 70], '#84cc16',
      ['>=', ['get', 'opportunity_score'], 50], '#f59e0b',
      '#ef4444',
    ],
    'circle-stroke-width': 1.5,
    'circle-stroke-color': '#1e293b',
  },
}

export function MapView({ filters, onPropertySelect }: MapViewProps) {
  const mapRef = useRef<MapRef>(null)
  const [points, setPoints] = useState<MapPoint[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFeature, setSelectedFeature] = useState<SelectedFeature | null>(null)
  const [autoSearch, setAutoSearch] = useState(true)
  const [showManualButton, setShowManualButton] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | number | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchPoints = useCallback(async () => {
    const map = mapRef.current
    if (!map) return

    const bounds = map.getBounds()
    if (!bounds) return

    const bbox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ].join(',')

    const params = new URLSearchParams({ bbox })
    if (filters.counties?.length) params.set('counties', filters.counties.join(','))
    if (filters.price_min != null) params.set('price_min', String(filters.price_min))
    if (filters.price_max != null) params.set('price_max', String(filters.price_max))
    if (filters.lot_min_acres != null) params.set('lot_min_acres', String(filters.lot_min_acres))
    if (filters.lot_max_acres != null) params.set('lot_max_acres', String(filters.lot_max_acres))
    if (filters.score_min != null) params.set('score_min', String(filters.score_min))
    if (filters.vacant_only) params.set('vacant_only', 'true')
    if (filters.exclude_flood) params.set('exclude_flood', 'true')
    if (filters.opportunity_zone_only) params.set('opportunity_zone_only', 'true')

    setIsLoading(true)
    try {
      const res = await fetch(`/api/properties/map?${params.toString()}`)
      if (!res.ok) return
      const json = await res.json()
      setPoints(json.data ?? [])
    } catch {
      // silently ignore network errors
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  const scheduleFetch = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(fetchPoints, 300)
  }, [fetchPoints])

  // Re-fetch when filters change
  useEffect(() => {
    scheduleFetch()
  }, [scheduleFetch])

  const handleMoveEnd = useCallback(() => {
    if (autoSearch) {
      scheduleFetch()
    } else {
      setShowManualButton(true)
    }
  }, [autoSearch, scheduleFetch])

  const handleManualSearch = useCallback(() => {
    setShowManualButton(false)
    fetchPoints()
  }, [fetchPoints])

  const handleToggleAutoSearch = useCallback(() => {
    setAutoSearch((prev) => !prev)
    setShowManualButton(false)
  }, [])

  const handleClick = useCallback(
    (e: MapMouseEvent) => {
      const map = mapRef.current
      if (!map) return

      const features = map.queryRenderedFeatures(e.point, {
        layers: ['unclustered-point', 'clusters'],
      })

      if (!features.length) {
        setSelectedFeature(null)
        return
      }

      const feature = features[0]

      // Handle cluster click — zoom in
      if (feature.layer?.id === 'clusters') {
        const clusterId = feature.properties?.cluster_id as number
        const source = map.getSource('properties') as mapboxgl.GeoJSONSource | undefined
        if (source && 'getClusterExpansionZoom' in source) {
          ;(source as { getClusterExpansionZoom: (id: number, cb: (err: unknown, zoom: number) => void) => void }).getClusterExpansionZoom(
            clusterId,
            (err, zoom) => {
              if (err) return
              const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number]
              map.easeTo({ center: coords, zoom })
            }
          )
        }
        return
      }

      // Handle point click
      const propertyId = feature.properties?.property_id as string | undefined
      if (!propertyId) return

      const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number]
      setSelectedFeature({ propertyId, longitude: coords[0], latitude: coords[1] })
      onPropertySelect(propertyId)
    },
    [onPropertySelect]
  )

  const handleMouseEnter = useCallback((e: MapMouseEvent) => {
    const map = mapRef.current
    if (!map) return
    map.getCanvas().style.cursor = 'pointer'

    const features = map.queryRenderedFeatures(e.point, { layers: ['unclustered-point'] })
    if (features.length && features[0].id != null) {
      if (hoveredId != null) {
        map.setFeatureState({ source: 'properties', id: hoveredId }, { hover: false })
      }
      setHoveredId(features[0].id)
      map.setFeatureState({ source: 'properties', id: features[0].id }, { hover: true })
    }
  }, [hoveredId])

  const handleMouseLeave = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    map.getCanvas().style.cursor = ''

    if (hoveredId != null) {
      map.setFeatureState({ source: 'properties', id: hoveredId }, { hover: false })
      setHoveredId(null)
    }
  }, [hoveredId])

  const geojson = pointsToGeoJSON(points)

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        initialViewState={{
          latitude: 26.7,
          longitude: -80.1,
          zoom: 9,
        }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        onMoveEnd={handleMoveEnd}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        interactiveLayerIds={['unclustered-point', 'clusters']}
        onLoad={fetchPoints}
      >
        <NavigationControl position="top-right" />
        <GeolocateControl position="top-right" />
        <ScaleControl position="bottom-left" />

        <Source
          id="properties"
          type="geojson"
          data={geojson}
          cluster={true}
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          <Layer {...clusterLayer} />
          <Layer {...clusterCountLayer} />
          <Layer {...unclusteredPointLayer} />
        </Source>

        {selectedFeature && (
          <PropertyPopup
            propertyId={selectedFeature.propertyId}
            latitude={selectedFeature.latitude}
            longitude={selectedFeature.longitude}
            onClose={() => setSelectedFeature(null)}
          />
        )}
      </Map>

      <MapControls
        autoSearch={autoSearch}
        onToggle={handleToggleAutoSearch}
        onManualSearch={handleManualSearch}
        showManualButton={showManualButton}
      />

      <MapLegend />

      {isLoading && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/85 backdrop-blur-sm px-3 py-2">
          <svg
            className="w-3.5 h-3.5 animate-spin text-teal-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <span className="text-xs text-slate-400">Loading…</span>
        </div>
      )}
    </div>
  )
}
