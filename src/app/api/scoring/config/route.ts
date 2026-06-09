import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/utils/auth'
import { errorResponse, successResponse, Errors } from '@/lib/utils/errors'
import { createAdminClient } from '@/lib/supabase/admin'

const WeightsSchema = z.object({
  price_per_acre: z.number().min(0).max(1),
  zoning_flexibility: z.number().min(0).max(1),
  population_growth: z.number().min(0).max(1),
  flood_risk: z.number().min(0).max(1),
  comparable_sales: z.number().min(0).max(1),
  development_activity: z.number().min(0).max(1),
  utility_access: z.number().min(0).max(1),
  wetland_pct: z.number().min(0).max(1),
  interstate_distance: z.number().min(0).max(1),
}).refine(
  (w) => {
    const sum = Object.values(w).reduce((a, b) => a + b, 0)
    return Math.abs(sum - 1.0) < 0.01 // allow small floating point drift
  },
  { message: 'Weights must sum to 1.0' }
)

const CreateConfigSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  is_default: z.boolean().optional().default(false),
  weights: WeightsSchema,
  thresholds: z
    .object({ A: z.number(), B: z.number(), C: z.number(), D: z.number() })
    .optional(),
})

// GET — list all active scoring configs (any authenticated user)
export async function GET() {
  try {
    // Admin only for write, but any user can read configs to understand scoring
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('scoring_configs')
      .select('*')
      .eq('is_active', true)
      .order('is_default', { ascending: false })

    if (error) throw error
    return successResponse(data)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    return errorResponse(Errors.INTERNAL())
  }
}

// POST — create a new scoring config (admin only)
export async function POST(request: NextRequest) {
  try {
    const { authUser } = await requireRole('admin')

    const body = await request.json()
    const parsed = CreateConfigSchema.safeParse(body)

    if (!parsed.success) {
      return errorResponse(Errors.VALIDATION('Invalid scoring config', parsed.error.flatten()))
    }

    const supabase = createAdminClient()

    // If new config is default, demote the current default
    if (parsed.data.is_default) {
      await supabase
        .from('scoring_configs')
        .update({ is_default: false })
        .eq('is_default', true)
    }

    const { data, error } = await supabase
      .from('scoring_configs')
      .insert({ ...parsed.data, created_by: authUser.id })
      .select()
      .single()

    if (error) throw error

    return successResponse(data, undefined, 201)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    return errorResponse(Errors.INTERNAL())
  }
}
