import OpenAI from 'openai'
import type { PropertyWithRelations } from '@/types/database'
import { formatCurrency, formatAcres } from '@/lib/utils/format'

let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _client
}

export interface PropertySummaryResult {
  summary: string
  risk_analysis: string
  upside_analysis: string
  risk_flags: string[]
  upside_flags: string[]
}

// Build a structured property context string for the prompt
function buildPropertyContext(property: PropertyWithRelations): string {
  const p = property
  const pd = p.parcel_data
  const z = p.zoning
  const fz = p.flood_zone
  const w = p.wetland
  const u = p.utility_access
  const os = p.opportunity_score
  const o = p.current_owner
  const listing = p.listing

  return `
PROPERTY CONTEXT
================
Address: ${p.address_street ?? 'N/A'}, ${p.address_city ?? 'N/A'}, FL ${p.address_zip ?? ''}
County: ${p.county?.name ?? 'Unknown'}
Parcel ID: ${p.parcel_id}

PHYSICAL
- Lot size: ${formatAcres(p.lot_size_acres)} (${p.lot_size_sqft?.toLocaleString() ?? 'N/A'} sf)
- Frontage: ${p.frontage_ft ?? 'N/A'} ft | Depth: ${p.depth_ft ?? 'N/A'} ft
- Corner lot: ${p.is_corner_lot ? 'Yes' : 'No'} | Vacant: ${p.is_vacant ? 'Yes' : 'No'}
- Building: ${pd?.building_sqft?.toLocaleString() ?? 'None'} sf, ${pd?.year_built ? `built ${pd.year_built}` : 'N/A'}

VALUATION
- Assessed value: ${formatCurrency(pd?.assessed_value)}
- Land value: ${formatCurrency(pd?.land_value)}
- Price/acre: ${formatCurrency(pd?.price_per_acre)}
- Annual taxes: ${formatCurrency(pd?.annual_taxes)}
- Tax year: ${pd?.tax_year ?? 'N/A'}

OWNERSHIP
- Owner: ${o?.owner_name ?? 'Unknown'} (${o?.owner_type ?? 'unknown type'})
- Out-of-state: ${o?.is_out_of_state_owner ? 'Yes' : 'No'} | Corporate: ${o?.is_corporate_owner ? 'Yes' : 'No'}
- Years owned: ${o?.years_owned ?? 'N/A'}
- Homesteaded: ${o?.is_homesteaded ? 'Yes' : 'No'}

ZONING
- Current: ${z?.zoning_code ?? 'N/A'} — ${z?.zoning_description ?? ''}
- Category: ${z?.zoning_category ?? 'N/A'}
- Future Land Use: ${z?.future_land_use ?? 'N/A'} (${z?.flu_category ?? 'N/A'})
- Max density: ${z?.max_density_units_per_acre ?? 'N/A'} units/acre
- Max FAR: ${z?.max_far ?? 'N/A'} | Max height: ${z?.max_height_stories ?? 'N/A'} stories
- Upzoning potential: ${z?.upzoning_potential ?? 'N/A'}
- Overlay districts: ${z?.overlay_districts?.join(', ') ?? 'None'}

ENVIRONMENTAL
- FEMA zone: ${fz?.fema_zone_code ?? 'N/A'} — ${fz?.is_special_flood_hazard ? 'SPECIAL FLOOD HAZARD AREA' : 'Not in SFHA'}
- Pct in flood zone: ${fz?.pct_parcel_in_flood_zone ?? 0}%
- Wetlands: ${w?.has_wetlands ? `Yes — ${w.wetland_pct}% of parcel` : 'None'}
- SFWMD jurisdiction: ${w?.sfwmd_jurisdiction ? 'Yes' : 'No'}
- Army Corps: ${w?.army_corps_jurisdiction ? 'Yes' : 'No'}

UTILITIES
- Water: ${u?.water_at_site ? 'At site' : u?.water_available ? 'Available nearby' : 'Not available'}
- Sewer: ${u?.sewer_at_site ? 'At site' : u?.sewer_available ? 'Available nearby' : u?.septic_permitted ? 'Septic only' : 'Not available'}
- Road: ${u?.road_frontage_type ?? 'N/A'} (${u?.road_classification ?? 'N/A'})
- Electric: ${u?.electric_available ? 'Available' : 'Not available'}${u?.electric_three_phase ? ' (3-phase)' : ''}
- Fiber: ${u?.fiber_available ? 'Yes' : 'No'}

LISTING
- Status: ${listing?.status ?? 'Not listed'}
- List price: ${formatCurrency(listing?.list_price)}
- Days on market: ${listing?.days_on_market ?? 'N/A'}
- MLS#: ${listing?.mls_number ?? 'N/A'}

FLAGS
- Distressed: ${p.is_distressed ? 'YES' : 'No'}
- Tax liens: ${p.has_tax_liens ? 'YES' : 'No'}
- Code violations: ${p.has_code_violations ? 'YES' : 'No'}
- Lis pendens: ${p.has_lis_pendens ? 'YES' : 'No'}
- Opportunity Zone: ${os?.in_opportunity_zone ? 'YES' : 'No'}
- CRA: ${os?.in_cra ? 'YES' : 'No'}
- Assemblage potential: ${os?.assemblage_potential ? 'Yes' : 'No'}

OPPORTUNITY SCORE: ${os?.overall_score ?? 'Not yet scored'} / 100 (Grade: ${os?.score_grade ?? 'N/A'})
`.trim()
}

const SYSTEM_PROMPT = `You are a senior Florida real estate analyst and land acquisition specialist with 20+ years of experience on the east coast between Fort Lauderdale and Port St. Lucie. You evaluate vacant and value-add land parcels for residential and commercial developers.

Your analysis is concise, data-driven, and actionable. You speak plainly — no filler phrases, no marketing language. You identify real risks and real opportunities with specific details.`

// Generate GPT-4o deal analysis for a property
export async function generatePropertySummary(
  property: PropertyWithRelations
): Promise<PropertySummaryResult> {
  const client = getClient()
  const context = buildPropertyContext(property)

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.3,
    max_tokens: 1000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Analyze this Florida land parcel and return a JSON object with these exact keys:

1. "summary" — 2-3 sentence deal overview. Include the core opportunity thesis if there is one. Be specific about the address, lot size, zoning, and what makes this interesting or not.

2. "risk_analysis" — 2-3 sentences on the top risks. Be specific: mention exact flood zone, wetland %, lien amounts, title issues, permitting complexity.

3. "upside_analysis" — 2-3 sentences on the upside potential. Focus on density delta, location dynamics, market timing, and any bonus flags.

4. "risk_flags" — array of short strings, each a specific risk (e.g. "Zone AE - 35% of parcel in flood zone", "SFWMD ERP permit required", "Active lis pendens").

5. "upside_flags" — array of short strings, each a specific upside (e.g. "FLU allows 16 units/acre vs current 2", "HUD Opportunity Zone — 10-year cap gains deferral", "Absentee corporate owner since 2009").

Property data:
${context}`,
      },
    ],
  })

  const raw = response.choices[0].message.content ?? '{}'

  try {
    const parsed = JSON.parse(raw)
    return {
      summary: parsed.summary ?? '',
      risk_analysis: parsed.risk_analysis ?? '',
      upside_analysis: parsed.upside_analysis ?? '',
      risk_flags: Array.isArray(parsed.risk_flags) ? parsed.risk_flags : [],
      upside_flags: Array.isArray(parsed.upside_flags) ? parsed.upside_flags : [],
    }
  } catch {
    // GPT returned malformed JSON — extract best-effort
    return {
      summary: raw.slice(0, 500),
      risk_analysis: '',
      upside_analysis: '',
      risk_flags: [],
      upside_flags: [],
    }
  }
}
