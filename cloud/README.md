# pi-cloud — overlay principles

This directory holds **all** pi-cloud-specific code. The golden rule:

> Upstream files (`app/`, `components/`, `hooks/`, `lib/`, `bin/`, …) are
> modified only through narrow, clearly-marked seams. Everything else lives
> here.

Why: pi-cloud tracks two upstreams — `agegr/pi-web` (via git merge) and
`@earendil-works/*` SDK packages (via npm version bumps). Keeping our code
in `cloud/` makes upstream merges mechanical instead of archaeological.

## Layout

```
cloud/
  db/
    schema.sql          # Supabase Postgres schema (sessions, entries, workspaces)
    session-store.ts    # DB-backed session store; JSONL-line-compatible
    supabase.ts         # server-side Supabase client factory
  sandbox/
    types.ts            # SandboxProvider / Sandbox / Volume interfaces
    local-docker.ts     # Reference impl: ephemeral container + persistent host dir
    e2b.ts              # Hosted provider stub (E2B)
  auth/
    DESIGN.md           # Multi-user auth plan (Supabase Auth + RLS)
  api/
    README.md           # How new /api/cloud/* routes are added without touching upstream routes
  README.md             # (this file)
```

## The seam convention

When an upstream file must change, the change is:

1. Minimal — ideally a single delegation, e.g.
   ```ts
   import { listSessions } from "@/lib/session-reader";
   // pi-cloud seam: route to DB store when CLOUD_DB=1
   import { listSessions as listCloudSessions } from "@/cloud/db/session-store";
   ```
2. Marked with `// pi-cloud seam` comments.
3. Documented in `docs/upstream-strategy.md` with the upstream file path,
   so a merge conflict can be re-applied in seconds.

## Environment

| Variable | Purpose |
|---|---|
| `CLOUD_DB=1` | Route session reads/writes through `cloud/db` instead of local JSONL |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB access |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser auth |
| `CLOUD_SANDBOX=local-docker\|e2b` | Sandbox provider selection |
| `CLOUD_VOLUME_ROOT` | Host dir backing persistent volumes (local-docker) |
