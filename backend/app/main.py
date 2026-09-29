"""pi-cloud backend — FastAPI service.

Owns all data access (Supabase Postgres, with an in-memory dev fallback)
and, in later phases, agent orchestration and sandbox management.
The Next.js app is a pure frontend and talks to this service.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.v1 import health, sessions, workspaces
from .core.config import settings
from .core.store import build_store, set_store

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("pi-cloud")


@asynccontextmanager
async def lifespan(app: FastAPI):
    set_store(build_store())
    log.warning("pi-cloud backend ready")
    yield


app = FastAPI(title="pi-cloud backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(workspaces.router, prefix="/api/v1", tags=["workspaces"])
app.include_router(sessions.router, prefix="/api/v1", tags=["sessions"])
