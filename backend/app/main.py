from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import species, map, currents, auth, contributions
from app.core.config import settings

app = FastAPI(
    title="ShrimpAtlas API",
    description="全球虾类分布科普平台 API",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(species.router, prefix="/api/v1", tags=["Species"])
app.include_router(map.router, prefix="/api/v1", tags=["Map"])
app.include_router(currents.router, prefix="/api/v1", tags=["Currents"])
app.include_router(auth.router, prefix="/api/v1", tags=["Auth"])
app.include_router(contributions.router, prefix="/api/v1", tags=["Contributions"])


@app.get("/")
async def root():
    return {"message": "ShrimpAtlas API", "version": "1.0.0"}


@app.get("/api/v1/health")
async def health():
    return {"status": "healthy"}
