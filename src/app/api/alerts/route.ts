import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/utils/auth'
import { errorResponse, successResponse, Errors } from '@/lib/utils/errors'
import { getUserAlerts, markAlertsRead } from '@/lib/db/users'

const AlertsQuerySchema = z.object({
  unread_only: z.coerce.boolean().optional().default(false),
})

const MarkReadSchema = z.object({
  alert_ids: z.array(z.string().uuid()),
})

export async function GET(request: NextRequest) {
  try {
    const { authUser } = await requireAuth()

    const parsed = AlertsQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams)
    )

    const unreadOnly = parsed.success ? parsed.data.unread_only : false
    const alerts = await getUserAlerts(authUser.id, unreadOnly)

    return successResponse(alerts)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    return errorResponse(Errors.INTERNAL())
  }
}

// PATCH /api/alerts — mark one or more alerts as read
export async function PATCH(request: NextRequest) {
  try {
    const { authUser } = await requireAuth()

    const body = await request.json()
    const parsed = MarkReadSchema.safeParse(body)

    if (!parsed.success) {
      return errorResponse(Errors.VALIDATION('Invalid payload', parsed.error.flatten()))
    }

    await markAlertsRead(authUser.id, parsed.data.alert_ids)
    return successResponse({ marked_read: parsed.data.alert_ids.length })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    return errorResponse(Errors.INTERNAL())
  }
}
