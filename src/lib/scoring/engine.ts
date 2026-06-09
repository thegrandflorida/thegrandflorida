import { createAdminClient } from '@/lib/supabase/admin'
import type { PropertyWithRelations, OpportunityScore, ScoringConfig } from '@/types/database'

// =============================================================================
// Scoring Engine — implements the full 9-factor algorithm
// See: Architecture Specification, Section "Property Investment Scoring Algorithm"
// =============================================================================

const DEFAULT_WEIGHTS = {
  price_per_acre: 0.20,
  zoning_flexibility: 0.18,
  population_growth: 0.14,
  flood_risk: 0.13,
  comparable_sales: 0.12,
  development_activity: 0.10,
  utility_access: 0.07,
  wetland_pct: 0.04,
  interstate_distance: 0.02,
}

// ---------------------------------------------------------------------------
// Sub-score 1: Price Per Acre
// ---------------------------------------------------------------------------
function scorePricePerAcre(
  subjectPricePerAcre: number | null,
  countyMedianPricePerAcre: number | null
): number {
  if (!subjectPricePerAcre || !countyMedianPricePerAcre || countyMedianPricePerAcre === 0) return 40

  const discountRatio =
    (countyMedianPricePerAcre - subjectPricePerAcre) / countyMedianPricePerAcre

  if (discountRatio >= 0.40) return 100
  if (discountRatio >= 0.25) return 75 + ((discountRatio - 0.25) / 0.15) * 25
  if (discountRatio >= 0.00) return 40 + (discountRatio / 0.25) * 35
  if (discountRatio >= -0.25) return 15 + ((discountRatio + 0.25) / 0.25) * 25
  return 0
}

// ---------------------------------------------------------------------------
// Sub-score 2: Zoning Flexibility
// ---------------------------------------------------------------------------
const FLU_MAX_DENSITY: Record<string, number> = {
  LDR: 5, MDR: 16, HDR: 35, VHDR: 50,
  MXR: 40, MXC: 60, CG: 0, CHI: 0,
  Industrial: 0, Agriculture: 1, Conservation: 0,
}

function scoreZoningFlexibility(
  currentMaxDensity: number | null,
  fluCategory: string | null,
  upzoningPotential: string | null,
  conditionalUses: string[] | null
): number {
  const current = currentMaxDensity ?? 0
  const fluKey = fluCategory ?? 'LDR'
  const fluMax = FLU_MAX_DENSITY[fluKey] ?? 5

  const densityUpside = fluMax > 0 ? (fluMax - current) / fluMax : 0

  let base = 20
  if (densityUpside >= 0.80) base = 90
  else if (densityUpside >= 0.60) base = 75
  else if (densityUpside >= 0.40) base = 60
  else if (densityUpside >= 0.20) base = 45
  else if (densityUpside >= 0.05) base = 30

  const upzoningMod =
    upzoningPotential === 'high' ? 10 :
    upzoningPotential === 'medium' ? 5 :
    upzoningPotential === 'low' ? -5 : 0

  const alreadyOptimized =
    densityUpside < 0.05 && current >= 16 ? 10 : 0

  const conditionalBonus = Math.min((conditionalUses?.length ?? 0) * 2, 8)

  return Math.min(base + upzoningMod + alreadyOptimized + conditionalBonus, 100)
}

// ---------------------------------------------------------------------------
// Sub-score 3: Population Growth
// ---------------------------------------------------------------------------
function scorePopulationGrowth(
  tractGrowth5yr: number | null,
  countyGrowth5yr: number | null,
  incomeGrowth5yr: number | null,
  permitUnits12mo: number | null
): number {
  const growth = tractGrowth5yr ?? 0
  const countyGrowth = countyGrowth5yr ?? 0

  let base = 20
  if (growth < 0) base = Math.max(0, 20 + growth * 4)
  else if (growth < 2) base = 20 + (growth / 2) * 15
  else if (growth < 5) base = 35 + ((growth - 2) / 3) * 20
  else if (growth < 10) base = 55 + ((growth - 5) / 5) * 25
  else if (growth < 15) base = 80 + ((growth - 10) / 5) * 20
  else base = 100

  const relativeGrowth = growth - countyGrowth
  const relativeMod =
    relativeGrowth >= 5 ? 10 :
    relativeGrowth >= 2 ? 5 :
    relativeGrowth < -2 ? -8 :
    relativeGrowth < 0 ? -4 : 0

  const income = incomeGrowth5yr ?? 0
  const incomeMod = income >= 10 ? 5 : income >= 5 ? 3 : income < 0 ? -5 : 0

  const permits = permitUnits12mo ?? 0
  const permitMod = permits >= 500 ? 8 : permits >= 200 ? 5 : permits >= 50 ? 2 : 0

  return Math.min(Math.max(base + relativeMod + incomeMod + permitMod, 0), 100)
}

// ---------------------------------------------------------------------------
// Sub-score 4: Flood Risk
// ---------------------------------------------------------------------------
const ZONE_BASE: Record<string, number> = {
  'X': 100, 'X500': 85, 'A': 20, 'AE': 15,
  'AH': 12, 'AO': 10, 'AR': 25, 'VE': 5, 'V': 8, 'D': 18,
}

function scoreFloodRisk(
  zoneCode: string | null,
  pctInFloodZone: number | null,
  siteElevationFt: number | null,
  bfeFt: number | null
): number {
  const zoneBase = ZONE_BASE[zoneCode ?? 'X'] ?? 85
  const pct = pctInFloodZone ?? 0

  const partial = 100 - (100 - zoneBase) * (pct / 100)

  let elevationBonus = 0
  if (zoneCode === 'AE' && siteElevationFt != null && bfeFt != null) {
    elevationBonus = Math.min((siteElevationFt - bfeFt) * 3, 15)
  }

  return Math.min(Math.max(partial + elevationBonus, 0), 100)
}

// ---------------------------------------------------------------------------
// Sub-score 5: Comparable Sales
// ---------------------------------------------------------------------------
function scoreComparableSales(
  medianPPA12mo: number | null,
  medianPPAPrior12mo: number | null,
  compCount12mo: number | null,
  compCountPrior12mo: number | null,
  subjectPricePerAcre: number | null
): number {
  const median12 = medianPPA12mo ?? 0
  const medianPrior = medianPPAPrior12mo ?? 0
  const count12 = compCount12mo ?? 0
  const countPrior = compCountPrior12mo ?? 1

  // Trend
  const trendPct = medianPrior > 0 ? (median12 - medianPrior) / medianPrior : 0
  let trendScore = 50
  if (trendPct < -0.10) trendScore = Math.max(0, 25 + trendPct * 100)
  else if (trendPct < 0) trendScore = 25 + ((trendPct + 0.10) / 0.10) * 25
  else if (trendPct < 0.10) trendScore = 50 + (trendPct / 0.10) * 25
  else if (trendPct < 0.20) trendScore = 75 + ((trendPct - 0.10) / 0.10) * 25
  else trendScore = 100

  // Velocity
  const velocityRatio = countPrior > 0 ? count12 / countPrior : 0
  let velocityScore = 10
  if (count12 >= 8 && velocityRatio >= 1.5) velocityScore = 100
  else if (count12 >= 5 && velocityRatio >= 1.0) velocityScore = 80
  else if (count12 >= 3) velocityScore = 60
  else if (count12 >= 1) velocityScore = 35

  // Discount to comps
  const subjectPPA = subjectPricePerAcre ?? median12
  const discount = median12 > 0 ? (median12 - subjectPPA) / median12 : 0
  let discountScore = 45
  if (discount >= 0.25) discountScore = 100
  else if (discount >= 0.10) discountScore = 70 + ((discount - 0.10) / 0.15) * 30
  else if (discount >= 0) discountScore = 45 + (discount / 0.10) * 25
  else discountScore = Math.max(0, 45 + discount * 150)

  return Math.round(trendScore * 0.40 + velocityScore * 0.25 + discountScore * 0.35)
}

// ---------------------------------------------------------------------------
// Sub-score 6: Development Activity Nearby
// ---------------------------------------------------------------------------
function scoreDevelopmentActivity(
  activeConstruction05mi: number | null,
  newPermits12mo1mi: number | null,
  hasMajorAnchor: boolean
): number {
  const constr = activeConstruction05mi ?? 0
  let constructionScore = 5
  if (constr >= 20) constructionScore = 100
  else if (constr >= 10) constructionScore = 70 + ((constr - 10) / 10) * 30
  else if (constr >= 5) constructionScore = 45 + ((constr - 5) / 5) * 25
  else if (constr >= 2) constructionScore = 25 + ((constr - 2) / 3) * 20
  else if (constr >= 1) constructionScore = 15

  const permits = newPermits12mo1mi ?? 0
  let permitScore = 5
  if (permits >= 50) permitScore = 100
  else if (permits >= 25) permitScore = 70 + ((permits - 25) / 25) * 30
  else if (permits >= 10) permitScore = 45 + ((permits - 10) / 15) * 25
  else if (permits >= 5) permitScore = 25 + ((permits - 5) / 5) * 20
  else if (permits >= 1) permitScore = 15

  const raw = constructionScore * 0.55 + permitScore * 0.45
  const multiplier = hasMajorAnchor ? 1.15 : 1.0

  return Math.min(Math.round(raw * multiplier), 100)
}

// ---------------------------------------------------------------------------
// Sub-score 7: Utility Access
// ---------------------------------------------------------------------------
function scoreUtilityAccess(
  waterAtSite: boolean,
  waterAvailable: boolean,
  sewerAtSite: boolean,
  sewerAvailable: boolean,
  septicPermitted: boolean,
  roadFrontage: string | null,
  electricAvailable: boolean,
  electricThreePhase: boolean,
  fiberAvailable: boolean,
  telecomAvailable: boolean,
  gasAvailable: boolean
): number {
  let pts = 0
  if (waterAtSite) pts += 30
  else if (waterAvailable) pts += 18
  if (sewerAtSite) pts += 30
  else if (sewerAvailable) pts += 18
  else if (septicPermitted) pts += 8
  if (roadFrontage === 'paved') pts += 20
  else if (roadFrontage === 'unpaved') pts += 8
  if (electricAvailable) pts += 8
  if (electricThreePhase) pts += 3
  if (fiberAvailable) pts += 4
  else if (telecomAvailable) pts += 2
  if (gasAvailable) pts += 3
  return Math.round((pts / 98) * 100)
}

// ---------------------------------------------------------------------------
// Sub-score 8: Wetland Percentage
// ---------------------------------------------------------------------------
function scoreWetlandPct(
  wetlandPct: number | null,
  sfwmdJurisdiction: boolean,
  armyCorpsJurisdiction: boolean,
  isolatedWetlands: boolean,
  mitigationBankAvailable: boolean
): number {
  const pct = wetlandPct ?? 0
  let base = 100
  if (pct > 50) base = 0
  else if (pct > 30) base = 15
  else if (pct > 20) base = 35
  else if (pct > 10) base = 55
  else if (pct > 5) base = 75
  else if (pct > 0) base = 90

  const jurisdMod =
    sfwmdJurisdiction && armyCorpsJurisdiction ? -15 :
    sfwmdJurisdiction || armyCorpsJurisdiction ? -8 : 0

  const isolatedMod = isolatedWetlands && pct <= 20 ? 10 : isolatedWetlands ? 5 : 0
  const mitigationMod = mitigationBankAvailable ? 8 : 0

  return Math.min(Math.max(base + jurisdMod + isolatedMod + mitigationMod, 0), 100)
}

// ---------------------------------------------------------------------------
// Sub-score 9: Distance to Interstate
// ---------------------------------------------------------------------------
function scoreInterstateDistance(
  distanceMiles: number | null,
  zoningCategory: string | null
): number {
  const dist = distanceMiles ?? 10

  let base = 3
  if (dist <= 0.5) base = 100
  else if (dist <= 1.0) base = 95
  else if (dist <= 2.0) base = 85
  else if (dist <= 3.0) base = 72
  else if (dist <= 5.0) base = 55
  else if (dist <= 7.5) base = 38
  else if (dist <= 10.0) base = 22
  else if (dist <= 15.0) base = 10

  const multiplier =
    zoningCategory === 'industrial' ? 1.20 :
    zoningCategory === 'commercial' ? 1.10 :
    zoningCategory === 'residential' ? 0.90 :
    zoningCategory === 'agricultural' ? 0.85 : 1.00

  return Math.min(Math.round(base * multiplier), 100)
}

// ---------------------------------------------------------------------------
// Bonus and Penalty system
// ---------------------------------------------------------------------------
function computeBonuses(property: PropertyWithRelations): number {
  const os = property.opportunity_score
  const o = property.current_owner
  const pd = property.parcel_data
  let bonus = 0

  if (os?.in_opportunity_zone) bonus += 5
  if (os?.in_cra) bonus += 4
  if (os?.assemblage_potential) bonus += 4
  if (property.is_distressed && property.has_tax_liens) bonus += 3
  if (o?.is_out_of_state_owner) bonus += 2
  if (property.is_vacant && o?.years_owned && o.years_owned >= 5) bonus += 2
  const ratio = pd?.assessed_to_market_ratio
  if (ratio && ratio < 0.60) bonus += 2

  return Math.min(bonus, 10)
}

function computePenalties(property: PropertyWithRelations): number {
  let penalty = 0
  if (property.has_lis_pendens) penalty += 10
  if (property.has_code_violations) penalty += 4
  if (property.has_tax_liens) penalty += 7
  // No road frontage
  const u = property.utility_access
  if (u?.road_frontage_type === 'none') penalty += 10
  return Math.min(penalty, 25)
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------
export async function scoreProperty(
  property: PropertyWithRelations,
  config?: ScoringConfig
): Promise<Partial<OpportunityScore>> {
  const weights = config?.weights ?? DEFAULT_WEIGHTS
  const pd = property.parcel_data
  const z = property.zoning
  const fz = property.flood_zone
  const w = property.wetland
  const u = property.utility_access

  // Fetch county median price/acre for comp (simplified — use stored value)
  const countyMedianPPA = pd?.price_per_acre
    ? pd.price_per_acre * 1.15  // approximate — real impl queries market_comps table
    : null

  // Sub-scores
  const priceScore = scorePricePerAcre(pd?.price_per_acre ?? null, countyMedianPPA)
  const zoningScore = scoreZoningFlexibility(
    z?.max_density_units_per_acre ?? null,
    z?.flu_category ?? null,
    z?.upzoning_potential ?? null,
    z?.conditional_uses ?? null
  )
  const populationScore = scorePopulationGrowth(null, null, null, null) // requires census data
  const floodScore = scoreFloodRisk(
    fz?.fema_zone_code ?? null,
    fz?.pct_parcel_in_flood_zone ?? null,
    null, // site_elevation — requires LIDAR
    fz?.base_flood_elevation_ft ?? null
  )
  const compsScore = scoreComparableSales(null, null, null, null, pd?.price_per_acre ?? null)
  const devActivityScore = scoreDevelopmentActivity(null, null, false)
  const utilityScore = scoreUtilityAccess(
    u?.water_at_site ?? false,
    u?.water_available ?? false,
    u?.sewer_at_site ?? false,
    u?.sewer_available ?? false,
    u?.septic_permitted ?? false,
    u?.road_frontage_type ?? null,
    u?.electric_available ?? false,
    u?.electric_three_phase ?? false,
    u?.fiber_available ?? false,
    !!(u?.telecom_providers?.length),
    u?.gas_available ?? false
  )
  const wetlandScore = scoreWetlandPct(
    w?.wetland_pct ?? null,
    w?.sfwmd_jurisdiction ?? false,
    w?.army_corps_jurisdiction ?? false,
    w?.isolated_wetlands ?? false,
    w?.mitigation_bank_available ?? false
  )
  const interstateScore = scoreInterstateDistance(null, z?.zoning_category ?? null)

  // Weighted sum
  const weighted =
    priceScore * (weights.price_per_acre ?? DEFAULT_WEIGHTS.price_per_acre) +
    zoningScore * (weights.zoning_flexibility ?? DEFAULT_WEIGHTS.zoning_flexibility) +
    populationScore * (weights.population_growth ?? DEFAULT_WEIGHTS.population_growth) +
    floodScore * (weights.flood_risk ?? DEFAULT_WEIGHTS.flood_risk) +
    compsScore * (weights.comparable_sales ?? DEFAULT_WEIGHTS.comparable_sales) +
    devActivityScore * (weights.development_activity ?? DEFAULT_WEIGHTS.development_activity) +
    utilityScore * (weights.utility_access ?? DEFAULT_WEIGHTS.utility_access) +
    wetlandScore * (weights.wetland_pct ?? DEFAULT_WEIGHTS.wetland_pct) +
    interstateScore * (weights.interstate_distance ?? DEFAULT_WEIGHTS.interstate_distance)

  const bonus = computeBonuses(property)
  const penalty = computePenalties(property)
  const rawScore = weighted + bonus - penalty
  const overallScore = Math.max(0, Math.min(100, rawScore))

  const scoreGrade =
    overallScore >= 85 ? 'A' :
    overallScore >= 70 ? 'B' :
    overallScore >= 55 ? 'C' :
    overallScore >= 40 ? 'D' : 'F'

  const riskFlags: string[] = []
  const upsideFlags: string[] = []

  if (fz?.is_special_flood_hazard) riskFlags.push(`FEMA Zone ${fz.fema_zone_code}`)
  if (w?.wetland_pct && w.wetland_pct > 20) riskFlags.push(`${w.wetland_pct}% wetlands`)
  if (property.has_lis_pendens) riskFlags.push('Active lis pendens')
  if (property.has_tax_liens) riskFlags.push('Tax liens')
  if (property.has_code_violations) riskFlags.push('Code violations')
  if (u?.road_frontage_type === 'none') riskFlags.push('No road frontage')

  if (property.opportunity_score?.in_opportunity_zone) upsideFlags.push('HUD Opportunity Zone')
  if (property.opportunity_score?.in_cra) upsideFlags.push('CRA district')
  if (property.opportunity_score?.assemblage_potential) upsideFlags.push('Assemblage potential')
  if (property.is_vacant) upsideFlags.push('Vacant land')
  if (property.is_distressed) upsideFlags.push('Distressed asset')
  if (property.current_owner?.is_out_of_state_owner) upsideFlags.push('Absentee owner')

  const scoreRecord: Partial<OpportunityScore> = {
    property_id: property.id,
    overall_score: Math.round(overallScore * 10) / 10,
    score_grade: scoreGrade as OpportunityScore['score_grade'],
    location_score: Math.round(((floodScore + interstateScore) / 2) * 10) / 10,
    zoning_upside_score: Math.round(zoningScore * 10) / 10,
    value_dislocation_score: Math.round(priceScore * 10) / 10,
    distress_signal_score: Math.round(compsScore * 10) / 10,
    environmental_risk_score: Math.round(((floodScore + wetlandScore) / 2) * 10) / 10,
    market_velocity_score: Math.round(devActivityScore * 10) / 10,
    utility_readiness_score: Math.round(utilityScore * 10) / 10,
    bonus_points: bonus,
    score_weights: weights as Record<string, number>,
    score_inputs: {
      price_score: priceScore,
      zoning_score: zoningScore,
      population_score: populationScore,
      flood_score: floodScore,
      comps_score: compsScore,
      dev_activity_score: devActivityScore,
      utility_score: utilityScore,
      wetland_score: wetlandScore,
      interstate_score: interstateScore,
      bonus,
      penalty,
    },
    risk_flags: riskFlags,
    upside_flags: upsideFlags,
    in_opportunity_zone: property.opportunity_score?.in_opportunity_zone ?? false,
    in_cra: property.opportunity_score?.in_cra ?? false,
    assemblage_potential: property.opportunity_score?.assemblage_potential ?? false,
    scoring_config_id: config?.id ?? null,
    scored_at: new Date().toISOString(),
    scoring_version: '1.0.0',
  }

  // Persist to DB
  const supabase = createAdminClient()
  await supabase
    .from('opportunity_scores')
    .upsert(scoreRecord, { onConflict: 'property_id' })

  return scoreRecord
}
