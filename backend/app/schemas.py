"""Pydantic schemas for the pi-cloud v1 API.

Shapes mirror cloud/db/schema.sql so the backend can talk to Supabase
without translation:
  cloud_workspaces      -> Workspace
  cloud_sessions        -> Session   (header of a pi JSONL session)
  cloud_session_entries -> raw dicts (one row per JSONL line after the header)
"""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


# ---------------------------------------------------------------- workspaces


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class Workspace(BaseModel):
    id: str
    owner_id: str
    name: str
    created_at: datetime


# ---------------------------------------------------------------- sessions


class SessionCreate(BaseModel):
    workspace_id: str
    cwd: str = "/"
    name: str | None = None
    parent_session_id: str | None = None


class Session(BaseModel):
    id: str
    workspace_id: str
    owner_id: str
    cwd: str
    parent_session_id: str | None = None
    timestamp: datetime
    name: str | None = None
    created_at: datetime
    updated_at: datetime


def new_session_id() -> str:
    return str(uuid4())


# ---------------------------------------------------------------- entries


class EntriesAppend(BaseModel):
    """Append parsed JSONL lines (everything after the session header)."""

    entries: list[dict[str, Any]] = Field(min_length=1, max_length=2000)


class EntriesAppended(BaseModel):
    session_id: str
    appended: int
    total: int


# ---------------------------------------------------------------- health


class Health(BaseModel):
    status: str = "ok"
    version: str = "0.1.0"
    store: str  # "supabase" | "memory"
    time: datetime
