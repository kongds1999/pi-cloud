from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ...core.store import dev_owner_id, get_store
from ...schemas import Workspace, WorkspaceCreate

router = APIRouter()


@router.get("/workspaces", response_model=list[Workspace])
def list_workspaces() -> list[Workspace]:
    return get_store().list_workspaces(dev_owner_id())


@router.post("/workspaces", response_model=Workspace, status_code=201)
def create_workspace(data: WorkspaceCreate) -> Workspace:
    return get_store().create_workspace(data, dev_owner_id())


@router.get("/workspaces/{workspace_id}", response_model=Workspace)
def get_workspace(workspace_id: str) -> Workspace:
    ws = get_store().get_workspace(workspace_id)
    if ws is None:
        raise HTTPException(status_code=404, detail="workspace not found")
    return ws
