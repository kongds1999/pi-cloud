# pi-cloud

Cloud web-agent platform built on [pi-web](https://github.com/agegr/pi-web)
(Web UI for the [pi](https://github.com/earendil-works/pi) coding agent).

**What changes vs pi-web:**

| pi-web (local) | pi-cloud |
|---|---|
| Sessions in `~/.pi/agent/sessions/*.jsonl` | Sessions in Supabase Postgres |
| Agent runs in the Next.js process | Agent runs in an ephemeral cloud sandbox |
| Working dirs on the local disk | Persistent volumes, re-attached per sandbox |
| Single user (`PI_WEB_PASSWORD`) | Multi-user (Supabase Auth + RLS) |
| Bound to `127.0.0.1` | Deployable to the public internet |

**What stays:** the entire pi-web UI/UX, the pi agent kernel
(`@earendil-works/*` via npm), and mergeability with both upstreams.

## Docs

- [`ROADMAP.md`](ROADMAP.md) — phased build plan
- [`docs/architecture.md`](docs/architecture.md) — target architecture
- [`docs/upstream-strategy.md`](docs/upstream-strategy.md) — how we stay mergeable
- [`cloud/README.md`](cloud/README.md) — overlay principles & env vars

## Quick start (local dev, Phase 0/1)

```bash
npm install
# Supabase: create a project, run cloud/db/schema.sql in the SQL editor,
# then:
cp .env.example .env.local   # (to be added in Phase 1)
# edit SUPABASE_URL / keys
CLOUD_DB=1 npm run dev
```
