import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/utils/auth'
import { errorResponse, successResponse, Errors } from '@/lib/utils/errors'
import { getPropertiesForMap } from '@/lib/db/properties'
import type { PropertyFilters } from '@/types/database'

const MapQuerySchema = z.object({
  bbox: z.string().regex(/^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/),
  score_min: z.coerce.number().min(0).max(100).optional(),
  vacant_only: z.coerce.boolean().optional(),
  listed_only: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(2000).optional().default(500),
})

// GET /api/properties/map
// Returns lightweight point data for Mapbox markers.
// Optimized for speed — only returns id, lat, lon, score, grade.
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = request.nextUrl
    const parsed = MapQuerySchema.safeParse(Object.fromEntries(searchParams))

    if (!parsed.success) {
      return errorResponse(Errors.VALIDATION('Invalid map query', parsed.error.flatten()))
    }

    const q = parsed.data
    const bbox = q.bbox.split(',').map(Number) as [number, number, number, number]

    const filters: PropertyFilters = {
      score_min: q.score_min,
      vacant_only: q.vacant_only,
      listed_only: q.listed_only,
    }

    const properties = await getPropertiesForMap(bbox, filters, q.limit)

    return successResponse(properties)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    console.error('[GET /api/properties/map]', err)
    return errorResponse(Errors.INTERNAL())
  }
}
