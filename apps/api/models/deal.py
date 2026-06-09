from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, HttpUrl


class County(BaseModel):
    id: int
    fips_code: str
    name: str
    is_primary: bool = True
    pa_url: Optional[str] = None


class Municipality(BaseModel):
    id: int
    county_id: int
    name: str
    muni_type: str


class Property(BaseModel):
    id: UUID
    folio_number: str
    county_id: int
    situs_address: Optional[str] = None
    situs_city: Optional[str] = None
    situs_zip: Optional[str] = None
    gross_acreage: Optional[float] = None
    net_buildable_acreage: Optional[float] = None
    zoning_code: Optional[str] = None
    future_land_use: Optional[str] = None
    opportunity_zone: bool = False
    cra_flag: bool = False
    greenbelt_flag: bool = False
    data_source: Optional[str] = None
    last_synced_at: Optional[datetime] = None


class ParcelData(BaseModel):
    id: UUID
    property_id: UUID
    land_use_code: Optional[str] = None
    assessed_value: Optional[float] = None
    land_value: Optional[float] = None
    total_value: Optional[float] = None
    taxable_value: Optional[float] = None
    annual_taxes: Optional[float] = None
    price_per_acre: Optional[float] = None


class PriceHistoryEntry(BaseModel):
    date: date
    price: float
    event: str


class Listing(BaseModel):
    id: UUID
    property_id: UUID
    listing_source: str
    external_listing_id: Optional[str] = None
    mls_number: Optional[str] = None
    listing_url: Optional[str] = None
    listing_price: Optional[float] = None
    price_per_acre: Optional[float] = None
    price_history: list[PriceHistoryEntry] = []
    listing_status: str
    listing_date: Optional[date] = None
    expiration_date: Optional[date] = None
    days_on_market: Optional[int] = None
    listing_broker_name: Optional[str] = None
    listing_agent_name: Optional[str] = None
    listing_agent_email: Optional[str] = None


class FloodZone(BaseModel):
    id: UUID
    property_id: UUID
    fema_zone_code: Optional[str] = None
    sfha_pct: Optional[float] = None
    base_flood_elevation_ft: Optional[float] = None
    is_special_flood_hazard: bool = False


class WetlandData(BaseModel):
    id: UUID
    property_id: UUID
    has_wetlands: bool = False
    wetland_pct: Optional[float] = None
    wetland_types: list[str] = []
    sfwmd_jurisdiction: bool = False
    mitigation_cost_estimate: Optional[float] = None
    environmental_risk_score: Optional[int] = None


class UtilityAccess(BaseModel):
    id: UUID
    property_id: UUID
    water_available: bool = False
    water_at_site: bool = False
    water_connection_fee: Optional[float] = None
    sewer_available: bool = False
    sewer_at_site: bool = False
    road_frontage_type: Optional[str] = None
    road_classification: Optional[str] = None


class ZoningDetail(BaseModel):
    id: UUID
    property_id: UUID
    zoning_code: str
    zoning_description: Optional[str] = None
    max_density_units_per_acre: Optional[float] = None
    max_height_ft: Optional[float] = None
    allows_multifamily: bool = False
    rezoning_required: bool = False
    future_land_use: Optional[str] = None
    upzoning_potential: Optional[str] = None


class SoftFlag(str, Enum):
    OPPORTUNITY_ZONE = "OPPORTUNITY_ZONE"
    CRA_OVERLAY = "CRA_OVERLAY"
    TRANSIT_PROXIMITY = "TRANSIT_PROXIMITY"
    SCHOOL_RATING = "SCHOOL_RATING"
    DAYS_ON_MARKET_90 = "DAYS_ON_MARKET_90"
    PRICE_REDUCTION = "PRICE_REDUCTION"


class DealFeedItem(BaseModel):
    rank_position: int
    final_score: float
    score_label: str
    listing_id: UUID
    property_id: UUID
    address: str
    county_name: str
    listing_price: Optional[float] = None
    acreage: Optional[float] = None
    units_allowed: Optional[int] = None
    land_cost_per_unit: Optional[float] = None
    return_on_cost: Optional[float] = None
    days_on_market: Optional[int] = None
    in_morning_digest: bool = False
    soft_flags: list[str] = []


class DealFeedResponse(BaseModel):
    date: date
    total: int
    page: int
    per_page: int
    results: list[DealFeedItem]


class DealCardResponse(BaseModel):
    listing: Listing
    property: Property
    parcel: Optional[ParcelData] = None
    zoning: Optional[ZoningDetail] = None
    flood: Optional[FloodZone] = None
    wetlands: Optional[WetlandData] = None
    utility: Optional[UtilityAccess] = None
    score: Optional[float] = None
    score_detail: Optional[dict] = None
    underwriting: Optional[dict] = None
    improvement_levers: list[dict] = []
    soft_flags: list[str] = []
    watchlist_status: Optional[str] = None
