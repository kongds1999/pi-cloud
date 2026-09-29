"""Storage abstraction for the pi-cloud backend.

Two implementations behind one interface:

* ``SupabaseStore`` — Postgres via the Supabase client, tables from
  ``cloud/db/schema.sql``. Active when SUPABASE_URL and
  SUPABASE_SERVICE_KEY are set.
* ``MemoryStore`` — process-local dicts. Zero-config dev fallback so the
  frontend/backend split is verifiable without a Supabase project.

The active store is chosen once at startup (see ``build_store``) and is
reported by ``GET /health``. Swapping in real per-user auth later only
changes how ``owner_id`` is derived, not this interface.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Protocol

from ..schemas import Session, SessionCreate, Workspace, WorkspaceCreate, new_session_id
from .config import settings

log = logging.getLogger("pi-cloud.store")


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Store(Protocol):
    def create_workspace(self, data: WorkspaceCreate, owner_id: str) -> Workspace: ...
    def list_workspaces(self, owner_id: str) -> list[Workspace]: ...
    def get_workspace(self, workspace_id: str) -> Workspace | None: ...
    def create_session(self, data: SessionCreate, owner_id: str) -> Session: ...
    def list_sessions(self, owner_id: str, workspace_id: str | None = None) -> list[Session]: ...
    def get_session(self, session_id: str) -> Session | None: ...
    def append_entries(self, session_id: str, entries: list[dict[str, Any]]) -> int: ...
    def list_entries(self, session_id: str) -> list[dict[str, Any]]: ...


# ------------------------------------------------------------ in-memory


class MemoryStore:
    """Process-local store. Data is lost on restart — dev only."""

    def __init__(self) -> None:
        self._workspaces: dict[str, Workspace] = {}
        self._sessions: dict[str, Session] = {}
        self._entries: dict[str, list[dict[str, Any]]] = {}

    def create_workspace(self, data: WorkspaceCreate, owner_id: str) -> Workspace:
        import uuid

        ws = Workspace(
            id=str(uuid.uuid4()),
            owner_id=owner_id,
            name=data.name,
            created_at=_now(),
        )
        self._workspaces[ws.id] = ws
        return ws

    def list_workspaces(self, owner_id: str) -> list[Workspace]:
        return sorted(
            (w for w in self._workspaces.values() if w.owner_id == owner_id),
            key=lambda w: w.created_at,
        )

    def get_workspace(self, workspace_id: str) -> Workspace | None:
        return self._workspaces.get(workspace_id)

    def create_session(self, data: SessionCreate, owner_id: str) -> Session:
        now = _now()
        s = Session(
            id=new_session_id(),
            workspace_id=data.workspace_id,
            owner_id=owner_id,
            cwd=data.cwd,
            parent_session_id=data.parent_session_id,
            timestamp=now,
            name=data.name,
            created_at=now,
            updated_at=now,
        )
        self._sessions[s.id] = s
        self._entries[s.id] = []
        return s

    def list_sessions(self, owner_id: str, workspace_id: str | None = None) -> list[Session]:
        out = [s for s in self._sessions.values() if s.owner_id == owner_id]
        if workspace_id:
            out = [s for s in out if s.workspace_id == workspace_id]
        return sorted(out, key=lambda s: s.updated_at, reverse=True)

    def get_session(self, session_id: str) -> Session | None:
        return self._sessions.get(session_id)

    def append_entries(self, session_id: str, entries: list[dict[str, Any]]) -> int:
        buf = self._entries.get(session_id)
        if buf is None:
            raise KeyError(session_id)
        buf.extend(entries)
        s = self._sessions[session_id]
        self._sessions[session_id] = s.model_copy(update={"updated_at": _now()})
        return len(buf)

    def list_entries(self, session_id: str) -> list[dict[str, Any]]:
        if session_id not in self._entries:
            raise KeyError(session_id)
        return list(self._entries[session_id])


# -------------------------------------------------------------- supabase


class SupabaseStore:
    """Postgres store. Requires the schema in cloud/db/schema.sql."""

    def __init__(self, url: str, service_key: str) -> None:
        from supabase import create_client  # lazy: only needed in this mode

        self._client = create_client(url, service_key)

    # -- boot ---------------------------------------------------

    def ensure_dev_profile(self, owner_id: str) -> None:
        """Upsert the dev owner row so FK constraints pass before auth lands."""
        self._client.table("cloud_profiles").upsert({"id": owner_id}).execute()

    # -- helpers -------------------------------------------------

    @staticmethod
    def _ws(row: dict[str, Any]) -> Workspace:
        return Workspace(**row)

    @staticmethod
    def _session(row: dict[str, Any]) -> Session:
        return Session(**row)

    # -- workspaces ----------------------------------------------

    def create_workspace(self, data: WorkspaceCreate, owner_id: str) -> Workspace:
        res = (
            self._client.table("cloud_workspaces")
            .insert({"owner_id": owner_id, "name": data.name})
            .execute()
        )
        return self._ws(res.data[0])

    def list_workspaces(self, owner_id: str) -> list[Workspace]:
        res = (
            self._client.table("cloud_workspaces")
            .select("*")
            .eq("owner_id", owner_id)
            .order("created_at")
            .execute()
        )
        return [self._ws(r) for r in res.data]

    def get_workspace(self, workspace_id: str) -> Workspace | None:
        res = (
            self._client.table("cloud_workspaces")
            .select("*")
            .eq("id", workspace_id)
            .limit(1)
            .execute()
        )
        return self._ws(res.data[0]) if res.data else None

    # -- sessions -------------------------------------------------

    def create_session(self, data: SessionCreate, owner_id: str) -> Session:
        now = _now().isoformat()
        res = (
            self._client.table("cloud_sessions")
            .insert(
                {
                    "id": new_session_id(),
                    "workspace_id": data.workspace_id,
                    "owner_id": owner_id,
                    "cwd": data.cwd,
                    "parent_session_id": data.parent_session_id,
                    "timestamp": now,
                    "name": data.name,
                }
            )
            .execute()
        )
        return self._session(res.data[0])

    def list_sessions(self, owner_id: str, workspace_id: str | None = None) -> list[Session]:
        q = (
            self._client.table("cloud_sessions")
            .select("*")
            .eq("owner_id", owner_id)
            .order("updated_at", desc=True)
        )
        if workspace_id:
            q = q.eq("workspace_id", workspace_id)
        return [self._session(r) for r in q.execute().data]

    def get_session(self, session_id: str) -> Session | None:
        res = (
            self._client.table("cloud_sessions")
            .select("*")
            .eq("id", session_id)
            .limit(1)
            .execute()
        )
        return self._session(res.data[0]) if res.data else None

    # -- entries ---------------------------------------------------

    def append_entries(self, session_id: str, entries: list[dict[str, Any]]) -> int:
        if self.get_session(session_id) is None:
            raise KeyError(session_id)
        cur = (
            self._client.table("cloud_session_entries")
            .select("seq")
            .eq("session_id", session_id)
            .order("seq", desc=True)
            .limit(1)
            .execute()
        )
        seq = cur.data[0]["seq"] if cur.data else -1
        rows = [
            {
                "session_id": session_id,
                "seq": seq + 1 + i,
                "entry_id": e.get("id"),
                "type": e.get("type", "unknown"),
                "parent_id": e.get("parentId"),
                "timestamp": e.get("timestamp"),
                "data": e,
            }
            for i, e in enumerate(entries)
        ]
        self._client.table("cloud_session_entries").insert(rows).execute()
        self._client.table("cloud_sessions").update({"updated_at": _now().isoformat()}).eq(
            "id", session_id
        ).execute()
        return seq + 1 + len(rows)

    def list_entries(self, session_id: str) -> list[dict[str, Any]]:
        if self.get_session(session_id) is None:
            raise KeyError(session_id)
        res = (
            self._client.table("cloud_session_entries")
            .select("data")
            .eq("session_id", session_id)
            .order("seq")
            .execute()
        )
        return [r["data"] for r in res.data]


# ------------------------------------------------------- wiring


_active: Store | None = None
_store_kind: str = "memory"


def build_store() -> Store:
    """Choose the store once at startup."""
    global _store_kind
    if settings.use_supabase:
        assert settings.supabase_url and settings.supabase_service_key
        store = SupabaseStore(settings.supabase_url, settings.supabase_service_key)
        store.ensure_dev_profile(settings.dev_owner_id)
        _store_kind = "supabase"
        log.warning("store=supabase owner=%s", settings.dev_owner_id)
    else:
        store = MemoryStore()
        _store_kind = "memory"
        log.warning(
            "store=memory (dev fallback): set SUPABASE_URL and "
            "SUPABASE_SERVICE_KEY for Postgres persistence"
        )
    return store


def set_store(store: Store) -> None:
    global _active
    _active = store


def get_store() -> Store:
    assert _active is not None, "store not initialized"
    return _active


def store_kind() -> str:
    return _store_kind


def dev_owner_id() -> str:
    return settings.dev_owner_id
