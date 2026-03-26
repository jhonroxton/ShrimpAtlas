import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DECIMAL, DateTime, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geography
from app.core.database import Base


class ShrimpSpecies(Base):
    __tablename__ = "shrimp_species"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cn_name = Column(String(100), nullable=False)
    en_name = Column(String(200), nullable=False)
    scientific_name = Column(String(200), nullable=False, unique=True)
    family = Column(String(100))
    genus = Column(String(100))
    max_length_cm = Column(DECIMAL)
    color_description = Column(Text)
    habitat = Column(String(50))  # deep_sea, coastal, freshwater, brackish
    temperature_zone = Column(String(20))  # tropical, temperate, cold
    diet = Column(String(50))
    is_edible = Column(Boolean, default=False)
    edible_regions = Column(ARRAY(Text))
    fishing_type = Column(String(20))  # wild, farmed, both
    iucn_status = Column(String(10))  # CR, EN, VU, NT, LC, DD
    threats = Column(ARRAY(Text))
    images = Column(ARRAY(Text))
    created_at = Column(DateTime, default=datetime.utcnow)


class SpeciesDistribution(Base):
    __tablename__ = "species_distribution"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    species_id = Column(UUID(as_uuid=True), ForeignKey("shrimp_species.id"), nullable=False)
    location = Column(Geography("POINT", srid=4326))
    location_name = Column(String(200))
    latitude = Column(DECIMAL)
    longitude = Column(DECIMAL)
    depth_m = Column(DECIMAL)
    is_verified = Column(Boolean, default=False)
    source = Column(String(100))


class OceanCurrent(Base):
    __tablename__ = "ocean_currents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    type = Column(String(20))  # warm, cold
    geometry = Column(Geography("LINESTRING", srid=4326))
    season = Column(String(20))  # summer, winter, year_round


class UserContribution(Base):
    __tablename__ = "user_contributions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    species_id = Column(UUID(as_uuid=True), ForeignKey("shrimp_species.id"))
    image_url = Column(String(500))
    latitude = Column(DECIMAL)
    longitude = Column(DECIMAL)
    location_name = Column(String(200))
    description = Column(Text)
    status = Column(String(20), default="pending")  # pending, approved, rejected
    created_at = Column(DateTime, default=datetime.utcnow)
