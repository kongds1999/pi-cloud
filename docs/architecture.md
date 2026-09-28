# pi-cloud architecture

pi-cloud turns pi-web (local-first) into a cloud web-agent platform:

- **Conversations live in Postgres** (Supabase), not in local JSONL files.
- **Agents execute in ephemeral sandboxes** with persistent volumes.
- **Multi-user** from Phase 3; publicly deployable from Phase 4.

## Today (pi-web, local-first)

```
Browser ──► Next.js server ──► AgentSession (in-process, pi SDK)
                                    │  tools run HERE (local fs, local shell)
                                    ▼
                              ~/.pi/agent/sessions/*.jsonl
```

## Target (pi-cloud)

```
Browser ──► Next.js server ──► SandboxManager ──► Sandbox (ephemeral)
   │                │                │                    │  AgentSession runs
   │                │                │                    │  INSIDE the sandbox
   │                │                │◄── volume ──────────┘  (persistent FS)
   │                │                │
   │                ▼                ▼
   │          Supabase Postgres   events stream back (SSE)
   │          sessions + entries
   │          RLS per user
   ▼
Supabase Auth (Phase 3)
```

## Phase-by-phase data flow

**Phase 1 — DB sessions.** The agent still runs next to the web server
(local dev), but every JSONL line is mirrored into
`cloud_session_entries` via `appendLines()`. Reads (`GET /api/sessions`)
go through `cloud/db/session-store.ts` when `CLOUD_DB=1`. The JSONL file
remains the agent's working copy, so fork/branch/compaction semantics are
untouched.

**Phase 2 — sandbox execution.** `POST /api/cloud/sandboxes` acquires a
sandbox for a workspace (ephemeral container + persistent volume). The
AgentSession boots *inside* the sandbox; its JSONL working copy lives on
the volume; the tail-syncer from Phase 1 now runs against the sandbox
file. Agent events are forwarded to the browser over SSE, reusing the
existing `/api/agent/[id]/events` shape. Provider keys are injected as
sandbox env, never leave the server.

**Phase 3 — multi-user.** Supabase Auth + RLS (schema already enforces
`owner_id`). Per-user provider keys in `cloud_provider_keys` (encrypted).

**Phase 4 — public deploy.** Single Docker image (Next.js standalone) +
external Supabase + sandbox provider (E2B or self-hosted pool). Compose
file for self-hosting.

## Key invariants

1. **The JSONL line is the wire format** between pi SDK and our storage.
   Unknown future entry types degrade gracefully (stored verbatim).
2. **The sandbox never talks to the DB directly** in Phases 1–2; the web
   server mediates. (Revisit only if upstream `pi-protocol` gives us an
   authenticated agent→server channel.)
3. **Volumes are the unit of persistence**, not sandboxes. Destroying a
   sandbox never deletes user data.
4. **Upstream mergeability** — see `docs/upstream-strategy.md`.
