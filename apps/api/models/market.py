from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class RentData(BaseModel):
    id: UUID
    county_id: Optional[int] = None
    zip_code: Optional[str] = None
    period_year: int
    period_month: int
    asking_rent_1br: Optional[float] = None
    asking_rent_2br: Optional[float] = None
    effective_rent_1br: Optional[float] = None
    effective_rent_2br: Optional[float] = None
    vacancy_rate: Optional[float] = None
    yoy_rent_growth_pct: Optional[float] = None
    data_source: str


class DemographicData(BaseModel):
    id: UUID
    county_id: int
    acs_vintage_year: int
    population_current: Optional[int] = None
    population_3yr_prior: Optional[int] = None
    population_growth_rate: Optional[float] = None
    renter_occupied_pct: Optional[float] = None
    median_household_income: Optional[float] = None
    median_age: Optional[float] = None
    bebr_projected_population: Optional[int] = None


class EmploymentData(BaseModel):
    id: UUID
    county_id: Optional[int] = None
    msa_name: Optional[str] = None
    period_year: int
    period_month: int
    total_employment: Optional[int] = None
    yoy_employment_growth_pct: Optional[float] = None
    unemployment_rate: Optional[float] = None
    sector_employment: dict = {}


class SupplyPipeline(BaseModel):
    id: UUID
    county_id: int
    period_year: int
    period_month: int
    units_under_construction: Optional[int] = None
    units_permitted_ltm: Optional[int] = None
    existing_inventory: Optional[int] = None
    supply_pressure_ratio: Optional[float] = None
    data_source: str


class CountyMarketSnapshot(BaseModel):
    county_id: int
    county_name: str
    latest_rent: Optional[RentData] = None
    demographics: Optional[DemographicData] = None
    employment: Optional[EmploymentData] = None
    supply: Optional[SupplyPipeline] = None
