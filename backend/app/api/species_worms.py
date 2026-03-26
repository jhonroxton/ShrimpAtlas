import json
from pathlib import Path
from fastapi import APIRouter

router = APIRouter()

DATA_PATH = Path(__file__).parent.parent.parent.parent / "data" / "worms" / "species" / "_all_species.json"


@router.get("/species-worms")
async def get_species_worms():
    with open(DATA_PATH, "r") as f:
        return json.load(f)