"use client";

/**
 * /cloud — pi-cloud backend status page.
 *
 * Proves the frontend/backend split: everything on this page is served by
 * the FastAPI backend (via the /api/cloud rewrite), not by Next.js API routes.
 */
import { useCallback, useEffect, useState } from "react";
import { BackendError, cloudApi, type Health, type Workspace } from "@/lib/cloud/backend";

export default function CloudPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [h, ws] = await Promise.all([cloudApi.health(), cloudApi.listWorkspaces()]);
      setHealth(h);
      setWorkspaces(ws);
    } catch (e) {
      setError(e instanceof BackendError ? `${e.status}: ${e.message}` : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      setError(null);
      await cloudApi.createWorkspace(trimmed);
      setName("");
      await refresh();
    } catch (e) {
      setError(e instanceof BackendError ? `${e.status}: ${e.message}` : String(e));
    }
  }, [name, refresh]);

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "48px auto",
        padding: "0 24px",
        color: "var(--text)",
        fontFamily: "var(--font-mono)",
      }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>pi-cloud backend</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>
        Frontend (Next.js) → FastAPI backend → Supabase Postgres
      </p>

      {loading && <p style={{ color: "var(--text-dim)" }}>connecting…</p>}

      {error && (
        <div
          style={{
            background: "var(--tool-bg)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          <div style={{ marginBottom: 4 }}>backend unreachable: {error}</div>
          <div style={{ color: "var(--text-dim)", fontSize: 12 }}>
            start it with: <code>cd backend && uvicorn app.main:app --port 8000</code>
          </div>
          <button
            onClick={() => void refresh()}
            style={{
              marginTop: 8,
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--bg-panel)",
              color: "var(--text)",
              cursor: "pointer",
            }}
          >
            retry
          </button>
        </div>
      )}

      {health && (
        <section
          style={{
            background: "var(--bg-panel)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          <div>
            status: <strong>{health.status}</strong>
          </div>
          <div>version: {health.version}</div>
          <div>
            store: <strong>{health.store}</strong>
            {health.store === "memory" && (
              <span style={{ color: "var(--text-dim)" }}>
                {" "}
                (dev fallback — set SUPABASE_URL + SUPABASE_SERVICE_KEY for Postgres)
              </span>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>
          workspaces ({workspaces.length})
        </h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void create();
            }}
            placeholder="new workspace name"
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
            }}
          />
          <button
            onClick={() => void create()}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--accent)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            create
          </button>
        </div>
        {workspaces.map((w) => (
          <div
            key={w.id}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 8,
              fontSize: 13,
            }}
          >
            <div>{w.name}</div>
            <div style={{ color: "var(--text-dim)", fontSize: 11 }}>{w.id}</div>
          </div>
        ))}
      </section>
    </main>
  );
}
