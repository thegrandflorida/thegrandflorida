import { NextRequest } from 'next/server'
import { getPropertyById } from '@/lib/db/properties'
import { requireAuth } from '@/lib/utils/auth'
import { errorResponse, successResponse, Errors } from '@/lib/utils/errors'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireAuth()

    const { id } = await params

    if (!id || typeof id !== 'string') {
      return errorResponse(Errors.VALIDATION('Invalid property ID'))
    }

    const property = await getPropertyById(id)

    if (!property) {
      return errorResponse(Errors.NOT_FOUND)
    }

    return successResponse(property)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    console.error('[GET /api/properties/[id]]', err)
    return errorResponse(Errors.INTERNAL())
  }
}
