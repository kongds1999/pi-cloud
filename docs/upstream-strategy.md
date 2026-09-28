# Upstream strategy

pi-cloud tracks **two** upstreams and must stay mergeable with both.

| Upstream | What it is | How we track it |
|---|---|---|
| `agegr/pi-web` | The web UI + Next.js server we forked | `git merge upstream/main` |
| `@earendil-works/*` npm packages | The pi agent kernel (agent-core, pi-ai, coding-agent, …) | `npm install @earendil-works/<pkg>@<version>` |

## Git setup (already done in this checkout)

```
upstream  https://github.com/agegr/pi-web.git (fetch+push disabled for push)
origin    <to be set>  →  github.com/<you>/pi-cloud
```

Merge flow:

```bash
git fetch upstream
git merge upstream/main   # resolve; our changes live in cloud/ + seams
```

## Rules

1. **All pi-cloud code lives in `cloud/`**, plus repo-level docs
   (`CLOUD.md`, `ROADMAP.md`, `docs/`). Nothing else new at top level.
2. **Upstream files get seams, not rewrites.** A seam is a minimal,
   env-guarded delegation marked `// pi-cloud seam`. Seams are registered
   below; a merge conflict on a seam is re-applied by copying the 3–10
   lines back.
3. **`package.json` deps are additive.** We only *add* dependencies
   (`@supabase/supabase-js`, later `@e2b/code-interpreter`, `@supabase/ssr`).
   Never change versions of upstream deps in the same commit as a feature —
   keep dep bumps (incl. `@earendil-works/*`) as their own commits so they
   can be bisected and so upstream merges stay clean.
4. **No edits to `AGENTS.md`'s upstream sections** except the generated
   Next.js block (which upstream itself says to leave alone).
5. Before each upstream merge: `git status` clean, run `npm test`,
   `tsc --noEmit`, `npm run lint`.

## Watch list (upstream work that changes our plan)

- `@earendil-works/pi-agent-core` `AgentHarness` session backends
  (memory/JSONL/SQLite): when the harness becomes the default runtime,
  Phase 1's mirror-syncer can be replaced by a native Postgres backend
  implementing the same backend interface. Our `data jsonb` row-per-line
  schema maps 1:1 onto a line-oriented backend.
- `@earendil-works/pi-protocol` (CBOR remote sessions, experimental):
  evaluate as the sandbox transport in Phase 2 before building our own
  event-forwarding protocol.
- `agegr/pi-web` releases: pi-web pins one SDK version per release, so a
  pi-web merge *is* the kernel upgrade path for the UI layer.

## Seam registry

| # | Upstream file | Seam | Status |
|---|---|---|---|
| — | *(none yet)* | Phase 1 will add the first seams in `app/api/sessions/*` | planned |

(Append-only. One row per seam, with the env guard name.)
