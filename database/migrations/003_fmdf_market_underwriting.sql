-- =============================================================================
-- Migration 003: Market Data, Underwriting, Scoring & Rankings
-- Florida Multifamily Deal Finder — PRD v1.0
-- Requires: migrations 001 + 002
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: rent_data
-- Monthly rent and vacancy statistics at county or ZIP level
-- Sources: CoStar, HUD FMR, Zillow, Apartment List
-- ---------------------------------------------------------------------------

CREATE TABLE public.rent_data (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    county_id               INT             REFERENCES public.counties(id) ON DELETE RESTRICT,
    zip_code                TEXT,

    period_year             SMALLINT        NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
    period_month            SMALLINT        NOT NULL CHECK (period_month BETWEEN 1 AND 12),

    -- Asking rents by bedroom type
    asking_rent_studio      NUMERIC(8,2)    CHECK (asking_rent_studio >= 0),
    asking_rent_1br         NUMERIC(8,2)    CHECK (asking_rent_1br >= 0),
    asking_rent_2br         NUMERIC(8,2)    CHECK (asking_rent_2br >= 0),
    asking_rent_3br         NUMERIC(8,2)    CHECK (asking_rent_3br >= 0),

    -- Effective rents net of concessions
    effective_rent_studio   NUMERIC(8,2)    CHECK (effective_rent_studio >= 0),
    effective_rent_1br      NUMERIC(8,2)    CHECK (effective_rent_1br >= 0),
    effective_rent_2br      NUMERIC(8,2)    CHECK (effective_rent_2br >= 0),
    effective_rent_3br      NUMERIC(8,2)    CHECK (effective_rent_3br >= 0),

    -- Market statistics
    vacancy_rate            NUMERIC(5,4)    CHECK (vacancy_rate BETWEEN 0 AND 1),
    yoy_rent_growth_pct     NUMERIC(6,4),   -- decimal; negative values permitted
    concession_months       NUMERIC(4,2)    CHECK (concession_months >= 0),

    data_source             TEXT            NOT NULL
                                            CHECK (data_source IN (
                                                'CoStar','HUD_FMR','Zillow','ApartmentList','CBRE','Other'
                                            )),

    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_rent_geography CHECK (county_id IS NOT NULL OR zip_code IS NOT NULL),
    CONSTRAINT uq_rent_geo_period  UNIQUE (county_id, zip_code, period_year, period_month, data_source)
);

COMMENT ON TABLE  public.rent_data                  IS 'Monthly rent and vacancy statistics at county or ZIP level.';
COMMENT ON COLUMN public.rent_data.vacancy_rate     IS 'Market vacancy rate as decimal (0.07 = 7%).';
COMMENT ON COLUMN public.rent_data.yoy_rent_growth_pct IS 'Year-over-year rent change as decimal (0.04 = 4%, -0.02 = -2%).';
COMMENT ON COLUMN public.rent_data.concession_months IS 'Average months free rent offered as concession.';

CREATE INDEX idx_rent_data_county  ON public.rent_data(county_id, period_year DESC, period_month DESC);
CREATE INDEX idx_rent_data_zip     ON public.rent_data(zip_code, period_year DESC, period_month DESC);
CREATE INDEX idx_rent_data_period  ON public.rent_data(period_year DESC, period_month DESC);

CREATE TRIGGER trg_rent_data_updated_at
    BEFORE UPDATE ON public.rent_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.rent_data ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- TABLE: demographic_data
-- ACS 5-year and BEBR population/income data at county level
-- ---------------------------------------------------------------------------

CREATE TABLE public.demographic_data (
    id                          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    county_id                   INT             NOT NULL REFERENCES public.counties(id) ON DELETE RESTRICT,

    -- ACS vintage (e.g. 2023 = 2019–2023 5-year estimates)
    acs_vintage_year            SMALLINT        NOT NULL CHECK (acs_vintage_year BETWEEN 2000 AND 2100),

    -- Population
    population_current          INTEGER         CHECK (population_current >= 0),
    population_3yr_prior        INTEGER         CHECK (population_3yr_prior >= 0),
    -- Annualized CAGR: ((current/prior)^(1/3)) - 1
    population_growth_rate      NUMERIC(7,5),

    -- Housing & tenure
    renter_occupied_pct         NUMERIC(5,4)    CHECK (renter_occupied_pct BETWEEN 0 AND 1),
    total_housing_units         INTEGER         CHECK (total_housing_units >= 0),
    owner_occupied_units        INTEGER         CHECK (owner_occupied_units >= 0),
    renter_occupied_units       INTEGER         CHECK (renter_occupied_units >= 0),

    -- Income & demographics
    median_household_income     NUMERIC(10,2)   CHECK (median_household_income >= 0),
    per_capita_income           NUMERIC(10,2)   CHECK (per_capita_income >= 0),
    poverty_rate                NUMERIC(5,4)    CHECK (poverty_rate BETWEEN 0 AND 1),
    median_age                  NUMERIC(4,1)    CHECK (median_age BETWEEN 0 AND 120),

    -- BEBR projections (University of Florida)
    bebr_projection_year        SMALLINT        CHECK (bebr_projection_year BETWEEN 2000 AND 2100),
    bebr_projected_population   INTEGER         CHECK (bebr_projected_population >= 0),

    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_demographic_county_vintage UNIQUE (county_id, acs_vintage_year)
);

COMMENT ON TABLE  public.demographic_data                    IS 'ACS 5-year and BEBR demographic data at county level.';
COMMENT ON COLUMN public.demographic_data.acs_vintage_year   IS 'ACS 5-year survey end year (e.g. 2023 covers 2019–2023).';
COMMENT ON COLUMN public.demographic_data.population_growth_rate IS 'Annualized 3-year population CAGR as decimal (0.021 = 2.1%/yr).';
COMMENT ON COLUMN public.demographic_data.renter_occupied_pct IS 'Share of occupied units that are renter-occupied (decimal).';
COMMENT ON COLUMN public.demographic_data.bebr_projection_year IS 'Target year for UF Bureau of Economic and Business Research projection.';

CREATE INDEX idx_demographic_county ON public.demographic_data(county_id, acs_vintage_year DESC);

CREATE TRIGGER trg_demographic_data_updated_at
    BEFORE UPDATE ON public.demographic_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.demographic_data ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- TABLE: employment_data
-- Monthly labor market statistics at county or MSA level
-- Sources: BLS LAUS, BLS QCEW, FL DEO
-- ---------------------------------------------------------------------------

CREATE TABLE public.employment_data (
    id                          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    county_id                   INT             REFERENCES public.counties(id) ON DELETE RESTRICT,
    msa_name                    TEXT,           -- e.g. 'Miami-Fort Lauderdale-Pompano Beach, FL'

    period_year                 SMALLINT        NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
    period_month                SMALLINT        NOT NULL CHECK (period_month BETWEEN 1 AND 12),

    total_employment            INTEGER         CHECK (total_employment >= 0),
    yoy_employment_growth_pct   NUMERIC(7,5),   -- decimal; negative permitted
    unemployment_rate           NUMERIC(5,4)    CHECK (unemployment_rate BETWEEN 0 AND 1),
    labor_force                 INTEGER         CHECK (labor_force >= 0),

    -- NAICS sector employment counts: {"construction": 42000, "healthcare": 115000}
    sector_employment           JSONB           NOT NULL DEFAULT '{}'::JSONB,

    data_source                 TEXT            NOT NULL
                                                CHECK (data_source IN ('BLS_LAUS','BLS_QCEW','FL_DEO','Other')),

    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_employment_geography CHECK (county_id IS NOT NULL OR msa_name IS NOT NULL),
    CONSTRAINT uq_employment_geo_period UNIQUE (county_id, msa_name, period_year, period_month, data_source)
);

COMMENT ON TABLE  public.employment_data                    IS 'Monthly labor market statistics at county or MSA level.';
COMMENT ON COLUMN public.employment_data.unemployment_rate  IS 'BLS LAUS unemployment rate as decimal (0.04 = 4%).';
COMMENT ON COLUMN public.employment_data.sector_employment  IS 'JSONB map of NAICS sector names to non-farm payroll counts.';

CREATE INDEX idx_employment_county      ON public.employment_data(county_id, period_year DESC, period_month DESC);
CREATE INDEX idx_employment_sectors_gin ON public.employment_data USING GIN(sector_employment);

CREATE TRIGGER trg_employment_data_updated_at
    BEFORE UPDATE ON public.employment_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.employment_data ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- TABLE: supply_pipeline
-- Multifamily apartment supply pipeline metrics at county level
-- Sources: CoStar, Census Building Permits Survey, County Building Depts
-- ---------------------------------------------------------------------------

CREATE TABLE public.supply_pipeline (
    id                          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    county_id                   INT             NOT NULL REFERENCES public.counties(id) ON DELETE RESTRICT,

    period_year                 SMALLINT        NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
    period_month                SMALLINT        NOT NULL CHECK (period_month BETWEEN 1 AND 12),

    -- Units
    units_under_construction    INTEGER         CHECK (units_under_construction >= 0),
    units_permitted_ltm         INTEGER         CHECK (units_permitted_ltm >= 0),   -- last trailing 12 months
    units_delivered_ltm         INTEGER         CHECK (units_delivered_ltm >= 0),
    existing_inventory          INTEGER         CHECK (existing_inventory >= 0),

    -- supply_pressure_ratio = (units_under_construction + units_permitted_ltm) / existing_inventory
    supply_pressure_ratio       NUMERIC(8,4)    CHECK (supply_pressure_ratio >= 0),

    -- Average asking rent for competitive new supply (used for rent assumption calibration)
    new_supply_avg_rent_1br     NUMERIC(8,2)    CHECK (new_supply_avg_rent_1br >= 0),
    new_supply_avg_rent_2br     NUMERIC(8,2)    CHECK (new_supply_avg_rent_2br >= 0),

    data_source                 TEXT            NOT NULL DEFAULT 'Other'
                                                CHECK (data_source IN (
                                                    'CoStar','Census_BP','County_BD','FL_DEM','Other'
                                                )),

    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_supply_county_period UNIQUE (county_id, period_year, period_month, data_source)
);

COMMENT ON TABLE  public.supply_pipeline                       IS 'Multifamily apartment supply pipeline metrics at county level.';
COMMENT ON COLUMN public.supply_pipeline.units_permitted_ltm   IS 'Multifamily units (5+) permitted in the trailing 12 months.';
COMMENT ON COLUMN public.supply_pipeline.supply_pressure_ratio IS 'Pipeline units / existing inventory — higher = more supply risk.';

CREATE INDEX idx_supply_county ON public.supply_pipeline(county_id, period_year DESC, period_month DESC);

CREATE TRIGGER trg_supply_pipeline_updated_at
    BEFORE UPDATE ON public.supply_pipeline
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.supply_pipeline ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- TABLE: score_model_versions
-- Versioned scoring model definitions with indicator weights and breakpoints
-- Extends / formalizes public.scoring_configs with PRD v1.0 indicator schema
-- ---------------------------------------------------------------------------

CREATE TABLE public.score_model_versions (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    version_number          TEXT            NOT NULL UNIQUE,    -- e.g. 'v1.0'
    effective_date          DATE            NOT NULL,
    is_active               BOOLEAN         NOT NULL DEFAULT FALSE,
    description             TEXT,

    -- The 10 scoring indicators from the approved scoring model spec
    -- Each weight stored as decimal; weights must sum to 1.0
    w_land_cost_per_unit    NUMERIC(5,4)    NOT NULL DEFAULT 0.25 CHECK (w_land_cost_per_unit    BETWEEN 0 AND 1),
    w_rent_growth           NUMERIC(5,4)    NOT NULL DEFAULT 0.12 CHECK (w_rent_growth           BETWEEN 0 AND 1),
    w_population_growth     NUMERIC(5,4)    NOT NULL DEFAULT 0.10 CHECK (w_population_growth     BETWEEN 0 AND 1),
    w_median_hh_income      NUMERIC(5,4)    NOT NULL DEFAULT 0.08 CHECK (w_median_hh_income      BETWEEN 0 AND 1),
    w_employment_growth     NUMERIC(5,4)    NOT NULL DEFAULT 0.08 CHECK (w_employment_growth     BETWEEN 0 AND 1),
    w_new_supply            NUMERIC(5,4)    NOT NULL DEFAULT 0.08 CHECK (w_new_supply            BETWEEN 0 AND 1),
    w_property_tax_burden   NUMERIC(5,4)    NOT NULL DEFAULT 0.09 CHECK (w_property_tax_burden   BETWEEN 0 AND 1),
    w_flood_risk            NUMERIC(5,4)    NOT NULL DEFAULT 0.08 CHECK (w_flood_risk            BETWEEN 0 AND 1),
    w_wetland_risk          NUMERIC(5,4)    NOT NULL DEFAULT 0.06 CHECK (w_wetland_risk          BETWEEN 0 AND 1),
    w_infrastructure_access NUMERIC(5,4)    NOT NULL DEFAULT 0.06 CHECK (w_infrastructure_access BETWEEN 0 AND 1),

    -- Full breakpoint tables for sub-indicator normalization (JSONB)
    -- Format: {"land_cost_per_unit": [{"raw": 10000, "score": 10.0}, ...], ...}
    breakpoints             JSONB           NOT NULL DEFAULT '{}'::JSONB,

    -- Bonus modifier definitions
    -- Format: [{"name": "opportunity_zone", "points": 3, "description": "..."}]
    bonus_definitions       JSONB           NOT NULL DEFAULT '[]'::JSONB,

    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.score_model_versions             IS 'Versioned scoring model definitions — indicator weights and breakpoint tables.';
COMMENT ON COLUMN public.score_model_versions.version_number IS 'Semantic version string matching the PRD revision, e.g. ''v1.0''.';
COMMENT ON COLUMN public.score_model_versions.breakpoints IS 'JSONB map of indicator name to sorted [{raw, score}] breakpoint array.';
COMMENT ON COLUMN public.score_model_versions.bonus_definitions IS 'Available bonus modifiers with point values and eligibility criteria.';
COMMENT ON COLUMN public.score_model_versions.is_active   IS 'Only one version should be active at a time for new score calculations.';

CREATE INDEX idx_score_model_effective ON public.score_model_versions(effective_date DESC);
CREATE INDEX idx_score_model_active    ON public.score_model_versions(is_active) WHERE is_active = TRUE;

CREATE TRIGGER trg_score_model_versions_updated_at
    BEFORE UPDATE ON public.score_model_versions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed v1.0 model (PRD-approved weights)
INSERT INTO public.score_model_versions (
    version_number, effective_date, is_active, description,
    w_land_cost_per_unit, w_rent_growth,     w_population_growth,
    w_median_hh_income,   w_employment_growth, w_new_supply,
    w_property_tax_burden, w_flood_risk,     w_wetland_risk,
    w_infrastructure_access
) VALUES (
    'v1.0', '2026-01-01', TRUE,
    'Initial scoring model per approved PRD. Financial domain 34%, Market 46%, Risk 20%.',
    0.25, 0.12, 0.10,
    0.08, 0.08, 0.08,
    0.09, 0.08, 0.06,
    0.06
);

-- ---------------------------------------------------------------------------
-- TABLE: underwriting_snapshots
-- Point-in-time development underwriting tied to a listing
-- All 10 financial metrics from the PRD underwriting model
-- ---------------------------------------------------------------------------

CREATE TABLE public.underwriting_snapshots (
    id                          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id                 UUID            NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
    listing_id                  UUID            NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
    score_model_version_id      UUID            REFERENCES public.score_model_versions(id) ON DELETE SET NULL,
    created_by                  UUID            REFERENCES public.users(id) ON DELETE SET NULL,
    calculated_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- -------------------------------------------------------------------------
    -- METRIC 1: Listing price (captured from listing at snapshot time)
    -- -------------------------------------------------------------------------
    snap_listing_price          NUMERIC(15,2)   CHECK (snap_listing_price > 0),

    -- -------------------------------------------------------------------------
    -- METRIC 2: Property taxes (annual, from most recent tax record)
    -- -------------------------------------------------------------------------
    snap_annual_taxes           NUMERIC(12,2)   CHECK (snap_annual_taxes >= 0),
    snap_tax_year               SMALLINT,
    snap_uses_post_sale_tax     BOOLEAN         NOT NULL DEFAULT FALSE,  -- TRUE if Greenbelt reset applied

    -- -------------------------------------------------------------------------
    -- METRIC 3: Acreage
    -- -------------------------------------------------------------------------
    snap_gross_acreage          NUMERIC(10,4)   CHECK (snap_gross_acreage > 0),
    snap_net_buildable_acreage  NUMERIC(10,4)   CHECK (snap_net_buildable_acreage > 0),

    -- -------------------------------------------------------------------------
    -- METRIC 4: Price per acre
    -- -------------------------------------------------------------------------
    snap_price_per_acre         NUMERIC(12,2)   CHECK (snap_price_per_acre > 0),

    -- -------------------------------------------------------------------------
    -- METRIC 5: Estimated units allowed
    -- -------------------------------------------------------------------------
    assumed_units_allowed       INTEGER         NOT NULL CHECK (assumed_units_allowed BETWEEN 1 AND 500),
    assumed_density_du_acre     NUMERIC(8,2)    CHECK (assumed_density_du_acre > 0),
    units_basis                 TEXT            CHECK (units_basis IN ('by_right','rezoning','pud','manual')),

    -- -------------------------------------------------------------------------
    -- METRIC 6: Land cost per buildable unit (derived)
    -- -------------------------------------------------------------------------
    land_cost_per_buildable_unit NUMERIC(12,2),

    -- -------------------------------------------------------------------------
    -- METRIC 7: Total development cost
    -- Assumptions stored for full reproducibility
    -- -------------------------------------------------------------------------
    assumed_construction_type   TEXT            CHECK (assumed_construction_type IN ('garden','podium','wrap','mid_rise')),
    assumed_hard_cost_per_unit  NUMERIC(10,2)   CHECK (assumed_hard_cost_per_unit >= 0),
    assumed_soft_cost_pct       NUMERIC(5,4)    CHECK (assumed_soft_cost_pct BETWEEN 0 AND 1),
    assumed_financing_cost_pct  NUMERIC(5,4)    CHECK (assumed_financing_cost_pct BETWEEN 0 AND 1),
    assumed_contingency_pct     NUMERIC(5,4)    CHECK (assumed_contingency_pct BETWEEN 0 AND 1),
    derived_hard_cost_total     NUMERIC(15,2),
    derived_soft_cost_total     NUMERIC(15,2),
    derived_financing_cost_total NUMERIC(15,2),
    total_development_cost      NUMERIC(15,2),

    -- -------------------------------------------------------------------------
    -- METRIC 8: Estimated stabilized value
    -- -------------------------------------------------------------------------
    assumed_avg_market_rent     NUMERIC(8,2)    CHECK (assumed_avg_market_rent >= 0),
    assumed_rent_source         TEXT            CHECK (assumed_rent_source IN ('CoStar','HUD_FMR','Zillow','Manual')),
    assumed_vacancy_rate        NUMERIC(5,4)    CHECK (assumed_vacancy_rate BETWEEN 0 AND 1),
    assumed_expense_ratio       NUMERIC(5,4)    CHECK (assumed_expense_ratio BETWEEN 0 AND 1),
    assumed_exit_cap_rate       NUMERIC(6,5)    CHECK (assumed_exit_cap_rate > 0),
    derived_gross_potential_rent NUMERIC(15,2),
    derived_effective_gross_income NUMERIC(15,2),
    derived_operating_expenses  NUMERIC(15,2),
    noi_annual                  NUMERIC(15,2),
    stabilized_value            NUMERIC(15,2),

    -- -------------------------------------------------------------------------
    -- METRIC 9: Developer profit
    -- -------------------------------------------------------------------------
    developer_profit_absolute   NUMERIC(15,2),
    developer_profit_margin_pct NUMERIC(6,4),   -- decimal (0.18 = 18%)

    -- -------------------------------------------------------------------------
    -- METRIC 10: Return on cost
    -- -------------------------------------------------------------------------
    return_on_cost              NUMERIC(6,5),   -- decimal (0.065 = 6.5%)
    roc_vs_cap_rate_spread      NUMERIC(6,5),   -- return_on_cost - assumed_exit_cap_rate

    -- -------------------------------------------------------------------------
    -- User override tracking
    -- -------------------------------------------------------------------------
    -- JSONB map of field names that were manually changed from system defaults
    -- e.g. {"assumed_avg_market_rent": true, "assumed_exit_cap_rate": true}
    user_override_flags         JSONB           NOT NULL DEFAULT '{}'::JSONB,
    is_system_generated         BOOLEAN         NOT NULL DEFAULT TRUE,

    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.underwriting_snapshots                  IS 'Point-in-time development underwriting with all 10 PRD financial metrics.';
COMMENT ON COLUMN public.underwriting_snapshots.calculated_at    IS 'Timestamp when this underwriting model was run.';
COMMENT ON COLUMN public.underwriting_snapshots.snap_uses_post_sale_tax IS 'TRUE when Greenbelt reset tax (not current exempt tax) is used in underwriting.';
COMMENT ON COLUMN public.underwriting_snapshots.units_basis      IS 'How unit count was determined: by_right | rezoning | pud | manual.';
COMMENT ON COLUMN public.underwriting_snapshots.return_on_cost   IS 'noi_annual / total_development_cost as decimal.';
COMMENT ON COLUMN public.underwriting_snapshots.roc_vs_cap_rate_spread IS 'Positive spread confirms developer is capturing a premium over exit yield.';
COMMENT ON COLUMN public.underwriting_snapshots.user_override_flags IS 'JSONB map of assumption fields manually overridden by the user.';

CREATE INDEX idx_underwriting_property  ON public.underwriting_snapshots(property_id);
CREATE INDEX idx_underwriting_listing   ON public.underwriting_snapshots(listing_id, calculated_at DESC);
CREATE INDEX idx_underwriting_model     ON public.underwriting_snapshots(score_model_version_id);
CREATE INDEX idx_underwriting_roc       ON public.underwriting_snapshots(return_on_cost DESC);
CREATE INDEX idx_underwriting_overrides ON public.underwriting_snapshots USING GIN(user_override_flags);

CREATE TRIGGER trg_underwriting_snapshots_updated_at
    BEFORE UPDATE ON public.underwriting_snapshots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.underwriting_snapshots ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- TABLE: opportunity_score_details
-- Full sub-indicator breakdown for every scored listing
-- Supplements public.opportunity_scores (which stores the final composite)
-- ---------------------------------------------------------------------------

CREATE TABLE public.opportunity_score_details (
    id                          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id                 UUID            NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    listing_id                  UUID            NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    underwriting_id             UUID            REFERENCES public.underwriting_snapshots(id) ON DELETE SET NULL,
    score_model_version_id      UUID            NOT NULL REFERENCES public.score_model_versions(id) ON DELETE RESTRICT,
    calculated_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- -------------------------------------------------------------------------
    -- Sub-indicator raw values
    -- -------------------------------------------------------------------------
    raw_land_cost_per_unit      NUMERIC(12,2),
    raw_rent_growth_pct         NUMERIC(6,4),
    raw_population_growth_pct   NUMERIC(7,5),
    raw_median_hh_income        NUMERIC(10,2),
    raw_employment_growth_pct   NUMERIC(7,5),
    raw_supply_pressure_ratio   NUMERIC(8,4),
    raw_effective_tax_rate      NUMERIC(8,6),
    raw_sfha_pct                NUMERIC(5,2),
    raw_wetland_coverage_pct    NUMERIC(5,2),
    -- Infrastructure sub-components (each scored 0–10 before weighting)
    raw_infra_water_dist_ft     NUMERIC(8,1),
    raw_infra_sewer_dist_ft     NUMERIC(8,1),
    raw_infra_road_type         TEXT,
    raw_infra_transit_dist_ft   NUMERIC(8,1),

    -- -------------------------------------------------------------------------
    -- Normalized scores (0.00–10.00 per indicator)
    -- -------------------------------------------------------------------------
    norm_land_cost_per_unit     NUMERIC(5,2)    CHECK (norm_land_cost_per_unit     BETWEEN 0 AND 10),
    norm_rent_growth            NUMERIC(5,2)    CHECK (norm_rent_growth            BETWEEN 0 AND 10),
    norm_population_growth      NUMERIC(5,2)    CHECK (norm_population_growth      BETWEEN 0 AND 10),
    norm_median_hh_income       NUMERIC(5,2)    CHECK (norm_median_hh_income       BETWEEN 0 AND 10),
    norm_employment_growth      NUMERIC(5,2)    CHECK (norm_employment_growth      BETWEEN 0 AND 10),
    norm_new_supply             NUMERIC(5,2)    CHECK (norm_new_supply             BETWEEN 0 AND 10),
    norm_property_tax_burden    NUMERIC(5,2)    CHECK (norm_property_tax_burden    BETWEEN 0 AND 10),
    norm_flood_risk             NUMERIC(5,2)    CHECK (norm_flood_risk             BETWEEN 0 AND 10),
    norm_wetland_risk           NUMERIC(5,2)    CHECK (norm_wetland_risk           BETWEEN 0 AND 10),
    norm_infrastructure_access  NUMERIC(5,2)    CHECK (norm_infrastructure_access  BETWEEN 0 AND 10),

    -- -------------------------------------------------------------------------
    -- Weighted point contributions (norm_score × weight × 10 = points)
    -- -------------------------------------------------------------------------
    pts_land_cost_per_unit      NUMERIC(6,3),
    pts_rent_growth             NUMERIC(6,3),
    pts_population_growth       NUMERIC(6,3),
    pts_median_hh_income        NUMERIC(6,3),
    pts_employment_growth       NUMERIC(6,3),
    pts_new_supply              NUMERIC(6,3),
    pts_property_tax_burden     NUMERIC(6,3),
    pts_flood_risk              NUMERIC(6,3),
    pts_wetland_risk            NUMERIC(6,3),
    pts_infrastructure_access   NUMERIC(6,3),

    -- -------------------------------------------------------------------------
    -- Bonus modifiers — [{name, points, reason}]
    -- -------------------------------------------------------------------------
    bonus_modifiers             JSONB           NOT NULL DEFAULT '[]'::JSONB,
    bonus_points_total          NUMERIC(5,2)    NOT NULL DEFAULT 0,

    -- -------------------------------------------------------------------------
    -- Composite scores
    -- -------------------------------------------------------------------------
    base_composite_score        NUMERIC(6,2)    NOT NULL CHECK (base_composite_score BETWEEN 0 AND 100),
    final_score                 NUMERIC(6,2)    NOT NULL CHECK (final_score BETWEEN 0 AND 100),
    score_label                 TEXT            NOT NULL
                                                CHECK (score_label IN (
                                                    'Exceptional','Strong','Solid','Marginal','Weak'
                                                )),
    -- The 2–3 indicators with highest marginal improvement potential
    improvement_levers          JSONB           NOT NULL DEFAULT '[]'::JSONB,
    -- e.g. [{"indicator": "land_cost_per_unit", "current_pts": 10.0, "max_pts": 25.0, "gap": 15.0, "hint": "..."}]

    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.opportunity_score_details              IS 'Full sub-indicator score breakdown per listing snapshot — feeds the deal card Score Breakdown Panel.';
COMMENT ON COLUMN public.opportunity_score_details.bonus_modifiers IS 'Applied bonus modifier objects: [{name, points, reason}].';
COMMENT ON COLUMN public.opportunity_score_details.base_composite_score IS 'Sum of all 10 weighted point contributions before bonuses.';
COMMENT ON COLUMN public.opportunity_score_details.final_score  IS 'base_composite_score + bonus_points_total, hard-capped at 100.';
COMMENT ON COLUMN public.opportunity_score_details.score_label  IS 'Exceptional (85–100) | Strong (70–84) | Solid (55–69) | Marginal (40–54) | Weak (<40).';
COMMENT ON COLUMN public.opportunity_score_details.improvement_levers IS 'Top 2–3 indicators where a change in inputs would most improve the score.';

CREATE INDEX idx_score_details_property  ON public.opportunity_score_details(property_id);
CREATE INDEX idx_score_details_listing   ON public.opportunity_score_details(listing_id, calculated_at DESC);
CREATE INDEX idx_score_details_final     ON public.opportunity_score_details(final_score DESC);
CREATE INDEX idx_score_details_label     ON public.opportunity_score_details(score_label);
CREATE INDEX idx_score_details_model     ON public.opportunity_score_details(score_model_version_id);
CREATE INDEX idx_score_details_bonuses   ON public.opportunity_score_details USING GIN(bonus_modifiers);
CREATE INDEX idx_score_details_levers    ON public.opportunity_score_details USING GIN(improvement_levers);

CREATE TRIGGER trg_opportunity_score_details_updated_at
    BEFORE UPDATE ON public.opportunity_score_details
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.opportunity_score_details ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- TABLE: daily_rankings
-- Daily ranked list of active listings by final opportunity score
-- Drives the morning digest and the ranked deal feed
-- ---------------------------------------------------------------------------

CREATE TABLE public.daily_rankings (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    ranking_date        DATE            NOT NULL,
    listing_id          UUID            NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
    property_id         UUID            NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
    score_detail_id     UUID            REFERENCES public.opportunity_score_details(id) ON DELETE SET NULL,

    rank_position       INTEGER         NOT NULL CHECK (rank_position >= 1),
    score_at_ranking    NUMERIC(6,2)    NOT NULL CHECK (score_at_ranking BETWEEN 0 AND 100),
    score_label         TEXT            NOT NULL
                                        CHECK (score_label IN (
                                            'Exceptional','Strong','Solid','Marginal','Weak'
                                        )),

    -- Whether this listing appeared in the morning email/SMS digest
    in_morning_digest   BOOLEAN         NOT NULL DEFAULT FALSE,

    -- Key metrics snapshotted for fast feed rendering (avoids joins)
    snap_listing_price  NUMERIC(15,2),
    snap_acreage        NUMERIC(10,4),
    snap_units_allowed  INTEGER,
    snap_land_per_unit  NUMERIC(12,2),
    snap_roc            NUMERIC(6,5),
    snap_county_name    TEXT,
    snap_address        TEXT,

    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_ranking_date_listing UNIQUE (ranking_date, listing_id),
    CONSTRAINT uq_ranking_date_rank    UNIQUE (ranking_date, rank_position)
);

COMMENT ON TABLE  public.daily_rankings                  IS 'Daily ranked list of active listings by composite opportunity score.';
COMMENT ON COLUMN public.daily_rankings.rank_position    IS 'Ordinal rank for the day (1 = top-ranked opportunity).';
COMMENT ON COLUMN public.daily_rankings.in_morning_digest IS 'TRUE if included in the morning email/SMS digest for that date.';
COMMENT ON COLUMN public.daily_rankings.snap_listing_price IS 'Denormalized listing price for fast feed rendering without joins.';

-- Composite for daily feed (date + ascending rank)
CREATE INDEX idx_rankings_date_rank  ON public.daily_rankings(ranking_date DESC, rank_position ASC);
CREATE INDEX idx_rankings_listing    ON public.daily_rankings(listing_id, ranking_date DESC);
CREATE INDEX idx_rankings_property   ON public.daily_rankings(property_id, ranking_date DESC);

-- Partial index for digest-only queries
CREATE INDEX idx_rankings_digest     ON public.daily_rankings(ranking_date DESC)
    WHERE in_morning_digest = TRUE;

-- Partial index for Exceptional/Strong deals for fast top-tier feed
CREATE INDEX idx_rankings_top_tier   ON public.daily_rankings(ranking_date DESC, rank_position ASC)
    WHERE score_label IN ('Exceptional', 'Strong');

-- =============================================================================
-- END OF MIGRATION 003
-- =============================================================================
