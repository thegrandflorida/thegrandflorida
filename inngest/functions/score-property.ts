/* eslint-disable @typescript-eslint/no-explicit-any */
import { inngest } from '../client'
import { getPropertyById } from '@/lib/db/properties'
import { scoreProperty } from '@/lib/scoring/engine'
import { createAdminClient } from '@/lib/supabase/admin'

export const scorePropertyFunction = inngest.createFunction(
  {
    id: 'score-property',
    name: 'Score Single Property',
    concurrency: { limit: 10 },
    retries: 2,
    triggers: [{ event: 'property/score.requested' }],
  } as any,
  async ({ event, step }: any) => {
    const { property_id, config_id } = event.data as {
      property_id: string
      config_id?: string
    }

    const property = await step.run('fetch-property', () =>
      getPropertyById(property_id)
    )

    if (!property) {
      return { skipped: true, reason: 'Property not found', property_id }
    }

    const config = await step.run('fetch-config', async () => {
      if (!config_id) return null
      const supabase = createAdminClient()
      const { data } = await supabase
        .from('scoring_configs')
        .select('*')
        .eq('id', config_id)
        .single()
      return data
    })

    const score = await step.run('compute-score', () =>
      scoreProperty(property, config ?? undefined)
    )

    return { scored: true, property_id, overall_score: score.overall_score }
  }
)
