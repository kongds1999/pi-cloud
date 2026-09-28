# pi-cloud auth design (Phase 3)

## Goals

- Multi-user: every session, workspace, and sandbox belongs to exactly one user.
- Replace pi-web's single shared `PI_WEB_PASSWORD` with real login.
- Provider API keys (OpenAI/Anthropic/…) become **per-user** secrets.

## Choice: Supabase Auth

- Email + OAuth (Google/GitHub) out of the box; the DB from Phase 1 already
  lives in Supabase, so auth and RLS come from the same place.
- Next.js integration via `@supabase/ssr` (cookie-based session, middleware
  refresh). No custom session tables.

## Data flow

```
Browser ── Supabase Auth ──► JWT (user id = auth.uid())
   │
   ├─► Next.js middleware: require session for / and /api/* (except /api/cloud/health)
   ├─► API routes: supabaseForUser(jwt) → RLS enforces ownership automatically
   └─► Sandbox launch: env carries only the *user's own* provider keys
```

## Provider keys per user

pi-web today stores keys in `~/.pi/agent/auth.json` (host-global). Cloud model:

- New table `cloud_provider_keys (owner_id, provider, encrypted_key)`.
- Encrypted at rest. Options, in order of preference:
  1. Supabase Vault (managed, per-project).
  2. App-level envelope encryption with a KMS-held key (self-hosted).
- Keys are decrypted **inside the sandbox only**, injected as env for the
  agent process, never returned to the browser.

## Migration path (no flag day)

1. Phase 3a: add login; single-user "owner" mode still works with the old
   `~/.pi/agent` data imported as that user's workspace.
2. Phase 3b: per-user keys UI replaces the global Models panel for
   authenticated users; `PI_WEB_PASSWORD` becomes a legacy fallback that
   maps to a built-in owner account.

## What stays out of scope

- Team/org workspaces (Phase 5+). The schema already scopes everything by
  `owner_id`, so sharing later is additive.
- SSO/SAML.
