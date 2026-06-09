import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/utils/auth'
import { errorResponse, successResponse, Errors } from '@/lib/utils/errors'
import { getDashboardKPIs } from '@/lib/db/properties'

const KPIQuerySchema = z.object({
  county_ids: z.string().optional(), // comma-separated integers
})

export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = request.nextUrl
    const parsed = KPIQuerySchema.safeParse(Object.fromEntries(searchParams))

    if (!parsed.success) {
      return errorResponse(Errors.VALIDATION('Invalid query'))
    }

    const countyIds = parsed.data.county_ids
      ? parsed.data.county_ids.split(',').map(Number).filter(Boolean)
      : undefined

    const kpis = await getDashboardKPIs(countyIds)

    return successResponse(kpis)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    return errorResponse(Errors.INTERNAL())
  }
}
