import { createAdminClient } from '@/lib/supabase/admin'
import type {
  Property,
  PropertyWithRelations,
  PropertyFilters,
  PaginationMeta,
} from '@/types/database'

const PAGE_SIZE = 50

// -----------------------------------------------------------------------------
// Search / list properties with filters
// -----------------------------------------------------------------------------

export interface PropertySearchResult {
  properties: PropertyWithRelations[]
  meta: PaginationMeta
}

export async function searchProperties(
  filters: PropertyFilters,
  cursor?: string,
  limit = PAGE_SIZE,
  sortBy: string = 'opportunity_score',
  sortDir: 'asc' | 'desc' = 'desc'
): Promise<PropertySearchResult> {
  const start = Date.now()
  const supabase = createAdminClient()

  let query = supabase
    .from('properties')
    .select(
      `
      *,
      county:counties(*),
      municipality:municipalities(*),
      parcel_data(*),
      current_owner:ownership!inner(*),
      zoning(*),
      listing:listings(*),
      flood_zone:flood_zones(*),
      wetland:wetlands(*),
      utility_access(*),
      opportunity_score:opportunity_scores(*)
    `,
      { count: 'exact' }
    )
    .eq('ownership.is_current', true)
    .eq('listings.is_current', true)
    .order(sortBy === 'opportunity_score' ? 'opportunity_scores.overall_score' : sortBy, {
      ascending: sortDir === 'asc',
    })
    .limit(limit)

  // Apply filters
  if (filters.counties?.length) {
    // Join via county name
    query = query.in('county.name', filters.counties)
  }

  if (filters.zoning_categories?.length) {
    query = query.in('zoning.zoning_category', filters.zoning_categories)
  }

  if (filters.lot_min_acres != null) {
    query = query.gte('lot_size_acres', filters.lot_min_acres)
  }

  if (filters.lot_max_acres != null) {
    query = query.lte('lot_size_acres', filters.lot_max_acres)
  }

  if (filters.score_min != null) {
    query = query.gte('opportunity_scores.overall_score', filters.score_min)
  }

  if (filters.score_max != null) {
    query = query.lte('opportunity_scores.overall_score', filters.score_max)
  }

  if (filters.vacant_only) {
    query = query.eq('is_vacant', true)
  }

  if (filters.listed_only) {
    query = query.eq('listings.status', 'active')
  }

  if (filters.exclude_flood) {
    query = query.eq('flood_zones.is_special_flood_hazard', false)
  }

  if (filters.opportunity_zone_only) {
    query = query.eq('opportunity_scores.in_opportunity_zone', true)
  }

  if (filters.cra_only) {
    query = query.eq('opportunity_scores.in_cra', true)
  }

  if (filters.distressed_only) {
    query = query.eq('is_distressed', true)
  }

  if (filters.price_min != null) {
    query = query.gte('parcel_data.land_value', filters.price_min)
  }

  if (filters.price_max != null) {
    query = query.lte('parcel_data.land_value', filters.price_max)
  }

  // Cursor-based pagination
  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  // Bounding box spatial filter — passed as raw SQL
  if (filters.bbox) {
    const [west, south, east, north] = filters.bbox
    query = query.filter(
      'location',
      'cs',
      `ST_MakeEnvelope(${west},${south},${east},${north},4326)`
    )
  }

  const { data, count, error } = await query

  if (error) throw new Error(`Property search failed: ${error.message}`)

  const properties = (data ?? []) as unknown as PropertyWithRelations[]
  const lastRecord = properties[properties.length - 1]

  return {
    properties,
    meta: {
      total: count ?? 0,
      cursor: lastRecord?.created_at ?? null,
      limit,
      took_ms: Date.now() - start,
    },
  }
}

// -----------------------------------------------------------------------------
// Get single property with all relations
// -----------------------------------------------------------------------------

export async function getPropertyById(id: string): Promise<PropertyWithRelations | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('properties')
    .select(
      `
      *,
      county:counties(*),
      municipality:municipalities(*),
      parcel_data(*),
      current_owner:ownership(*),
      zoning(*),
      listing:listings(*),
      flood_zone:flood_zones(*),
      wetland:wetlands(*),
      utility_access(*),
      opportunity_score:opportunity_scores(*)
    `
    )
    .eq('id', id)
    .eq('ownership.is_current', true)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to fetch property: ${error.message}`)
  }

  return data as unknown as PropertyWithRelations
}

// -----------------------------------------------------------------------------
// Get sales history for a property
// -----------------------------------------------------------------------------

export async function getPropertySalesHistory(propertyId: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('sales_history')
    .select('*')
    .eq('property_id', propertyId)
    .order('sale_date', { ascending: false })

  if (error) throw new Error(`Failed to fetch sales history: ${error.message}`)
  return data
}

// -----------------------------------------------------------------------------
// Get market comps for a property
// -----------------------------------------------------------------------------

export async function getPropertyComps(propertyId: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('market_comps')
    .select('*')
    .eq('reference_property_id', propertyId)
    .order('similarity_score', { ascending: false })
    .limit(10)

  if (error) throw new Error(`Failed to fetch comps: ${error.message}`)
  return data
}

// -----------------------------------------------------------------------------
// Get properties for map viewport (clustered / lightweight)
// -----------------------------------------------------------------------------

export async function getPropertiesForMap(
  bbox: [number, number, number, number],
  filters: PropertyFilters,
  maxResults = 500
): Promise<Pick<Property, 'id' | 'latitude' | 'longitude'>[]> {
  const supabase = createAdminClient()
  const [west, south, east, north] = bbox

  // Select only the fields needed for map markers
  let query = supabase
    .from('properties')
    .select('id, latitude, longitude, opportunity_scores(overall_score, score_grade)')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .gte('latitude', south)
    .lte('latitude', north)
    .gte('longitude', west)
    .lte('longitude', east)
    .limit(maxResults)

  if (filters.score_min != null) {
    query = query.gte('opportunity_scores.overall_score', filters.score_min)
  }

  if (filters.vacant_only) query = query.eq('is_vacant', true)

  const { data, error } = await query
  if (error) throw new Error(`Map query failed: ${error.message}`)

  return (data ?? []) as Pick<Property, 'id' | 'latitude' | 'longitude'>[]
}

// -----------------------------------------------------------------------------
// Dashboard KPI aggregates
// -----------------------------------------------------------------------------

export async function getDashboardKPIs(countyIds?: number[]) {
  const supabase = createAdminClient()

  const base = countyIds?.length
    ? supabase.from('properties').select('*', { count: 'exact', head: true }).in('county_id', countyIds)
    : supabase.from('properties').select('*', { count: 'exact', head: true })

  const [totalResult, vacantResult, scoredResult] = await Promise.all([
    base,
    supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('is_vacant', true),
    supabase
      .from('opportunity_scores')
      .select('overall_score')
      .not('overall_score', 'is', null)
      .order('overall_score', { ascending: false })
      .limit(1000),
  ])

  const scores = (scoredResult.data ?? []).map((r) => r.overall_score as number)
  const avgScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0

  return {
    total_properties: totalResult.count ?? 0,
    vacant_properties: vacantResult.count ?? 0,
    avg_opportunity_score: avgScore,
    top_score: scores[0] ?? 0,
  }
}
