-- =============================================================================
-- Florida Builder Deal Finder — PostgreSQL / Supabase Schema
-- Target:   PostgreSQL 15 + PostGIS + pgvector (Supabase)
-- Coverage: Broward → St. Lucie counties (east coast Florida)
-- Scale:    10K–200K+ parcels
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Shared trigger function: keep updated_at current
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- =============================================================================
-- TABLE: users
-- Extends Supabase auth.users — one row per authenticated user
-- =============================================================================

CREATE TABLE public.users (
    id                          UUID            PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email                       TEXT            NOT NULL,
    full_name                   TEXT,
    company                     TEXT,
    phone                       TEXT,
    role                        TEXT            NOT NULL DEFAULT 'viewer'
                                    CHECK (role IN ('admin', 'analyst', 'viewer')),
    gc_license_number           TEXT,
    -- JSON object: {"email": true, "sms": false, "push": true}
    notification_preferences    JSONB           NOT NULL DEFAULT '{}',
    subscription_tier           TEXT            NOT NULL DEFAULT 'free'
                                    CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
    subscription_expires_at     TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.users IS 'Application user profiles extending Supabase auth.users.';
COMMENT ON COLUMN public.users.gc_license_number IS 'Florida General Contractor license number, if applicable.';
COMMENT ON COLUMN public.users.notification_preferences IS 'Per-channel notification preferences: {"email": bool, "sms": bool, "push": bool}.';
COMMENT ON COLUMN public.users.subscription_expires_at IS 'NULL means the subscription does not expire (e.g. annual billing managed externally).';

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TABLE: counties
-- Lookup table for the 5 target counties on Florida's east coast
-- =============================================================================

CREATE TABLE public.counties (
    id                      SERIAL          PRIMARY KEY,
    name                    TEXT            NOT NULL,
    fips_code               TEXT            NOT NULL UNIQUE,
    state                   TEXT            NOT NULL DEFAULT 'FL',
    -- Base URL for the county property appraiser API
    appraiser_api_url       TEXT,
    -- Reference key into Supabase Vault — never store the actual key here
    appraiser_api_key_ref   TEXT,
    last_synced_at          TIMESTAMPTZ,
    boundary                GEOMETRY(MULTIPOLYGON, 4326),
    total_parcels           INT,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.counties IS 'Target counties: Broward, Palm Beach, Martin, Indian River, St. Lucie.';
COMMENT ON COLUMN public.counties.appraiser_api_key_ref IS 'Supabase Vault secret reference (e.g. vault://secrets/broward_pa_key). Never the raw key.';
COMMENT ON COLUMN public.counties.fips_code IS 'FIPS county code, e.g. 12011 = Broward.';

CREATE INDEX idx_counties_boundary ON public.counties USING GIST (boundary);

-- =============================================================================
-- TABLE: municipalities
-- Cities, towns, and unincorporated areas within target counties
-- =============================================================================

CREATE TABLE public.municipalities (
    id                      SERIAL          PRIMARY KEY,
    county_id               INT             NOT NULL REFERENCES public.counties(id) ON DELETE RESTRICT,
    name                    TEXT            NOT NULL,
    type                    TEXT            NOT NULL DEFAULT 'city'
                                CHECK (type IN ('city', 'town', 'village', 'unincorporated')),
    boundary                GEOMETRY(MULTIPOLYGON, 4326),
    zoning_ordinance_url    TEXT,
    planning_dept_phone     TEXT,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.municipalities IS 'Incorporated cities/towns and unincorporated county areas.';

CREATE INDEX idx_municipalities_county_id ON public.municipalities (county_id);
CREATE INDEX idx_municipalities_boundary  ON public.municipalities USING GIST (boundary);

-- =============================================================================
-- TABLE: properties
-- Master parcel table — one row per unique tax parcel
-- =============================================================================

CREATE TABLE public.properties (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    -- County appraiser parcel identification number
    parcel_id           TEXT            NOT NULL,
    county_id           INT             NOT NULL REFERENCES public.counties(id) ON DELETE RESTRICT,
    municipality_id     INT             REFERENCES public.municipalities(id) ON DELETE SET NULL,
    address_street      TEXT,
    address_city        TEXT,
    address_state       TEXT            DEFAULT 'FL',
    address_zip         TEXT,
    latitude            NUMERIC(10,7),
    longitude           NUMERIC(10,7),
    -- Derived point geometry — auto-maintained via generated column
    location            GEOMETRY(POINT, 4326)
                            GENERATED ALWAYS AS (
                                CASE
                                    WHEN latitude IS NOT NULL AND longitude IS NOT NULL
                                    THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
                                    ELSE NULL
                                END
                            ) STORED,
    -- Full parcel boundary polygon from county GIS
    shape               GEOMETRY(MULTIPOLYGON, 4326),
    lot_size_sqft       NUMERIC(14,2),
    lot_size_acres      NUMERIC(10,4),
    frontage_ft         NUMERIC(10,2),
    depth_ft            NUMERIC(10,2),
    is_corner_lot       BOOLEAN         DEFAULT FALSE,
    is_vacant           BOOLEAN         DEFAULT FALSE,
    is_distressed       BOOLEAN         DEFAULT FALSE,
    has_code_violations BOOLEAN         DEFAULT FALSE,
    has_tax_liens       BOOLEAN         DEFAULT FALSE,
    has_lis_pendens     BOOLEAN         DEFAULT FALSE,
    -- Data origin: 'county_pa', 'mls', 'manual', etc.
    source              TEXT,
    raw_data            JSONB,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_properties_parcel_county UNIQUE (parcel_id, county_id)
);

COMMENT ON TABLE  public.properties IS 'Master parcel record sourced from county property appraisers.';
COMMENT ON COLUMN public.properties.parcel_id IS 'County appraiser folio / parcel ID — unique within a county.';
COMMENT ON COLUMN public.properties.location IS 'PostGIS POINT derived from lat/lon — generated stored column.';
COMMENT ON COLUMN public.properties.shape IS 'Full parcel boundary polygon from county GIS download.';
COMMENT ON COLUMN public.properties.has_lis_pendens IS 'Active lis pendens filing indicates pending litigation (often pre-foreclosure).';

CREATE INDEX idx_properties_location      ON public.properties USING GIST (location);
CREATE INDEX idx_properties_shape         ON public.properties USING GIST (shape);
CREATE INDEX idx_properties_county_id     ON public.properties (county_id);
CREATE INDEX idx_properties_is_vacant     ON public.properties (is_vacant);
CREATE INDEX idx_properties_is_distressed ON public.properties (is_distressed);

CREATE TRIGGER trg_properties_updated_at
    BEFORE UPDATE ON public.properties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TABLE: parcel_data
-- Physical characteristics and tax assessment attributes (1-to-1 with properties)
-- =============================================================================

CREATE TABLE public.parcel_data (
    id                          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id                 UUID            NOT NULL UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
    land_use_code               TEXT,
    building_sqft               NUMERIC(12,2),
    year_built                  INT,
    stories                     SMALLINT,
    units                       INT,
    bedrooms                    INT,
    bathrooms                   NUMERIC(4,1),
    construction_type           TEXT,
    roof_type                   TEXT,
    assessed_value              NUMERIC(14,2),
    land_value                  NUMERIC(14,2),
    improvement_value           NUMERIC(14,2),
    total_value                 NUMERIC(14,2),
    taxable_value               NUMERIC(14,2),
    -- Homestead / other exemption reductions
    exemption_value             NUMERIC(14,2),
    -- e.g. ARRAY['homestead','senior','widow']
    exemption_types             TEXT[],
    tax_year                    INT,
    annual_taxes                NUMERIC(12,2),
    price_per_sqft_land         NUMERIC(10,2),
    price_per_acre              NUMERIC(12,2),
    -- Ratio < 1 indicates potential value dislocation opportunity
    assessed_to_market_ratio    NUMERIC(6,4),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.parcel_data IS 'Physical characteristics and tax assessment data — one-to-one with properties.';
COMMENT ON COLUMN public.parcel_data.land_use_code IS 'Florida DOR land use classification code (e.g. 00=vacant, 01=SFR).';
COMMENT ON COLUMN public.parcel_data.assessed_to_market_ratio IS 'assessed_value / total_value. Low ratio may signal SOH cap dislocation.';

CREATE TRIGGER trg_parcel_data_updated_at
    BEFORE UPDATE ON public.parcel_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.parcel_data ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TABLE: ownership
-- Current and historical ownership records (SCD type-2)
-- =============================================================================

CREATE TABLE public.ownership (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id             UUID            NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    owner_name              TEXT,
    owner_type              TEXT            CHECK (owner_type IN ('individual', 'llc', 'trust', 'corporation', 'government')),
    owner_address_street    TEXT,
    owner_address_city      TEXT,
    owner_address_state     TEXT,
    owner_address_zip       TEXT,
    is_homesteaded          BOOLEAN         DEFAULT FALSE,
    -- Owner mailing address is outside Florida
    is_out_of_state_owner   BOOLEAN         DEFAULT FALSE,
    is_corporate_owner      BOOLEAN         DEFAULT FALSE,
    years_owned             NUMERIC(6,2),
    acquisition_date        DATE,
    acquisition_price       NUMERIC(14,2),
    is_current              BOOLEAN         NOT NULL DEFAULT TRUE,
    -- SCD type 2 validity window
    valid_from              TIMESTAMPTZ,
    valid_to                TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.ownership IS 'Current and historical ownership with SCD type-2 validity window.';
COMMENT ON COLUMN public.ownership.is_out_of_state_owner IS 'True when mailing address state != FL — absentee owner signal.';
COMMENT ON COLUMN public.ownership.valid_from IS 'Start of ownership period (SCD type 2).';
COMMENT ON COLUMN public.ownership.valid_to IS 'End of ownership period; NULL for current owner record.';

CREATE INDEX idx_ownership_property_id       ON public.ownership (property_id);
CREATE INDEX idx_ownership_owner_name        ON public.ownership (owner_name);
CREATE INDEX idx_ownership_is_current        ON public.ownership (is_current);
CREATE INDEX idx_ownership_is_out_of_state   ON public.ownership (is_out_of_state_owner);

ALTER TABLE public.ownership ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TABLE: sales_history
-- All recorded deed transfers for a parcel
-- =============================================================================

CREATE TABLE public.sales_history (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id         UUID            NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    sale_date           DATE            NOT NULL,
    sale_price          NUMERIC(14,2),
    grantor             TEXT,
    grantee             TEXT,
    -- Deed instrument classification
    deed_type           TEXT            CHECK (deed_type IN ('warranty', 'quitclaim', 'tax_deed', 'foreclosure', 'special_warranty', 'trustees', 'other')),
    book                TEXT,
    page                TEXT,
    instrument_number   TEXT,
    recorded_date       DATE,
    -- Arms-length = open market transaction; FALSE for family transfers, foreclosures, etc.
    is_arms_length      BOOLEAN,
    price_per_sqft      NUMERIC(10,2),
    price_per_acre      NUMERIC(12,2),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.sales_history IS 'All recorded deed transfers sourced from county official records.';
COMMENT ON COLUMN public.sales_history.is_arms_length IS 'FALSE for inter-family, foreclosure, or nominal-consideration transfers.';
COMMENT ON COLUMN public.sales_history.deed_type IS 'Deed instrument type — tax_deed and foreclosure are distress signals.';

CREATE INDEX idx_sales_history_property_date ON public.sales_history (property_id, sale_date DESC);
CREATE INDEX idx_sales_history_sale_date     ON public.sales_history (sale_date);
CREATE INDEX idx_sales_history_grantor       ON public.sales_history (grantor);
CREATE INDEX idx_sales_history_grantee       ON public.sales_history (grantee);

ALTER TABLE public.sales_history ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TABLE: zoning
-- Current zoning designation and future land use (1-to-1 with properties)
-- =============================================================================

CREATE TABLE public.zoning (
    id                          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id                 UUID            NOT NULL UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
    county_id                   INT             NOT NULL REFERENCES public.counties(id) ON DELETE RESTRICT,
    municipality_id             INT             REFERENCES public.municipalities(id) ON DELETE SET NULL,
    zoning_code                 TEXT            NOT NULL,
    zoning_description          TEXT,
    zoning_category             TEXT            CHECK (zoning_category IN ('residential', 'commercial', 'industrial', 'agricultural', 'mixed', 'institutional')),
    future_land_use             TEXT,
    flu_category                TEXT,
    max_density_units_per_acre  NUMERIC(8,2),
    max_height_ft               NUMERIC(8,2),
    max_height_stories          SMALLINT,
    min_lot_size_sqft           NUMERIC(12,2),
    max_lot_coverage_pct        NUMERIC(5,2),
    -- Floor area ratio: total building sqft / lot sqft
    max_far                     NUMERIC(6,3),
    setback_front_ft            NUMERIC(8,2),
    setback_rear_ft             NUMERIC(8,2),
    setback_side_ft             NUMERIC(8,2),
    allowable_uses              TEXT[],
    conditional_uses            TEXT[],
    overlay_districts           TEXT[],
    -- Planned Unit Development flag
    is_pud                      BOOLEAN         DEFAULT FALSE,
    pud_name                    TEXT,
    -- Historical variance / waiver events as JSONB array
    variance_history            JSONB,
    -- Scoring engine output: likelihood of favorable rezoning
    upzoning_potential          TEXT            CHECK (upzoning_potential IN ('low', 'medium', 'high')),
    rezoning_notes              TEXT,
    source_url                  TEXT,
    verified_at                 TIMESTAMPTZ,
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.zoning IS 'Current zoning and future land use — authoritative from county/municipal GIS.';
COMMENT ON COLUMN public.zoning.max_far IS 'Floor Area Ratio: maximum ratio of gross floor area to lot area.';
COMMENT ON COLUMN public.zoning.upzoning_potential IS 'Analyst / AI-assessed likelihood of favorable upzoning (low/medium/high).';
COMMENT ON COLUMN public.zoning.variance_history IS 'Array of past variance/waiver events: [{date, type, outcome, notes}].';
COMMENT ON COLUMN public.zoning.overlay_districts IS 'e.g. CRA overlay, coastal high hazard, transit corridor.';

CREATE INDEX idx_zoning_county_id ON public.zoning (county_id);

CREATE TRIGGER trg_zoning_updated_at
    BEFORE UPDATE ON public.zoning
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.zoning ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TABLE: listings
-- Active and historical MLS / commercial listing records
-- =============================================================================

CREATE TABLE public.listings (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id             UUID            NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    mls_number              TEXT,
    listing_source          TEXT            CHECK (listing_source IN ('mls', 'loopnet', 'crexi', 'owner', 'auction')),
    listing_type            TEXT            CHECK (listing_type IN ('sale', 'lease', 'auction')),
    list_price              NUMERIC(14,2),
    price_per_sqft          NUMERIC(10,2),
    price_per_acre          NUMERIC(12,2),
    list_date               DATE,
    expiration_date         DATE,
    close_date              DATE,
    close_price             NUMERIC(14,2),
    days_on_market          INT,
    status                  TEXT            NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'pending', 'sold', 'expired', 'withdrawn', 'cancelled')),
    listing_agent_name      TEXT,
    listing_agent_phone     TEXT,
    listing_agent_email     TEXT,
    listing_brokerage       TEXT,
    listing_url             TEXT,
    description             TEXT,
    -- JSONB array of photo objects: [{url, caption, order}]
    photos                  JSONB,
    is_current              BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.listings IS 'MLS and commercial listing records, current and historical.';
COMMENT ON COLUMN public.listings.photos IS 'Array of photo objects: [{url: string, caption: string, order: int}].';
COMMENT ON COLUMN public.listings.is_current IS 'TRUE for the most recent active listing on a property.';

CREATE INDEX idx_listings_property_id ON public.listings (property_id);
CREATE INDEX idx_listings_status      ON public.listings (status);
CREATE INDEX idx_listings_list_date   ON public.listings (list_date DESC);
CREATE INDEX idx_listings_is_current  ON public.listings (is_current);
CREATE INDEX idx_listings_mls_number  ON public.listings (mls_number);

CREATE TRIGGER trg_listings_updated_at
    BEFORE UPDATE ON public.listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TABLE: flood_zones
-- FEMA FIRM flood zone data spatially joined to parcels (1-to-1)
-- =============================================================================

CREATE TABLE public.flood_zones (
    id                          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id                 UUID            NOT NULL UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
    -- FEMA flood zone designation: AE, X, VE, AH, AO, D
    fema_zone_code              TEXT,
    fema_zone_description       TEXT,
    firm_panel_number           TEXT,
    firm_effective_date         DATE,
    -- Base Flood Elevation in feet NAVD88
    base_flood_elevation_ft     NUMERIC(8,2),
    -- TRUE for Zone A, AE, AH, AO, AR, V, VE — mandatory purchase requirement
    is_special_flood_hazard     BOOLEAN         DEFAULT FALSE,
    flood_insurance_required    BOOLEAN         DEFAULT FALSE,
    -- Percentage of parcel area within a flood zone (0.00–100.00)
    pct_parcel_in_flood_zone    NUMERIC(5,2),
    last_updated                TIMESTAMPTZ,
    -- FEMA FIRM flood zone polygon geometry
    geometry                    GEOMETRY(MULTIPOLYGON, 4326)
);

COMMENT ON TABLE  public.flood_zones IS 'FEMA FIRM flood zone data — spatially intersected with parcel boundary.';
COMMENT ON COLUMN public.flood_zones.fema_zone_code IS 'AE = 1% annual chance; X = minimal; VE = coastal high velocity; D = undetermined.';
COMMENT ON COLUMN public.flood_zones.base_flood_elevation_ft IS 'BFE in feet above NAVD88 datum; NULL for Zone X and D.';
COMMENT ON COLUMN public.flood_zones.pct_parcel_in_flood_zone IS 'Spatial intersection result: 0=no flood zone, 100=fully in flood zone.';

CREATE INDEX idx_flood_zones_geometry                ON public.flood_zones USING GIST (geometry);
CREATE INDEX idx_flood_zones_property_id             ON public.flood_zones (property_id);
CREATE INDEX idx_flood_zones_fema_zone_code          ON public.flood_zones (fema_zone_code);
CREATE INDEX idx_flood_zones_is_special_flood_hazard ON public.flood_zones (is_special_flood_hazard);

ALTER TABLE public.flood_zones ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TABLE: wetlands
-- Florida DEP / SFWMD wetland data (1-to-1 with properties)
-- =============================================================================

CREATE TABLE public.wetlands (
    id                          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id                 UUID            NOT NULL UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
    has_wetlands                BOOLEAN         NOT NULL DEFAULT FALSE,
    wetland_pct                 NUMERIC(5,2),
    wetland_sqft                NUMERIC(14,2),
    -- e.g. ARRAY['freshwater_marsh','mangrove','cypress','saltmarsh']
    wetland_types               TEXT[],
    -- South Florida Water Management District jurisdictional wetland
    sfwmd_jurisdiction          BOOLEAN         DEFAULT FALSE,
    army_corps_jurisdiction     BOOLEAN         DEFAULT FALSE,
    -- Isolated wetlands may qualify for different permitting path
    isolated_wetlands           BOOLEAN         DEFAULT FALSE,
    mitigation_bank_available   BOOLEAN         DEFAULT FALSE,
    -- Rough cost to purchase mitigation credits if wetland fill required
    mitigation_cost_estimate    NUMERIC(14,2),
    -- 0 = no risk, 10 = extreme — inverse of opportunity score contribution
    environmental_risk_score    INT             CHECK (environmental_risk_score BETWEEN 0 AND 10),
    geometry                    GEOMETRY(MULTIPOLYGON, 4326),
    last_updated                TIMESTAMPTZ
);

COMMENT ON TABLE  public.wetlands IS 'Wetland coverage from FL DEP and SFWMD spatial layers.';
COMMENT ON COLUMN public.wetlands.sfwmd_jurisdiction IS 'SFWMD ERP permit required if filling/impacting jurisdictional wetlands.';
COMMENT ON COLUMN public.wetlands.isolated_wetlands IS 'Isolated wetlands may be exempt from SFWMD jurisdiction under certain conditions.';
COMMENT ON COLUMN public.wetlands.mitigation_cost_estimate IS 'Estimated cost in dollars to purchase wetland mitigation credits.';
COMMENT ON COLUMN public.wetlands.environmental_risk_score IS 'Composite risk 0–10; fed inverted into opportunity_scores.environmental_risk_score.';

CREATE INDEX idx_wetlands_geometry     ON public.wetlands USING GIST (geometry);
CREATE INDEX idx_wetlands_property_id  ON public.wetlands (property_id);
CREATE INDEX idx_wetlands_has_wetlands ON public.wetlands (has_wetlands);

ALTER TABLE public.wetlands ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TABLE: utility_access
-- Infrastructure availability at or near the parcel (1-to-1)
-- =============================================================================

CREATE TABLE public.utility_access (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id             UUID            NOT NULL UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
    water_provider          TEXT,
    water_available         BOOLEAN         DEFAULT FALSE,
    -- Water main exists at the parcel boundary (not just nearby)
    water_at_site           BOOLEAN         DEFAULT FALSE,
    water_line_size_inches  NUMERIC(4,1),
    water_connection_fee    NUMERIC(10,2),
    sewer_provider          TEXT,
    sewer_available         BOOLEAN         DEFAULT FALSE,
    sewer_at_site           BOOLEAN         DEFAULT FALSE,
    septic_permitted        BOOLEAN         DEFAULT FALSE,
    sewer_connection_fee    NUMERIC(10,2),
    electric_provider       TEXT,
    electric_available      BOOLEAN         DEFAULT FALSE,
    -- Three-phase power required for most industrial / large commercial uses
    electric_three_phase    BOOLEAN         DEFAULT FALSE,
    gas_available           BOOLEAN         DEFAULT FALSE,
    gas_provider            TEXT,
    -- e.g. ARRAY['AT&T Fiber','Comcast','T-Mobile 5G']
    telecom_providers       TEXT[],
    fiber_available         BOOLEAN         DEFAULT FALSE,
    road_frontage_type      TEXT            CHECK (road_frontage_type IN ('paved', 'unpaved', 'none')),
    road_name               TEXT,
    road_classification     TEXT            CHECK (road_classification IN ('local', 'collector', 'arterial', 'highway')),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.utility_access IS 'Utility and infrastructure availability — 1-to-1 with properties.';
COMMENT ON COLUMN public.utility_access.water_at_site IS 'Distinguishes available nearby vs. stub at parcel — affects connection cost.';
COMMENT ON COLUMN public.utility_access.electric_three_phase IS 'Required for industrial uses; absence is a constraint for heavy commercial.';
COMMENT ON COLUMN public.utility_access.road_classification IS 'FDOT functional classification used for traffic impact study scoping.';

CREATE TRIGGER trg_utility_access_updated_at
    BEFORE UPDATE ON public.utility_access
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.utility_access ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TABLE: scoring_configs
-- Admin-managed weight/threshold configurations for the scoring engine
-- Must be created before opportunity_scores (FK dependency)
-- =============================================================================

CREATE TABLE public.scoring_configs (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT            NOT NULL,
    description     TEXT,
    is_default      BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Weight map: {"location": 0.20, "zoning_upside": 0.15, ...}
    weights         JSONB           NOT NULL,
    -- Score thresholds for grading and alerting
    thresholds      JSONB,
    created_by      UUID            REFERENCES public.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.scoring_configs IS 'Versioned scoring engine configurations — admin manages weights and thresholds.';
COMMENT ON COLUMN public.scoring_configs.weights IS 'Component weight map; values must sum to 1.0.';
COMMENT ON COLUMN public.scoring_configs.thresholds IS 'Grade cutoffs: {"A": 85, "B": 70, "C": 55, "D": 40}.';

CREATE TRIGGER trg_scoring_configs_updated_at
    BEFORE UPDATE ON public.scoring_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.scoring_configs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TABLE: opportunity_scores
-- Scoring engine output per property (1-to-1 with properties)
-- =============================================================================

CREATE TABLE public.opportunity_scores (
    id                          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id                 UUID            NOT NULL UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
    overall_score               NUMERIC(5,2)    CHECK (overall_score BETWEEN 0 AND 100),
    -- Computed letter grade derived from overall_score
    score_grade                 TEXT            GENERATED ALWAYS AS (
                                    CASE
                                        WHEN overall_score >= 85 THEN 'A'
                                        WHEN overall_score >= 70 THEN 'B'
                                        WHEN overall_score >= 55 THEN 'C'
                                        WHEN overall_score >= 40 THEN 'D'
                                        ELSE 'F'
                                    END
                                ) STORED,
    location_score              NUMERIC(5,2)    CHECK (location_score BETWEEN 0 AND 100),
    zoning_upside_score         NUMERIC(5,2)    CHECK (zoning_upside_score BETWEEN 0 AND 100),
    value_dislocation_score     NUMERIC(5,2)    CHECK (value_dislocation_score BETWEEN 0 AND 100),
    distress_signal_score       NUMERIC(5,2)    CHECK (distress_signal_score BETWEEN 0 AND 100),
    -- Higher score = lower environmental risk (inverted input)
    environmental_risk_score    NUMERIC(5,2)    CHECK (environmental_risk_score BETWEEN 0 AND 100),
    market_velocity_score       NUMERIC(5,2)    CHECK (market_velocity_score BETWEEN 0 AND 100),
    utility_readiness_score     NUMERIC(5,2)    CHECK (utility_readiness_score BETWEEN 0 AND 100),
    -- Additive points: opportunity zone, CRA, assemblage potential
    bonus_points                NUMERIC(5,2),
    -- Snapshot of the weight configuration used for this score run
    score_weights               JSONB,
    -- All raw input values fed to the scoring engine for auditability
    score_inputs                JSONB,
    -- e.g. ARRAY['flood_zone_ae', 'wetlands_gt_30pct', 'no_sewer']
    risk_flags                  TEXT[],
    -- e.g. ARRAY['opportunity_zone', 'vacant_corner', 'below_land_value']
    upside_flags                TEXT[],
    in_opportunity_zone         BOOLEAN         DEFAULT FALSE,
    in_cra                      BOOLEAN         DEFAULT FALSE,
    -- Property can likely be assembled with adjacent parcels
    assemblage_potential        BOOLEAN         DEFAULT FALSE,
    -- GPT-4o narrative summary
    ai_summary                  TEXT,
    ai_risk_analysis            TEXT,
    ai_upside_analysis          TEXT,
    -- OpenAI text-embedding-3-small (1536-dim) for semantic search
    embedding                   VECTOR(1536),
    scoring_config_id           UUID            REFERENCES public.scoring_configs(id) ON DELETE SET NULL,
    scored_at                   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    -- Semver of scoring engine that produced this record
    scoring_version             TEXT
);

COMMENT ON TABLE  public.opportunity_scores IS 'Scoring engine output — one row per property, replaced on each re-score.';
COMMENT ON COLUMN public.opportunity_scores.score_grade IS 'Derived letter grade: A>=85, B>=70, C>=55, D>=40, F<40.';
COMMENT ON COLUMN public.opportunity_scores.environmental_risk_score IS 'Inverted risk: 100 = pristine, 0 = extreme environmental constraints.';
COMMENT ON COLUMN public.opportunity_scores.embedding IS 'pgvector 1536-dim embedding of AI summary for semantic similarity search.';
COMMENT ON COLUMN public.opportunity_scores.score_inputs IS 'Full snapshot of raw inputs for score auditability and re-computation.';

CREATE INDEX idx_opportunity_scores_overall_score ON public.opportunity_scores (overall_score DESC);
CREATE INDEX idx_opportunity_scores_property_id   ON public.opportunity_scores (property_id);
CREATE INDEX idx_opportunity_scores_scored_at     ON public.opportunity_scores (scored_at DESC);
-- IVFFlat index for approximate nearest-neighbor vector search
-- lists=100 is appropriate for 100K–500K rows; retune after bulk load
CREATE INDEX idx_opportunity_scores_embedding
    ON public.opportunity_scores
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

ALTER TABLE public.opportunity_scores ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TABLE: saved_searches
-- User-defined search presets with optional alerting
-- =============================================================================

CREATE TABLE public.saved_searches (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID            NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name                    TEXT            NOT NULL,
    description             TEXT,
    -- Full filter payload: {counties, zoning_categories, min_lot_acres, min_score, flags, ...}
    filters                 JSONB           NOT NULL,
    sort_by                 TEXT,
    sort_dir                TEXT            CHECK (sort_dir IN ('asc', 'desc')),
    alert_enabled           BOOLEAN         NOT NULL DEFAULT FALSE,
    alert_frequency         TEXT            CHECK (alert_frequency IN ('realtime', 'daily', 'weekly')),
    alert_score_threshold   NUMERIC(5,2),
    last_run_at             TIMESTAMPTZ,
    last_result_count       INT,
    -- Count of new properties matching this search since last notification
    new_since_last_run      INT             DEFAULT 0,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.saved_searches IS 'User search presets with filter snapshot and optional alert configuration.';
COMMENT ON COLUMN public.saved_searches.filters IS 'Full filter set serialised as JSONB — includes county, zoning, size, price, score, flags.';
COMMENT ON COLUMN public.saved_searches.new_since_last_run IS 'Incremented by alert worker; reset to 0 after notification is sent.';

CREATE INDEX idx_saved_searches_user_id ON public.saved_searches (user_id);

CREATE TRIGGER trg_saved_searches_updated_at
    BEFORE UPDATE ON public.saved_searches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TABLE: email_reports
-- Sent email records (daily digest, weekly summary, alert emails)
-- Must exist before alerts (FK dependency)
-- =============================================================================

CREATE TABLE public.email_reports (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID            NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    report_type         TEXT            NOT NULL
                            CHECK (report_type IN ('daily_digest', 'weekly_summary', 'alert', 'saved_search')),
    subject             TEXT,
    html_body           TEXT,
    text_body           TEXT,
    -- Array of property UUIDs included in this report
    property_ids        UUID[],
    recipient_email     TEXT,
    status              TEXT            NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
    sent_at             TIMESTAMPTZ,
    opened_at           TIMESTAMPTZ,
    clicked_at          TIMESTAMPTZ,
    -- Resend (email API) message ID for delivery tracking
    resend_message_id   TEXT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.email_reports IS 'Outbound email records — tracks delivery and engagement via Resend webhooks.';
COMMENT ON COLUMN public.email_reports.resend_message_id IS 'Message ID returned by Resend API; used to correlate webhook events.';

CREATE INDEX idx_email_reports_user_id ON public.email_reports (user_id);
CREATE INDEX idx_email_reports_status  ON public.email_reports (status);

ALTER TABLE public.email_reports ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TABLE: alerts
-- Triggered notifications from saved searches or score/price changes
-- =============================================================================

CREATE TABLE public.alerts (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID            NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    -- NULL for score-change or price-change alerts not tied to a saved search
    saved_search_id     UUID            REFERENCES public.saved_searches(id) ON DELETE SET NULL,
    -- NULL for digest-level alerts not tied to a single property
    property_id         UUID            REFERENCES public.properties(id) ON DELETE SET NULL,
    alert_type          TEXT            NOT NULL
                            CHECK (alert_type IN ('new_match', 'score_change', 'price_change', 'listing_added', 'listing_removed')),
    title               TEXT,
    body                TEXT,
    -- Flexible payload: {old_score, new_score, delta, ...}
    data                JSONB,
    is_read             BOOLEAN         NOT NULL DEFAULT FALSE,
    is_emailed          BOOLEAN         NOT NULL DEFAULT FALSE,
    emailed_at          TIMESTAMPTZ,
    email_report_id     UUID            REFERENCES public.email_reports(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.alerts IS 'In-app and email alert events for saved search matches and score/price changes.';
COMMENT ON COLUMN public.alerts.data IS 'Flexible event payload, e.g. {old_score: 72, new_score: 84, delta: 12}.';

CREATE INDEX idx_alerts_user_read  ON public.alerts (user_id, is_read);
CREATE INDEX idx_alerts_created_at ON public.alerts (created_at DESC);
CREATE INDEX idx_alerts_user_id    ON public.alerts (user_id);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TABLE: favorites
-- User property watchlist with deal-stage tracking
-- =============================================================================

CREATE TABLE public.favorites (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID            NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    property_id UUID            NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    notes       TEXT,
    tags        TEXT[],
    stage       TEXT            NOT NULL DEFAULT 'watching'
                    CHECK (stage IN ('watching', 'analyzing', 'under_contract', 'pass')),
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_favorites_user_property UNIQUE (user_id, property_id)
);

COMMENT ON TABLE  public.favorites IS 'User property watchlist — tracks deal stage from watching through under contract.';
COMMENT ON COLUMN public.favorites.stage IS 'Deal pipeline stage: watching → analyzing → under_contract | pass.';

CREATE INDEX idx_favorites_user_id     ON public.favorites (user_id);
CREATE INDEX idx_favorites_property_id ON public.favorites (property_id);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TABLE: feasibility_analyses
-- Pro forma development feasibility models per property
-- =============================================================================

CREATE TABLE public.feasibility_analyses (
    id                          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id                 UUID            NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    user_id                     UUID            NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    scenario_name               TEXT            NOT NULL DEFAULT 'Base Case',
    proposed_use                TEXT            CHECK (proposed_use IN ('sfr', 'townhomes', 'multifamily', 'mixed_use', 'commercial', 'industrial')),
    proposed_units              INT,
    proposed_sqft               NUMERIC(12,2),
    acquisition_price           NUMERIC(14,2),
    hard_cost_per_sqft          NUMERIC(10,2),
    total_hard_cost             NUMERIC(14,2),
    -- Soft costs as % of hard costs (architecture, engineering, permits, etc.)
    soft_cost_pct               NUMERIC(5,2),
    total_soft_cost             NUMERIC(14,2),
    contingency_pct             NUMERIC(5,2),
    total_contingency           NUMERIC(14,2),
    total_project_cost          NUMERIC(14,2),
    avg_sale_price_per_unit     NUMERIC(14,2),
    avg_sale_price_per_sqft     NUMERIC(10,2),
    total_revenue               NUMERIC(14,2),
    gross_profit                NUMERIC(14,2),
    gross_margin_pct            NUMERIC(5,2),
    roi_pct                     NUMERIC(5,2),
    irr_pct                     NUMERIC(5,2),
    equity_multiple             NUMERIC(6,3),
    profit_per_unit             NUMERIC(12,2),
    -- Loan-to-cost ratio
    ltc_pct                     NUMERIC(5,2),
    loan_amount                 NUMERIC(14,2),
    interest_rate               NUMERIC(5,3),
    loan_term_months            INT,
    -- Interest carry during construction and lease-up
    carry_cost                  NUMERIC(12,2),
    absorption_months           INT,
    construction_months         INT,
    ai_feasibility_notes        TEXT,
    -- Structured risk flags from AI analysis: [{flag, severity, notes}]
    ai_risk_flags               JSONB,
    -- Publicly shareable (e.g. with equity partners)
    is_public                   BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.feasibility_analyses IS 'Developer pro forma models — multiple scenarios per property.';
COMMENT ON COLUMN public.feasibility_analyses.soft_cost_pct IS 'Soft costs as % of total hard cost (typical range: 10–20%).';
COMMENT ON COLUMN public.feasibility_analyses.carry_cost IS 'Debt service interest during construction and absorption period.';
COMMENT ON COLUMN public.feasibility_analyses.ai_risk_flags IS 'Structured AI risk items: [{flag: string, severity: low|medium|high, notes: string}].';

CREATE INDEX idx_feasibility_analyses_property_id ON public.feasibility_analyses (property_id);
CREATE INDEX idx_feasibility_analyses_user_id     ON public.feasibility_analyses (user_id);

CREATE TRIGGER trg_feasibility_analyses_updated_at
    BEFORE UPDATE ON public.feasibility_analyses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.feasibility_analyses ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TABLE: market_comps
-- Comparable land and improved sales used for valuation
-- =============================================================================

CREATE TABLE public.market_comps (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    -- The subject property being analyzed
    reference_property_id   UUID            NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    -- Populated if comp parcel exists in our database
    comp_property_id        UUID            REFERENCES public.properties(id) ON DELETE SET NULL,
    comp_type               TEXT            NOT NULL
                                CHECK (comp_type IN ('land_sale', 'improved_sale', 'active_listing')),
    county_id               INT             REFERENCES public.counties(id) ON DELETE SET NULL,
    -- Full address string for comps not in our database
    address                 TEXT,
    sale_date               DATE,
    sale_price              NUMERIC(14,2),
    lot_size_sqft           NUMERIC(14,2),
    lot_size_acres          NUMERIC(10,4),
    building_sqft           NUMERIC(12,2),
    price_per_sqft_land     NUMERIC(10,2),
    price_per_acre          NUMERIC(12,2),
    zoning_code             TEXT,
    -- Straight-line distance from subject property in miles
    distance_miles          NUMERIC(6,3),
    location                GEOMETRY(POINT, 4326),
    -- 0–100 similarity score from AI/scoring engine
    similarity_score        NUMERIC(5,2),
    -- Data source: 'mls', 'county_records', 'costar', 'manual'
    source                  TEXT,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.market_comps IS 'Comparable sales and listings used by feasibility and valuation engine.';
COMMENT ON COLUMN public.market_comps.comp_property_id IS 'FK to properties if the comp parcel is in our database; NULL otherwise.';
COMMENT ON COLUMN public.market_comps.similarity_score IS 'AI-computed similarity 0–100 relative to the reference property.';

CREATE INDEX idx_market_comps_reference_property ON public.market_comps (reference_property_id);
CREATE INDEX idx_market_comps_location           ON public.market_comps USING GIST (location);
CREATE INDEX idx_market_comps_sale_date          ON public.market_comps (sale_date DESC);

ALTER TABLE public.market_comps ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TABLE: property_notes
-- User-authored notes on any property
-- =============================================================================

CREATE TABLE public.property_notes (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID            NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    property_id UUID            NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    body        TEXT            NOT NULL,
    -- Private by default; set FALSE to share within same org (future feature)
    is_private  BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.property_notes IS 'Free-form user notes attached to a property.';
COMMENT ON COLUMN public.property_notes.is_private IS 'Private notes visible only to author; public notes may be shared with team.';

CREATE INDEX idx_property_notes_user_id     ON public.property_notes (user_id);
CREATE INDEX idx_property_notes_property_id ON public.property_notes (property_id);

CREATE TRIGGER trg_property_notes_updated_at
    BEFORE UPDATE ON public.property_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.property_notes ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TABLE: sync_logs
-- ETL / data pipeline audit trail
-- =============================================================================

CREATE TABLE public.sync_logs (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Pipeline source identifier: 'broward_pa', 'fema_firm', 'sfwmd_wetlands', etc.
    source              TEXT            NOT NULL,
    county_id           INT             REFERENCES public.counties(id) ON DELETE SET NULL,
    -- Inngest job / function run ID for cross-system correlation
    job_id              TEXT,
    started_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    -- Seconds elapsed; NULL until job completes
    duration_seconds    INT             GENERATED ALWAYS AS (
                            EXTRACT(EPOCH FROM (completed_at - started_at))::INT
                        ) STORED,
    records_fetched     INT             NOT NULL DEFAULT 0,
    records_inserted    INT             NOT NULL DEFAULT 0,
    records_updated     INT             NOT NULL DEFAULT 0,
    records_skipped     INT             NOT NULL DEFAULT 0,
    records_errored     INT             NOT NULL DEFAULT 0,
    -- Structured error details: [{row, error, data}]
    error_log           JSONB,
    status              TEXT            NOT NULL DEFAULT 'running'
                            CHECK (status IN ('running', 'success', 'partial', 'failed'))
);

COMMENT ON TABLE  public.sync_logs IS 'Audit log for all ETL pipeline runs — one row per job execution.';
COMMENT ON COLUMN public.sync_logs.job_id IS 'Inngest function run ID for cross-system tracing.';
COMMENT ON COLUMN public.sync_logs.duration_seconds IS 'Computed from completed_at - started_at; NULL while job is running.';

CREATE INDEX idx_sync_logs_source     ON public.sync_logs (source);
CREATE INDEX idx_sync_logs_started_at ON public.sync_logs (started_at DESC);
CREATE INDEX idx_sync_logs_status     ON public.sync_logs (status);

-- sync_logs is internal — RLS not required
