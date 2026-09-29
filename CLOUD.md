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
| API routes inside Next.js | API in FastAPI backend (`backend/`), Next.js is a pure frontend |

**What stays:** the entire pi-web UI/UX, the pi agent kernel
(`@earendil-works/*` via npm), and mergeability with both upstreams.

## Docs

- [`ROADMAP.md`](ROADMAP.md) — phased build plan
- [`docs/architecture.md`](docs/architecture.md) — target architecture
- [`docs/upstream-strategy.md`](docs/upstream-strategy.md) — how we stay mergeable
- [`cloud/README.md`](cloud/README.md) — overlay principles & env vars

## Quick start (local dev, Phase 1)

Architecture: browser → Next.js (`npm run dev`, :30141) → FastAPI
(`backend/`, :8000) → Supabase Postgres (or in-memory dev store).

```bash
npm install

# backend (terminal 1)
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# -> GET http://localhost:8000/api/v1/health  {"status":"ok","store":"memory",...}

# frontend (terminal 2)
cp .env.example .env.local   # API_URL=http://localhost:8000
npm run dev                  # -> http://localhost:30141/cloud

# or everything at once:
docker compose up --build
```

Supabase persistence: create a project, run `cloud/db/schema.sql` in the
SQL editor, create a user in Dashboard > Authentication, then
`cp backend/.env.example backend/.env` and set `SUPABASE_URL`,
`SUPABASE_SERVICE_KEY`, `DEV_OWNER_ID=<that user's UUID>`.
`GET /health` will report `"store":"supabase"`.
