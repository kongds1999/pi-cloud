# cloud API routes

New API surface lives under `app/api/cloud/` — never by editing upstream
`app/api/*` routes in place.

## Convention

- `app/api/cloud/<domain>/route.ts` — new cloud endpoints
  (e.g. `app/api/cloud/workspaces/route.ts`).
- When an upstream route needs a cloud behavior, add a **seam**: a small
  early-return branch guarded by `process.env.CLOUD_DB === "1"` (or
  `CLOUD_SANDBOX`), marked `// pi-cloud seam`, delegating to `cloud/`.
  Example shape (not yet wired):

  ```ts
  // pi-cloud seam: DB-backed session list
  if (process.env.CLOUD_DB === "1") {
    const { listCloudSessions } = await import("@/cloud/db/route-adapter");
    return listCloudSessions(request);
  }
  ```

- Every seam is listed in `docs/upstream-strategy.md` so upstream merges can
  re-apply them mechanically.

## Planned routes

| Route | Phase | Purpose |
|---|---|---|
| `GET /api/cloud/health` | 0 | env/config sanity (no auth) |
| `GET/POST /api/cloud/workspaces` | 1 | list / create persistent volumes |
| `GET /api/cloud/sessions` | 1 | DB-backed session list (alt. seam in `/api/sessions`) |
| `POST /api/cloud/sandboxes` | 2 | acquire ephemeral sandbox for a workspace |
| `DELETE /api/cloud/sandboxes/[id]` | 2 | destroy sandbox (volume persists) |
| `GET /api/cloud/sandboxes/[id]/events` | 2 | SSE: agent events streamed from sandbox |
