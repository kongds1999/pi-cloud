# pi-cloud roadmap

## Phase 0 — Foundation ✅ (this commit)

- [x] Fork base: full `agegr/pi-web` history cloned, `upstream` remote set
- [x] `cloud/` overlay skeleton (db / sandbox / auth / api)
- [x] Supabase schema (`cloud/db/schema.sql`) with RLS
- [x] `SandboxProvider` interface + `LocalDockerProvider` reference impl + E2B stub
- [x] Architecture, upstream-strategy, auth design docs

## Phase 1 — DB-backed sessions (next)

Goal: conversations persist in Supabase; JSONL stays the agent's working copy.

- [ ] `.env.example` + env validation
- [ ] Tail-syncer: watch sandbox/local JSONL files → `appendLines()` on change
      (start with the local `~/.pi/agent/sessions` layout, reuse
      `lib/session-reader.ts`'s bounded-tail logic)
- [ ] First seams: `GET /api/sessions` and `GET /api/sessions/[id]` delegate
      to `cloud/db/session-store.ts` when `CLOUD_DB=1` (register in seam registry)
- [ ] `app/api/cloud/workspaces` CRUD (persistent volume bookkeeping)
- [ ] `GET /api/cloud/health`
- [ ] Tests: round-trip a real pi JSONL session through the store
- [ ] Local verification: `CLOUD_DB=1 npm run dev` against a Supabase project

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
