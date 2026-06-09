export interface County {
  id: number;
  fips_code: string;
  name: string;
  is_primary: boolean;
  pa_url: string | null;
}

export interface Municipality {
  id: number;
  county_id: number;
  name: string;
  muni_type: string;
}

export interface Property {
  id: string;
  folio_number: string;
  county_id: number;
  situs_address: string | null;
  situs_city: string | null;
  situs_zip: string | null;
  gross_acreage: number | null;
  net_buildable_acreage: number | null;
  zoning_code: string | null;
  future_land_use: string | null;
  opportunity_zone: boolean;
  cra_flag: boolean;
  greenbelt_flag: boolean;
  data_source: string | null;
  last_synced_at: string | null;
}

export interface PriceHistoryEntry {
  date: string;
  price: number;
  event: string;
}

export interface Listing {
  id: string;
  property_id: string;
  listing_source: string;
  external_listing_id: string | null;
  mls_number: string | null;
  listing_url: string | null;
  listing_price: number | null;
  price_per_acre: number | null;
  price_history: PriceHistoryEntry[];
  listing_status: string;
  listing_date: string | null;
  expiration_date: string | null;
  days_on_market: number | null;
  listing_broker_name: string | null;
  listing_agent_name: string | null;
  listing_agent_email: string | null;
}

export interface FloodZone {
  id: string;
  property_id: string;
  fema_zone_code: string | null;
  sfha_pct: number | null;
  base_flood_elevation_ft: number | null;
  is_special_flood_hazard: boolean;
}

export interface WetlandData {
  id: string;
  property_id: string;
  has_wetlands: boolean;
  wetland_pct: number | null;
  wetland_types: string[];
  sfwmd_jurisdiction: boolean;
  mitigation_cost_estimate: number | null;
  environmental_risk_score: number | null;
}

export interface UtilityAccess {
  id: string;
  property_id: string;
  water_available: boolean;
  water_at_site: boolean;
  water_connection_fee: number | null;
  sewer_available: boolean;
  sewer_at_site: boolean;
  road_frontage_type: "paved" | "unpaved" | "none" | null;
  road_classification: "local" | "collector" | "arterial" | "highway" | null;
}

export interface ZoningDetail {
  id: string;
  property_id: string;
  zoning_code: string;
  zoning_description: string | null;
  max_density_units_per_acre: number | null;
  max_height_ft: number | null;
  allows_multifamily: boolean;
  rezoning_required: boolean;
  future_land_use: string | null;
  upzoning_potential: "low" | "medium" | "high" | null;
}

export type SoftFlag =
  | "OPPORTUNITY_ZONE"
  | "CRA_OVERLAY"
  | "TRANSIT_PROXIMITY"
  | "SCHOOL_RATING"
  | "DAYS_ON_MARKET_90"
  | "PRICE_REDUCTION";

export interface DealFeedItem {
  rank_position: number;
  final_score: number;
  score_label: string;
  listing_id: string;
  property_id: string;
  address: string;
  county_name: string;
  listing_price: number | null;
  acreage: number | null;
  units_allowed: number | null;
  land_cost_per_unit: number | null;
  return_on_cost: number | null;
  days_on_market: number | null;
  in_morning_digest: boolean;
  soft_flags: string[];
}

export interface DealFeedResponse {
  date: string;
  total: number;
  page: number;
  per_page: number;
  results: DealFeedItem[];
}

export interface DealCardResponse {
  listing: Listing;
  property: Property;
  parcel: Record<string, unknown> | null;
  zoning: ZoningDetail | null;
  flood: FloodZone | null;
  wetlands: WetlandData | null;
  utility: UtilityAccess | null;
  score: number | null;
  score_detail: Record<string, unknown> | null;
  underwriting: Record<string, unknown> | null;
  improvement_levers: Record<string, unknown>[];
  soft_flags: string[];
  watchlist_status: string | null;
}
