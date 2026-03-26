from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class ShrimpSpeciesBase(BaseModel):
    cn_name: str
    en_name: str
    scientific_name: str
    family: Optional[str] = None
    genus: Optional[str] = None
    max_length_cm: Optional[float] = None
    color_description: Optional[str] = None
    habitat: Optional[str] = None
    temperature_zone: Optional[str] = None
    diet: Optional[str] = None
    is_edible: bool = False
    edible_regions: Optional[List[str]] = []
    fishing_type: Optional[str] = None
    iucn_status: Optional[str] = None
    threats: Optional[List[str]] = []
    images: Optional[List[str]] = []


class ShrimpSpeciesCreate(ShrimpSpeciesBase):
    pass


class ShrimpSpeciesResponse(ShrimpSpeciesBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class SpeciesDistributionBase(BaseModel):
    species_id: UUID
    latitude: float
    longitude: float
    location_name: str
    depth_m: Optional[float] = None
    is_verified: bool = False
    source: Optional[str] = None


class SpeciesDistributionResponse(SpeciesDistributionBase):
    id: UUID

    class Config:
        from_attributes = True


class OceanCurrentBase(BaseModel):
    name: str
    type: str  # warm, cold
    season: str  # summer, winter, year_round


class OceanCurrentResponse(OceanCurrentBase):
    id: UUID
    coordinates: Optional[List[List[float]]] = []

    class Config:
        from_attributes = True


class PaginatedResponse(BaseModel):
    data: List
    total: int
    page: int
    page_size: int
