// =============================================================================
// Database types — mirrors the PostgreSQL schema exactly
// =============================================================================

export type Role = 'admin' | 'analyst' | 'viewer'
export type SubscriptionTier = 'free' | 'pro' | 'enterprise'
export type ZoningCategory = 'residential' | 'commercial' | 'industrial' | 'agricultural' | 'mixed' | 'institutional'
export type ListingSource = 'mls' | 'loopnet' | 'crexi' | 'owner' | 'auction'
export type ListingType = 'sale' | 'lease' | 'auction'
export type ListingStatus = 'active' | 'pending' | 'sold' | 'expired' | 'withdrawn' | 'cancelled'
export type FemaZone = 'AE' | 'X' | 'VE' | 'AH' | 'AO' | 'D' | 'A' | 'AR' | 'V'
export type DeedType = 'warranty' | 'quitclaim' | 'tax_deed' | 'foreclosure' | 'special_warranty' | 'trustees' | 'other'
export type OwnerType = 'individual' | 'llc' | 'trust' | 'corporation' | 'government'
export type RoadFrontageType = 'paved' | 'unpaved' | 'none'
export type RoadClassification = 'local' | 'collector' | 'arterial' | 'highway'
export type UpzoningPotential = 'low' | 'medium' | 'high'
export type AlertType = 'new_match' | 'score_change' | 'price_change' | 'listing_added' | 'listing_removed'
export type AlertFrequency = 'realtime' | 'daily' | 'weekly'
export type FavoriteStage = 'watching' | 'analyzing' | 'under_contract' | 'pass'
export type ProposedUse = 'sfr' | 'townhomes' | 'multifamily' | 'mixed_use' | 'commercial' | 'industrial'
export type ScoreGrade = 'A' | 'B' | 'C' | 'D' | 'F'
export type SyncStatus = 'running' | 'success' | 'partial' | 'failed'
export type MunicipalityType = 'city' | 'town' | 'village' | 'unincorporated'

// -----------------------------------------------------------------------------
// Reference tables
// -----------------------------------------------------------------------------

export interface County {
  id: number
  name: string
  fips_code: string
  state: string
  appraiser_api_url: string | null
  appraiser_api_key_ref: string | null
  last_synced_at: string | null
  total_parcels: number | null
  created_at: string
}

export interface Municipality {
  id: number
  county_id: number
  name: string
  type: MunicipalityType
  zoning_ordinance_url: string | null
  planning_dept_phone: string | null
  created_at: string
}

// -----------------------------------------------------------------------------
// Core property tables
// -----------------------------------------------------------------------------

export interface Property {
  id: string
  parcel_id: string
  county_id: number
  municipality_id: number | null
  address_street: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
  latitude: number | null
  longitude: number | null
  lot_size_sqft: number | null
  lot_size_acres: number | null
  frontage_ft: number | null
  depth_ft: number | null
  is_corner_lot: boolean
  is_vacant: boolean
  is_distressed: boolean
  has_code_violations: boolean
  has_tax_liens: boolean
  has_lis_pendens: boolean
  source: string | null
  created_at: string
  updated_at: string
}

export interface ParcelData {
  id: string
  property_id: string
  land_use_code: string | null
  building_sqft: number | null
  year_built: number | null
  stories: number | null
  units: number | null
  bedrooms: number | null
  bathrooms: number | null
  construction_type: string | null
  roof_type: string | null
  assessed_value: number | null
  land_value: number | null
  improvement_value: number | null
  total_value: number | null
  taxable_value: number | null
  exemption_value: number | null
  exemption_types: string[] | null
  tax_year: number | null
  annual_taxes: number | null
  price_per_sqft_land: number | null
  price_per_acre: number | null
  assessed_to_market_ratio: number | null
  updated_at: string
}

export interface Ownership {
  id: string
  property_id: string
  owner_name: string | null
  owner_type: OwnerType | null
  owner_address_street: string | null
  owner_address_city: string | null
  owner_address_state: string | null
  owner_address_zip: string | null
  is_homesteaded: boolean
  is_out_of_state_owner: boolean
  is_corporate_owner: boolean
  years_owned: number | null
  acquisition_date: string | null
  acquisition_price: number | null
  is_current: boolean
  valid_from: string | null
  valid_to: string | null
  created_at: string
}

export interface SalesHistory {
  id: string
  property_id: string
  sale_date: string
  sale_price: number | null
  grantor: string | null
  grantee: string | null
  deed_type: DeedType | null
  book: string | null
  page: string | null
  instrument_number: string | null
  recorded_date: string | null
  is_arms_length: boolean | null
  price_per_sqft: number | null
  price_per_acre: number | null
  created_at: string
}

export interface Zoning {
  id: string
  property_id: string
  county_id: number
  municipality_id: number | null
  zoning_code: string
  zoning_description: string | null
  zoning_category: ZoningCategory | null
  future_land_use: string | null
  flu_category: string | null
  max_density_units_per_acre: number | null
  max_height_ft: number | null
  max_height_stories: number | null
  min_lot_size_sqft: number | null
  max_lot_coverage_pct: number | null
  max_far: number | null
  setback_front_ft: number | null
  setback_rear_ft: number | null
  setback_side_ft: number | null
  allowable_uses: string[] | null
  conditional_uses: string[] | null
  overlay_districts: string[] | null
  is_pud: boolean
  pud_name: string | null
  variance_history: unknown | null
  upzoning_potential: UpzoningPotential | null
  rezoning_notes: string | null
  source_url: string | null
  verified_at: string | null
  updated_at: string
}

export interface Listing {
  id: string
  property_id: string
  mls_number: string | null
  listing_source: ListingSource | null
  listing_type: ListingType | null
  list_price: number | null
  price_per_sqft: number | null
  price_per_acre: number | null
  list_date: string | null
  expiration_date: string | null
  close_date: string | null
  close_price: number | null
  days_on_market: number | null
  status: ListingStatus
  listing_agent_name: string | null
  listing_agent_phone: string | null
  listing_agent_email: string | null
  listing_brokerage: string | null
  listing_url: string | null
  description: string | null
  photos: { url: string; caption: string; order: number }[] | null
  is_current: boolean
  created_at: string
  updated_at: string
}

export interface FloodZone {
  id: string
  property_id: string
  fema_zone_code: FemaZone | null
  fema_zone_description: string | null
  firm_panel_number: string | null
  firm_effective_date: string | null
  base_flood_elevation_ft: number | null
  is_special_flood_hazard: boolean
  flood_insurance_required: boolean
  pct_parcel_in_flood_zone: number | null
  last_updated: string | null
}

export interface Wetland {
  id: string
  property_id: string
  has_wetlands: boolean
  wetland_pct: number | null
  wetland_sqft: number | null
  wetland_types: string[] | null
  sfwmd_jurisdiction: boolean
  army_corps_jurisdiction: boolean
  isolated_wetlands: boolean
  mitigation_bank_available: boolean
  mitigation_cost_estimate: number | null
  environmental_risk_score: number | null
  last_updated: string | null
}

export interface UtilityAccess {
  id: string
  property_id: string
  water_provider: string | null
  water_available: boolean
  water_at_site: boolean
  water_line_size_inches: number | null
  water_connection_fee: number | null
  sewer_provider: string | null
  sewer_available: boolean
  sewer_at_site: boolean
  septic_permitted: boolean
  sewer_connection_fee: number | null
  electric_provider: string | null
  electric_available: boolean
  electric_three_phase: boolean
  gas_available: boolean
  gas_provider: string | null
  telecom_providers: string[] | null
  fiber_available: boolean
  road_frontage_type: RoadFrontageType | null
  road_name: string | null
  road_classification: RoadClassification | null
  updated_at: string
}

// -----------------------------------------------------------------------------
// Scoring
// -----------------------------------------------------------------------------

export interface OpportunityScore {
  id: string
  property_id: string
  overall_score: number | null
  score_grade: ScoreGrade | null
  location_score: number | null
  zoning_upside_score: number | null
  value_dislocation_score: number | null
  distress_signal_score: number | null
  environmental_risk_score: number | null
  market_velocity_score: number | null
  utility_readiness_score: number | null
  bonus_points: number | null
  score_weights: Record<string, number> | null
  score_inputs: Record<string, unknown> | null
  risk_flags: string[] | null
  upside_flags: string[] | null
  in_opportunity_zone: boolean
  in_cra: boolean
  assemblage_potential: boolean
  ai_summary: string | null
  ai_risk_analysis: string | null
  ai_upside_analysis: string | null
  scoring_config_id: string | null
  scored_at: string
  scoring_version: string | null
}

export interface ScoringConfig {
  id: string
  name: string
  description: string | null
  is_default: boolean
  is_active: boolean
  weights: Record<string, number>
  thresholds: { A: number; B: number; C: number; D: number } | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// User features
// -----------------------------------------------------------------------------

export interface User {
  id: string
  email: string
  full_name: string | null
  company: string | null
  phone: string | null
  role: Role
  gc_license_number: string | null
  notification_preferences: {
    email: boolean
    sms: boolean
    push: boolean
  }
  subscription_tier: SubscriptionTier
  subscription_expires_at: string | null
  created_at: string
  updated_at: string
}

export interface SavedSearch {
  id: string
  user_id: string
  name: string
  description: string | null
  filters: PropertyFilters
  sort_by: string | null
  sort_dir: 'asc' | 'desc' | null
  alert_enabled: boolean
  alert_frequency: AlertFrequency | null
  alert_score_threshold: number | null
  last_run_at: string | null
  last_result_count: number | null
  new_since_last_run: number
  created_at: string
  updated_at: string
}

export interface Favorite {
  id: string
  user_id: string
  property_id: string
  notes: string | null
  tags: string[] | null
  stage: FavoriteStage
  created_at: string
}

export interface Alert {
  id: string
  user_id: string
  saved_search_id: string | null
  property_id: string | null
  alert_type: AlertType
  title: string | null
  body: string | null
  data: Record<string, unknown> | null
  is_read: boolean
  is_emailed: boolean
  emailed_at: string | null
  email_report_id: string | null
  created_at: string
}

export interface EmailReport {
  id: string
  user_id: string
  report_type: 'daily_digest' | 'weekly_summary' | 'alert' | 'saved_search'
  subject: string | null
  property_ids: string[] | null
  recipient_email: string | null
  status: 'pending' | 'sent' | 'failed' | 'bounced'
  sent_at: string | null
  opened_at: string | null
  resend_message_id: string | null
  created_at: string
}

export interface FeasibilityAnalysis {
  id: string
  property_id: string
  user_id: string
  scenario_name: string
  proposed_use: ProposedUse | null
  proposed_units: number | null
  proposed_sqft: number | null
  acquisition_price: number | null
  hard_cost_per_sqft: number | null
  total_hard_cost: number | null
  soft_cost_pct: number | null
  total_soft_cost: number | null
  contingency_pct: number | null
  total_contingency: number | null
  total_project_cost: number | null
  avg_sale_price_per_unit: number | null
  avg_sale_price_per_sqft: number | null
  total_revenue: number | null
  gross_profit: number | null
  gross_margin_pct: number | null
  roi_pct: number | null
  irr_pct: number | null
  equity_multiple: number | null
  profit_per_unit: number | null
  ltc_pct: number | null
  loan_amount: number | null
  interest_rate: number | null
  loan_term_months: number | null
  carry_cost: number | null
  absorption_months: number | null
  construction_months: number | null
  ai_feasibility_notes: string | null
  ai_risk_flags: { flag: string; severity: 'low' | 'medium' | 'high'; notes: string }[] | null
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface MarketComp {
  id: string
  reference_property_id: string
  comp_property_id: string | null
  comp_type: 'land_sale' | 'improved_sale' | 'active_listing'
  county_id: number | null
  address: string | null
  sale_date: string | null
  sale_price: number | null
  lot_size_sqft: number | null
  lot_size_acres: number | null
  building_sqft: number | null
  price_per_sqft_land: number | null
  price_per_acre: number | null
  zoning_code: string | null
  distance_miles: number | null
  similarity_score: number | null
  source: string | null
  created_at: string
}

export interface PropertyNote {
  id: string
  user_id: string
  property_id: string
  body: string
  is_private: boolean
  created_at: string
  updated_at: string
}

export interface SyncLog {
  id: string
  source: string
  county_id: number | null
  job_id: string | null
  started_at: string
  completed_at: string | null
  duration_seconds: number | null
  records_fetched: number
  records_inserted: number
  records_updated: number
  records_skipped: number
  records_errored: number
  error_log: unknown | null
  status: SyncStatus
}

// -----------------------------------------------------------------------------
// Composite / API types
// -----------------------------------------------------------------------------

export interface PropertyWithRelations extends Property {
  county?: County
  municipality?: Municipality
  parcel_data?: ParcelData
  current_owner?: Ownership
  zoning?: Zoning
  listing?: Listing | null
  flood_zone?: FloodZone
  wetland?: Wetland
  utility_access?: UtilityAccess
  opportunity_score?: OpportunityScore
}

export interface PropertyFilters {
  counties?: string[]
  zoning_categories?: ZoningCategory[]
  zoning_codes?: string[]
  lot_min_acres?: number
  lot_max_acres?: number
  price_min?: number
  price_max?: number
  score_min?: number
  score_max?: number
  vacant_only?: boolean
  listed_only?: boolean
  exclude_flood?: boolean
  opportunity_zone_only?: boolean
  cra_only?: boolean
  no_wetlands?: boolean
  distressed_only?: boolean
  search?: string
  bbox?: [number, number, number, number]
}

export interface PaginationMeta {
  total: number
  cursor: string | null
  limit: number
  took_ms: number
}

export interface ApiResponse<T> {
  data: T
  meta?: PaginationMeta
  error?: never
}

export interface ApiError {
  data?: never
  error: {
    code: string
    message: string
    details?: unknown
  }
}
