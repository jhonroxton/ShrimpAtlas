-- ShrimpAtlas Database Schema
-- PostgreSQL + PostGIS

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Shrimp Species Table
CREATE TABLE IF NOT EXISTS shrimp_species (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cn_name VARCHAR(100) NOT NULL,
    en_name VARCHAR(200) NOT NULL,
    scientific_name VARCHAR(200) NOT NULL UNIQUE,
    family VARCHAR(100),
    genus VARCHAR(100),
    max_length_cm DECIMAL,
    color_description TEXT,
    habitat VARCHAR(50),  -- deep_sea, coastal, freshwater, brackish
    temperature_zone VARCHAR(20),  -- tropical, temperate, cold
    diet VARCHAR(50),
    is_edible BOOLEAN DEFAULT FALSE,
    edible_regions TEXT[],
    fishing_type VARCHAR(20),  -- wild, farmed, both
    iucn_status VARCHAR(10),  -- CR, EN, VU, NT, LC, DD
    threats TEXT[],
    images TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Species Distribution Table
CREATE TABLE IF NOT EXISTS species_distribution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    species_id UUID NOT NULL REFERENCES shrimp_species(id) ON DELETE CASCADE,
    location GEOGRAPHY(POINT, 4326),
    location_name VARCHAR(200),
    latitude DECIMAL,
    longitude DECIMAL,
    depth_m DECIMAL,
    is_verified BOOLEAN DEFAULT FALSE,
    source VARCHAR(100)
);

-- Spatial index for location queries
CREATE INDEX IF NOT EXISTS idx_distribution_location ON species_distribution USING GIST (location);

-- Ocean Currents Table
CREATE TABLE IF NOT EXISTS ocean_currents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20),  -- warm, cold
    geometry GEOGRAPHY(LINESTRING, 4326),
    season VARCHAR(20)  -- summer, winter, year_round
);

-- Spatial index for current geometry
CREATE INDEX IF NOT EXISTS idx_currents_geometry ON ocean_currents USING GIST (geometry);

-- User Contributions Table
CREATE TABLE IF NOT EXISTS user_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    species_id UUID REFERENCES shrimp_species(id) ON DELETE SET NULL,
    image_url VARCHAR(500),
    location GEOGRAPHY(POINT, 4326),
    latitude DECIMAL,
    longitude DECIMAL,
    location_name VARCHAR(200),
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',  -- pending, approved, rejected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for user contributions
CREATE INDEX IF NOT EXISTS idx_contributions_user ON user_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_status ON user_contributions(status);
