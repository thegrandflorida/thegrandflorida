export interface RentData {
  id: string;
  county_id: number | null;
  zip_code: string | null;
  period_year: number;
  period_month: number;
  asking_rent_1br: number | null;
  asking_rent_2br: number | null;
  effective_rent_1br: number | null;
  effective_rent_2br: number | null;
  vacancy_rate: number | null;
  yoy_rent_growth_pct: number | null;
  data_source: string;
}

export interface DemographicData {
  id: string;
  county_id: number;
  acs_vintage_year: number;
  population_current: number | null;
  population_3yr_prior: number | null;
  population_growth_rate: number | null;
  renter_occupied_pct: number | null;
  median_household_income: number | null;
  median_age: number | null;
  bebr_projected_population: number | null;
}

export interface EmploymentData {
  id: string;
  county_id: number | null;
  msa_name: string | null;
  period_year: number;
  period_month: number;
  total_employment: number | null;
  yoy_employment_growth_pct: number | null;
  unemployment_rate: number | null;
  sector_employment: Record<string, number>;
}

export interface SupplyPipeline {
  id: string;
  county_id: number;
  period_year: number;
  period_month: number;
  units_under_construction: number | null;
  units_permitted_ltm: number | null;
  existing_inventory: number | null;
  supply_pressure_ratio: number | null;
  data_source: string;
}

export interface CountyMarketSnapshot {
  county_id: number;
  county_name: string;
  latest_rent: RentData | null;
  demographics: DemographicData | null;
  employment: EmploymentData | null;
  supply: SupplyPipeline | null;
}
