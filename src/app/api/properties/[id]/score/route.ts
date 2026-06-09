import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import { errorResponse, successResponse, Errors } from '@/lib/utils/errors'
import { getPropertyById } from '@/lib/db/properties'
import { scoreProperty } from '@/lib/scoring/engine'

interface Params {
  params: Promise<{ id: string }>
}

// POST /api/properties/[id]/score
// Triggers an on-demand re-score of a single property.
export async function POST(_request: NextRequest, { params }: Params) {
  try {
    await requireAuth()

    const { id } = await params
    const property = await getPropertyById(id)

    if (!property) {
      return errorResponse(Errors.NOT_FOUND)
    }

    const score = await scoreProperty(property)

    return successResponse(score)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    console.error('[POST /api/properties/[id]/score]', err)
    return errorResponse(Errors.INTERNAL())
  }
}
