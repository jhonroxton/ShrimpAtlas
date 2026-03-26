from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter()


@router.post("/auth/register")
async def register(
    email: str,
    password: str,
    db: AsyncSession = Depends(get_db),
):
    # TODO: implement user registration
    return {"message": "Registration not yet implemented"}


@router.post("/auth/login")
async def login(
    email: str,
    password: str,
    db: AsyncSession = Depends(get_db),
):
    # TODO: implement user login with JWT
    return {"message": "Login not yet implemented"}
