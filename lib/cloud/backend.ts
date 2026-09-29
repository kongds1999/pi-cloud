/**
 * Typed client for the pi-cloud FastAPI backend.
 *
 * Browser calls go same-origin to `/api/cloud/*`; next.config.ts rewrites
 * those to the backend's `/api/v1/*`, so the browser never needs the
 * backend's address and there are no CORS issues.
 */

const BASE = "/api/cloud";

export class BackendError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "BackendError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch { /* keep statusText */ }
    throw new BackendError(res.status, detail);
  }
  return (await res.json()) as T;
}

export interface Health {
  status: string;
  version: string;
  store: "supabase" | "memory";
  time: string;
}

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
}

export interface CloudSession {
  id: string;
  workspace_id: string;
  owner_id: string;
  cwd: string;
  parent_session_id: string | null;
  timestamp: string;
  name: string | null;
  created_at: string;
  updated_at: string;
}

export const cloudApi = {
  health: () => request<Health>("/health"),
  listWorkspaces: () => request<Workspace[]>("/workspaces"),
  createWorkspace: (name: string) =>
    request<Workspace>("/workspaces", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  listSessions: (workspaceId?: string) =>
    request<CloudSession[]>(
      workspaceId ? `/sessions?workspace_id=${encodeURIComponent(workspaceId)}` : "/sessions",
    ),
  createSession: (workspace_id: string, cwd = "/", name?: string) =>
    request<CloudSession>("/sessions", {
      method: "POST",
      body: JSON.stringify({ workspace_id, cwd, name: name ?? null }),
    }),
};
