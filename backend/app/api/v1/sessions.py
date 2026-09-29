from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from ...core.store import dev_owner_id, get_store
from ...schemas import EntriesAppend, EntriesAppended, Session, SessionCreate

router = APIRouter()


@router.get("/sessions", response_model=list[Session])
def list_sessions(workspace_id: str | None = Query(default=None)) -> list[Session]:
    return get_store().list_sessions(dev_owner_id(), workspace_id=workspace_id)


@router.post("/sessions", response_model=Session, status_code=201)
def create_session(data: SessionCreate) -> Session:
    store = get_store()
    if store.get_workspace(data.workspace_id) is None:
        raise HTTPException(status_code=404, detail="workspace not found")
    return store.create_session(data, dev_owner_id())


@router.get("/sessions/{session_id}", response_model=Session)
def get_session(session_id: str) -> Session:
    s = get_store().get_session(session_id)
    if s is None:
        raise HTTPException(status_code=404, detail="session not found")
    return s


@router.post("/sessions/{session_id}/entries", response_model=EntriesAppended)
def append_entries(session_id: str, data: EntriesAppend) -> EntriesAppended:
    try:
        total = get_store().append_entries(session_id, data.entries)
    except KeyError:
        raise HTTPException(status_code=404, detail="session not found") from None
    return EntriesAppended(session_id=session_id, appended=len(data.entries), total=total)


@router.get("/sessions/{session_id}/entries", response_model=list[dict[str, Any]])
def list_entries(session_id: str) -> list[dict[str, Any]]:
    try:
        return get_store().list_entries(session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="session not found") from None
