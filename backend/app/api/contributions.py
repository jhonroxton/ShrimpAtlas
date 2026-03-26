from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter()


@router.post("/contributions")
async def create_contribution(
    species_id: str,
    image_url: str,
    latitude: float,
    longitude: float,
    description: str,
    db: AsyncSession = Depends(get_db),
):
    # TODO: implement contribution submission
    return {"message": "Contribution submission not yet implemented"}


@router.get("/contributions/me")
async def get_my_contributions(
    db: AsyncSession = Depends(get_db),
):
    # TODO: implement get user's contributions
    return {"message": "Get contributions not yet implemented"}
