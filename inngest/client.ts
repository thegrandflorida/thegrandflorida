import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'florida-builder-deal-finder',
  name: 'Florida Builder Deal Finder',
})

// Typed event definitions
export type Events = {
  'property/score.requested': {
    data: { property_id: string; config_id?: string }
  }
  'property/batch-score.requested': {
    data: { county_id?: number; limit?: number }
  }
  'email/daily-digest.send': {
    data: { user_id?: string } // if omitted, sends to all eligible users
  }
  'sync/county-pa.trigger': {
    data: { county_id: number; full_load?: boolean }
  }
}
