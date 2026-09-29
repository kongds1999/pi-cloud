# pi-cloud backend (FastAPI)

Owns data access and (later) agent orchestration. The Next.js app is a pure
frontend and calls this service — see `app/api/v1/*`.

## Run locally

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Without `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` it runs on the in-memory dev
store (data lost on restart); `GET /api/v1/health` reports which store is active.

With Supabase:

```bash
cp .env.example .env   # fill SUPABASE_URL, SUPABASE_SERVICE_KEY
# one-time: run cloud/db/schema.sql in the Supabase SQL editor,
# create a user in Dashboard > Authentication, set DEV_OWNER_ID to its UUID
uvicorn app.main:app --reload --port 8000
```

## API (v1)

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/health` | status, version, active store |
| GET/POST | `/api/v1/workspaces` | list / create workspaces |
| GET | `/api/v1/workspaces/{id}` | one workspace |
| GET/POST | `/api/v1/sessions[?workspace_id=]` | list / create sessions |
| GET | `/api/v1/sessions/{id}` | one session |
| POST | `/api/v1/sessions/{id}/entries` | append parsed JSONL lines |
| GET | `/api/v1/sessions/{id}/entries` | list appended lines in order |

Interactive docs: http://localhost:8000/docs
