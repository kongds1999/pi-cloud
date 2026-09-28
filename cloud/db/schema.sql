-- pi-cloud Supabase schema
-- Sessions mirror pi's JSONL line protocol: the header becomes a row in
-- cloud_sessions, every subsequent JSONL line becomes a row in
-- cloud_session_entries with the exact parsed JSON in `data`.
-- This keeps 100% compatibility with pi SDK semantics (fork, in-session
-- branch, compaction all keep operating on the line stream).

-- Profiles: one per Supabase Auth user.
create table if not exists cloud_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Workspaces: the persistent-filesystem unit. A sandbox container is
-- ephemeral; it mounts one workspace volume at boot and the volume
-- survives the container.
create table if not exists cloud_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references cloud_profiles (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index if not exists cloud_workspaces_owner_idx
  on cloud_workspaces (owner_id);

-- Sessions: mirrors the JSONL session header.
create table if not exists cloud_sessions (
  id text primary key, -- pi session id (uuid string)
  workspace_id uuid not null references cloud_workspaces (id) on delete cascade,
  owner_id uuid not null references cloud_profiles (id) on delete cascade,
  cwd text not null,   -- working directory *inside* the sandbox
  parent_session_id text references cloud_sessions (id) on delete set null,
  timestamp timestamptz not null,
  name text,           -- auto-generated title, nullable until named
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cloud_sessions_owner_updated_idx
  on cloud_sessions (owner_id, updated_at desc);
create index if not exists cloud_sessions_workspace_idx
  on cloud_sessions (workspace_id);

-- Entries: one row per JSONL line after the header. `data` holds the exact
-- parsed line so any future pi format change degrades to "unknown type"
-- instead of data loss.
create table if not exists cloud_session_entries (
  session_id text not null references cloud_sessions (id) on delete cascade,
  seq bigint not null,      -- append order within the session
  entry_id text,            -- entry.id when the line carries one
  type text not null,       -- entry.type
  parent_id text,           -- entry.parentId (branch navigation)
  timestamp timestamptz,    -- entry.timestamp when present
  data jsonb not null,      -- exact parsed JSONL line
  primary key (session_id, seq)
);
create index if not exists cloud_session_entries_lookup_idx
  on cloud_session_entries (session_id, entry_id);
create index if not exists cloud_session_entries_type_idx
  on cloud_session_entries (session_id, type);

-- updated_at maintenance
create or replace function cloud_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists cloud_sessions_touch on cloud_sessions;
create trigger cloud_sessions_touch
  before update on cloud_sessions
  for each row execute function cloud_touch_updated_at();

-- Row-level security: users only ever see their own rows.
alter table cloud_profiles   enable row level security;
alter table cloud_workspaces enable row level security;
alter table cloud_sessions   enable row level security;
alter table cloud_session_entries enable row level security;

create policy "own profile" on cloud_profiles
  for all using (auth.uid() = id);

create policy "own workspaces" on cloud_workspaces
  for all using (auth.uid() = owner_id);

create policy "own sessions" on cloud_sessions
  for all using (auth.uid() = owner_id);

create policy "own session entries" on cloud_session_entries
  for all using (
    exists (
      select 1 from cloud_sessions s
      where s.id = cloud_session_entries.session_id
        and s.owner_id = auth.uid()
    )
  );
