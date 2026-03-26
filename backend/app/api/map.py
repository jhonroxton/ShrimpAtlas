from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from app.core.database import get_db
from app.models.shrimp import SpeciesDistribution, OceanCurrent

router = APIRouter()


@router.get("/map/distributions")
async def get_distributions(
    min_lat: Optional[float] = Query(None),
    max_lat: Optional[float] = Query(None),
    min_lng: Optional[float] = Query(None),
    max_lng: Optional[float] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Returns distributions as GeoJSON FeatureCollection"""
    query = select(SpeciesDistribution)
    if min_lat:
        query = query.where(SpeciesDistribution.latitude >= min_lat)
    if max_lat:
        query = query.where(SpeciesDistribution.latitude <= max_lat)
    if min_lng:
        query = query.where(SpeciesDistribution.longitude >= min_lng)
    if max_lng:
        query = query.where(SpeciesDistribution.longitude <= max_lng)

    result = await db.execute(query)
    distributions = result.scalars().all()

    features = []
    for d in distributions:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(d.longitude), float(d.latitude)],
            },
            "properties": {
                "id": str(d.id),
                "species_id": str(d.species_id),
                "location_name": d.location_name,
                "depth_m": float(d.depth_m) if d.depth_m else None,
                "is_verified": d.is_verified,
                "source": d.source,
            },
        })

    return {"type": "FeatureCollection", "features": features}


@router.get("/map/ocean-currents")
async def get_ocean_currents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OceanCurrent))
    currents = result.scalars().all()
    return currents


@router.get("/map/bounds/{ocean}")
async def get_ocean_bounds(ocean: str):
    """Returns bounding box for a given ocean"""
    bounds_map = {
        "pacific": {"min_lng": -180, "max_lng": -70, "min_lat": -60, "max_lat": 60},
        "atlantic": {"min_lng": -100, "max_lng": 20, "min_lat": -80, "max_lat": 70},
        "indian": {"min_lng": 20, "max_lng": 146, "min_lat": -60, "max_lat": 30},
        "arctic": {"min_lng": -180, "max_lng": 180, "min_lat": 66, "max_lat": 90},
        "southern": {"min_lng": -180, "max_lng": 180, "min_lat": -90, "max_lat": -60},
    }
    ocean_key = ocean.lower()
    if ocean_key not in bounds_map:
        return {"error": "Ocean not found"}
    return bounds_map[ocean_key]
