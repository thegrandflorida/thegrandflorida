import { NextRequest } from 'next/server'
import { z } from 'zod'
import { searchProperties } from '@/lib/db/properties'
import { requireAuth } from '@/lib/utils/auth'
import { errorResponse, successResponse, Errors } from '@/lib/utils/errors'
import type { PropertyFilters } from '@/types/database'

const SearchQuerySchema = z.object({
  counties: z.string().optional(),
  zoning_categories: z.string().optional(),
  lot_min_acres: z.coerce.number().min(0).optional(),
  lot_max_acres: z.coerce.number().min(0).optional(),
  price_min: z.coerce.number().min(0).optional(),
  price_max: z.coerce.number().min(0).optional(),
  score_min: z.coerce.number().min(0).max(100).optional(),
  score_max: z.coerce.number().min(0).max(100).optional(),
  vacant_only: z.coerce.boolean().optional(),
  listed_only: z.coerce.boolean().optional(),
  exclude_flood: z.coerce.boolean().optional(),
  opportunity_zone_only: z.coerce.boolean().optional(),
  cra_only: z.coerce.boolean().optional(),
  distressed_only: z.coerce.boolean().optional(),
  no_wetlands: z.coerce.boolean().optional(),
  search: z.string().max(200).optional(),
  bbox: z.string().optional(), // "west,south,east,north"
  sort_by: z
    .enum(['opportunity_score', 'price', 'lot_size_acres', 'days_on_market', 'created_at'])
    .optional()
    .default('opportunity_score'),
  sort_dir: z.enum(['asc', 'desc']).optional().default('desc'),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).optional().default(50),
})

export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = request.nextUrl
    const parsed = SearchQuerySchema.safeParse(Object.fromEntries(searchParams))

    if (!parsed.success) {
      return errorResponse(Errors.VALIDATION('Invalid query parameters', parsed.error.flatten()))
    }

    const q = parsed.data

    const filters: PropertyFilters = {
      counties: q.counties?.split(',').filter(Boolean),
      zoning_categories: q.zoning_categories?.split(',').filter(Boolean) as PropertyFilters['zoning_categories'],
      lot_min_acres: q.lot_min_acres,
      lot_max_acres: q.lot_max_acres,
      price_min: q.price_min,
      price_max: q.price_max,
      score_min: q.score_min,
      score_max: q.score_max,
      vacant_only: q.vacant_only,
      listed_only: q.listed_only,
      exclude_flood: q.exclude_flood,
      opportunity_zone_only: q.opportunity_zone_only,
      cra_only: q.cra_only,
      distressed_only: q.distressed_only,
      no_wetlands: q.no_wetlands,
      search: q.search,
      bbox: q.bbox
        ? (q.bbox.split(',').map(Number) as [number, number, number, number])
        : undefined,
    }

    const result = await searchProperties(filters, q.cursor, q.limit, q.sort_by, q.sort_dir)

    return successResponse(result.properties, result.meta)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    console.error('[GET /api/properties]', err)
    return errorResponse(Errors.INTERNAL())
  }
}
