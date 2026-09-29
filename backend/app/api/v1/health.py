from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from ...core.store import store_kind
from ...schemas import Health

router = APIRouter()


@router.get("/health", response_model=Health)
def health() -> Health:
    return Health(store=store_kind(), time=datetime.now(timezone.utc))
