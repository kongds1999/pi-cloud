# pi-cloud roadmap

## Phase 0 — Foundation ✅ (this commit)

- [x] Fork base: full `agegr/pi-web` history cloned, `upstream` remote set
- [x] `cloud/` overlay skeleton (db / sandbox / auth / api)
- [x] Supabase schema (`cloud/db/schema.sql`) with RLS
- [x] `SandboxProvider` interface + `LocalDockerProvider` reference impl + E2B stub
- [x] Architecture, upstream-strategy, auth design docs

## Phase 1 — Frontend/backend split 🚧 (in progress, branch `phase-1`)

Goal: conventional separation — Next.js is a pure frontend, FastAPI owns
data access and (later) orchestration. The browser never touches Supabase.

- [x] `backend/` FastAPI service: `GET /health`, `/api/v1/workspaces`,
      `/api/v1/sessions`, `POST /api/v1/sessions/{id}/entries`
- [x] Storage abstraction: Supabase Postgres when `SUPABASE_URL` +
      `SUPABASE_SERVICE_KEY` are set, in-memory dev fallback otherwise
      (`GET /health` reports which)
- [x] Next.js rewrite `/api/cloud/:path*` → backend `/api/v1/:path*`
      (same-origin, no CORS); typed client `lib/cloud/backend.ts`
- [x] `/cloud` status page: backend health + workspace list/create
- [x] `docker-compose.yml` — one-command local run (web + backend)
- [ ] Local verification: backend + frontend round-trip (see CLOUD.md)
- [ ] Migrate the first real seam: session list/read via backend instead
      of local JSONL (tail-syncer: watch JSONL → `POST .../entries`)

Later (was Phase 1, now Phase 2+): `CLOUD_DB=1` seams inside Next.js API
routes are superseded by the split — all DB access moves to FastAPI.

## Phase 2 — Sandbox execution

Goal: the agent runs in an ephemeral sandbox; files persist on volumes.

- [ ] Evaluate upstream `@earendil-works/pi-protocol` as the event transport;
      build our own SSE forwarder only if it falls short
- [ ] `SandboxManager`: acquire on session start, idle-timeout destroy,
      orphan reaping on boot (`CLOUD_SANDBOX=local-docker` first)
- [ ] Agent bootstrap inside sandbox: pre-baked image with node + pi SDK,
      session working copy on the volume, tail-syncer → DB
- [ ] Provider keys injected as sandbox env (per-user from Phase 3; global env before)
- [ ] `POST/DELETE /api/cloud/sandboxes`, `GET /api/cloud/sandboxes/[id]/events`
- [ ] E2B provider implementation (behind `CLOUD_SANDBOX=e2b`)

## Phase 3 — Multi-user

Goal: real login, per-user isolation.

- [ ] Supabase Auth wiring (`@supabase/ssr`), middleware route guard
- [ ] `cloud_provider_keys` table + encryption (Supabase Vault first choice)
- [ ] Per-user Models panel; `PI_WEB_PASSWORD` → legacy owner fallback
- [ ] Import path: adopt an existing `~/.pi/agent` dir as the owner's workspace

## Phase 4 — Public deployment

Goal: one-command deploy.

- [ ] Next.js standalone Docker image
- [ ] `compose.yaml` (web + local-docker volume root) for self-hosting
- [ ] Deploy docs (reverse proxy, HTTPS, `PI_WEB_*` → cloud env mapping)

## Ongoing

- Upstream sync: `git fetch upstream && git merge upstream/main` on a
  cadence; `@earendil-works/*` bumps as separate commits.
- Re-evaluate: `AgentHarness` SQLite/Postgres backends (replace our
  mirror-syncer), `pi-protocol` (replace our event forwarder).
