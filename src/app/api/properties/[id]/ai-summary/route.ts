import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import { errorResponse, successResponse, Errors } from '@/lib/utils/errors'
import { getPropertyById } from '@/lib/db/properties'
import { generatePropertySummary } from '@/lib/ai/summarize'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params {
  params: Promise<{ id: string }>
}

// POST /api/properties/[id]/ai-summary
// Generates or refreshes the GPT-4o AI deal narrative for a property.
// Cached for 7 days — returns existing summary if fresh.
export async function POST(_request: NextRequest, { params }: Params) {
  try {
    await requireAuth()

    const { id } = await params
    const property = await getPropertyById(id)

    if (!property) {
      return errorResponse(Errors.NOT_FOUND)
    }

    // Check if existing summary is still fresh (< 7 days old)
    const supabase = createAdminClient()
    const { data: existingScore } = await supabase
      .from('opportunity_scores')
      .select('ai_summary, ai_risk_analysis, ai_upside_analysis, scored_at')
      .eq('property_id', id)
      .single()

    if (existingScore?.ai_summary && existingScore.scored_at) {
      const scoredAt = new Date(existingScore.scored_at)
      const ageMs = Date.now() - scoredAt.getTime()
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

      if (ageMs < sevenDaysMs) {
        return successResponse({
          summary: existingScore.ai_summary,
          risk_analysis: existingScore.ai_risk_analysis,
          upside_analysis: existingScore.ai_upside_analysis,
          cached: true,
          scored_at: existingScore.scored_at,
        })
      }
    }

    // Generate fresh summary
    const result = await generatePropertySummary(property)

    // Persist to opportunity_scores
    await supabase
      .from('opportunity_scores')
      .upsert(
        {
          property_id: id,
          ai_summary: result.summary,
          ai_risk_analysis: result.risk_analysis,
          ai_upside_analysis: result.upside_analysis,
          scored_at: new Date().toISOString(),
        },
        { onConflict: 'property_id' }
      )

    return successResponse({ ...result, cached: false })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    console.error('[POST /api/properties/[id]/ai-summary]', err)
    return errorResponse(Errors.INTERNAL())
  }
}
