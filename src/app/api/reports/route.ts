import { requireAuth } from '@/lib/utils/auth'
import { errorResponse, successResponse, Errors } from '@/lib/utils/errors'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/reports — user's email report history
export async function GET() {
  try {
    const { authUser } = await requireAuth()

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('email_reports')
      .select('id, report_type, subject, status, sent_at, opened_at, property_ids, created_at')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return successResponse(data)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    return errorResponse(Errors.INTERNAL())
  }
}
