import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import { errorResponse, successResponse, Errors } from '@/lib/utils/errors'
import { getPropertyComps, getPropertySalesHistory } from '@/lib/db/properties'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireAuth()

    const { id } = await params

    const [comps, salesHistory] = await Promise.all([
      getPropertyComps(id),
      getPropertySalesHistory(id),
    ])

    return successResponse({ comps, sales_history: salesHistory })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    console.error('[GET /api/properties/[id]/comps]', err)
    return errorResponse(Errors.INTERNAL())
  }
}
