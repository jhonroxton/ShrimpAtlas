from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
from uuid import UUID
from app.core.database import get_db
from app.models.shrimp import ShrimpSpecies, SpeciesDistribution
from app.schemas.shrimp import ShrimpSpeciesResponse, SpeciesDistributionResponse, PaginatedResponse

router = APIRouter()


@router.get("/species", response_model=PaginatedResponse)
async def list_species(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    habitat: Optional[str] = None,
    temperature_zone: Optional[str] = None,
    iucn_status: Optional[str] = None,
    is_edible: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(ShrimpSpecies)
    count_query = select(ShrimpSpecies)

    if habitat:
        query = query.where(ShrimpSpecies.habitat == habitat)
        count_query = count_query.where(ShrimpSpecies.habitat == habitat)
    if temperature_zone:
        query = query.where(ShrimpSpecies.temperature_zone == temperature_zone)
        count_query = count_query.where(ShrimpSpecies.temperature_zone == temperature_zone)
    if iucn_status:
        query = query.where(ShrimpSpecies.iucn_status == iucn_status)
        count_query = count_query.where(ShrimpSpecies.iucn_status == iucn_status)
    if is_edible is not None:
        query = query.where(ShrimpSpecies.is_edible == is_edible)
        count_query = count_query.where(ShrimpSpecies.is_edible == is_edible)

    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    species_list = result.scalars().all()

    count_result = await db.execute(count_query)
    total = len(count_result.scalars().all())

    return PaginatedResponse(
        data=[ShrimpSpeciesResponse.model_validate(s) for s in species_list],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/species/{species_id}", response_model=ShrimpSpeciesResponse)
async def get_species(species_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ShrimpSpecies).where(ShrimpSpecies.id == species_id))
    species = result.scalar_one_or_none()
    if not species:
        raise HTTPException(status_code=404, detail="Species not found")
    return ShrimpSpeciesResponse.model_validate(species)


@router.get("/species/{species_id}/distributions", response_model=List[SpeciesDistributionResponse])
async def get_species_distributions(species_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SpeciesDistribution).where(SpeciesDistribution.species_id == species_id)
    )
    distributions = result.scalars().all()
    return [SpeciesDistributionResponse.model_validate(d) for d in distributions]


@router.get("/species/search", response_model=List[ShrimpSpeciesResponse])
async def search_species(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
):
    query = select(ShrimpSpecies).where(
        ShrimpSpecies.cn_name.ilike(f"%{q}%")
        | ShrimpSpecies.en_name.ilike(f"%{q}%")
        | ShrimpSpecies.scientific_name.ilike(f"%{q}%")
    ).limit(50)
    result = await db.execute(query)
    species_list = result.scalars().all()
    return [ShrimpSpeciesResponse.model_validate(s) for s in species_list]
