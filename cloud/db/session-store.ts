/**
 * DB-backed session store for pi-cloud (Phase 1).
 *
 * Design: the store speaks pi's JSONL line protocol. Each row in
 * cloud_session_entries holds one parsed JSONL line verbatim in `data`,
 * so the read path reconstructs exactly what `lib/session-reader.ts`
 * would have parsed from disk — including unknown future entry types.
 *
 * Write path (Phase 1): the agent still runs with a JSONL file as its
 * working copy (inside the sandbox); a syncer tails the file and calls
 * appendLines(). Phase 2 may switch the SDK to write-through.
 *
 * This module never touches upstream files; API routes opt in via the
 * CLOUD_DB=1 seam (see cloud/README.md).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionEntry, SessionHeader } from "../../lib/types";

export interface CloudSessionRecord {
  id: string;
  workspaceId: string;
  ownerId: string;
  cwd: string;
  parentSessionId: string | null;
  timestamp: string;
  name: string | null;
  updatedAt: string;
}

export interface SessionData {
  header: SessionHeader;
  entries: SessionEntry[];
}

function toRecord(row: Record<string, unknown>): CloudSessionRecord {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    ownerId: row.owner_id as string,
    cwd: row.cwd as string,
    parentSessionId: (row.parent_session_id as string | null) ?? null,
    timestamp: row.timestamp as string,
    name: (row.name as string | null) ?? null,
    updatedAt: row.updated_at as string,
  };
}

/** Parse one JSONL line the same lenient way lib/session-reader.ts does. */
function parseLine(line: string): Record<string, unknown> | null {
  try {
    return JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null; // torn trailing write — skipped, like the file reader
  }
}

export async function listSessions(
  db: SupabaseClient,
  ownerId: string,
  limit = 200,
): Promise<CloudSessionRecord[]> {
  const { data, error } = await db
    .from("cloud_sessions")
    .select("*")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`pi-cloud: listSessions failed: ${error.message}`);
  return (data as Record<string, unknown>[]).map(toRecord);
}

export async function getSession(
  db: SupabaseClient,
  sessionId: string,
  ownerId: string,
): Promise<SessionData | null> {
  const { data: sessionRow, error: sessionError } = await db
    .from("cloud_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("owner_id", ownerId)
    .single();
  if (sessionError || !sessionRow) return null;
  const record = toRecord(sessionRow as Record<string, unknown>);

  const { data: entryRows, error: entriesError } = await db
    .from("cloud_session_entries")
    .select("data")
    .eq("session_id", sessionId)
    .order("seq", { ascending: true });
  if (entriesError) throw new Error(`pi-cloud: getSession entries failed: ${entriesError.message}`);

  const header: SessionHeader = {
    type: "session",
    id: record.id,
    timestamp: record.timestamp,
    cwd: record.cwd,
    ...(record.parentSessionId ? { parentSession: record.parentSessionId } : {}),
  };
  const entries = (entryRows as { data: unknown }[]).map((r) => r.data as SessionEntry);
  return { header, entries };
}

/**
 * Create the session row. Call once when the agent session is born
 * (mirrors the JSONL header write).
 */
export async function createSession(
  db: SupabaseClient,
  input: {
    id: string;
    workspaceId: string;
    ownerId: string;
    cwd: string;
    parentSessionId?: string | null;
    timestamp: string;
    name?: string | null;
  },
): Promise<void> {
  const { error } = await db.from("cloud_sessions").insert({
    id: input.id,
    workspace_id: input.workspaceId,
    owner_id: input.ownerId,
    cwd: input.cwd,
    parent_session_id: input.parentSessionId ?? null,
    timestamp: input.timestamp,
    name: input.name ?? null,
  });
  if (error) throw new Error(`pi-cloud: createSession failed: ${error.message}`);
}

/**
 * Append raw JSONL lines. Idempotent-ish: callers pass lines in order;
 * `seq` continues from the current max. Torn trailing lines are skipped.
 */
export async function appendLines(
  db: SupabaseClient,
  sessionId: string,
  lines: string[],
): Promise<number> {
  const parsed = lines.map(parseLine).filter((e): e is Record<string, unknown> => e !== null);
  if (parsed.length === 0) return 0;

  const { data: maxRow } = await db
    .from("cloud_session_entries")
    .select("seq")
    .eq("session_id", sessionId)
    .order("seq", { ascending: false })
    .limit(1)
    .single();
  let seq = ((maxRow as { seq: number } | null)?.seq ?? -1) + 1;

  const rows = parsed.map((entry) => ({
    session_id: sessionId,
    seq: seq++,
    entry_id: typeof entry.id === "string" ? entry.id : null,
    type: typeof entry.type === "string" ? entry.type : "unknown",
    parent_id: typeof entry.parentId === "string" ? entry.parentId : null,
    timestamp: typeof entry.timestamp === "string" ? entry.timestamp : null,
    data: entry,
  }));

  const { error } = await db.from("cloud_session_entries").insert(rows);
  if (error) throw new Error(`pi-cloud: appendLines failed: ${error.message}`);
  return rows.length;
}

/** Latest entry id, mirroring readLatestSessionEntryId() without disk access. */
export async function readLatestEntryId(
  db: SupabaseClient,
  sessionId: string,
): Promise<string | undefined> {
  const { data } = await db
    .from("cloud_session_entries")
    .select("entry_id")
    .eq("session_id", sessionId)
    .not("entry_id", "is", null)
    .order("seq", { ascending: false })
    .limit(1)
    .single();
  return (data as { entry_id: string } | null)?.entry_id;
}

export async function renameSession(
  db: SupabaseClient,
  sessionId: string,
  ownerId: string,
  name: string,
): Promise<void> {
  const { error } = await db
    .from("cloud_sessions")
    .update({ name })
    .eq("id", sessionId)
    .eq("owner_id", ownerId);
  if (error) throw new Error(`pi-cloud: renameSession failed: ${error.message}`);
}

export async function deleteSession(
  db: SupabaseClient,
  sessionId: string,
  ownerId: string,
): Promise<void> {
  // entries cascade via FK
  const { error } = await db
    .from("cloud_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("owner_id", ownerId);
  if (error) throw new Error(`pi-cloud: deleteSession failed: ${error.message}`);
}
