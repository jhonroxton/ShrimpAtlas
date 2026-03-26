from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from app.core.database import get_db
from app.models.shrimp import OceanCurrent
from app.schemas.shrimp import OceanCurrentResponse

router = APIRouter()


@router.get("/currents", response_model=list[OceanCurrentResponse])
async def list_currents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OceanCurrent))
    currents = result.scalars().all()
    return [OceanCurrentResponse.model_validate(c) for c in currents]


@router.get("/currents/{current_id}", response_model=OceanCurrentResponse)
async def get_current(current_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OceanCurrent).where(OceanCurrent.id == current_id))
    current = result.scalar_one_or_none()
    if not current:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Current not found")
    return OceanCurrentResponse.model_validate(current)
