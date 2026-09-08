# KWIZERA AI STUDIO — Admin Control Center Stage 1 Architecture

**Status:** Implementation foundation  
**Date:** 2026-09-08  
**Constraint:** No AI generation pipeline rewrite, no customer auth, no data destruction.

## Audit summary

| Layer | Finding |
|-------|---------|
| App shape | Single npm package (not monorepo): `desktop/` React+Vite, `dev/server/` Node HTTP, `ai/` engines |
| Persistence | Filesystem JSON via `KWIZERA_STORAGE_ROOT` — **no SQL** |
| HTTP auth | None today — loopback / reverse-proxy trust model |
| Existing admin-adjacent | System Health (live), Settings (placeholder), Platform Management (built, unwired) |
| Model system | `AiModelManager` — local studio model catalog + inference providers |
| Secrets | `AiSecretsManager` AES-GCM under `connector-management/` |
| Routing | Workspace IDs (no React Router); static SPA at `/` and `/desktop` |

## Design decisions

1. **New control plane module** `ai/admin-control-plane/` for commercial SaaS registries (providers, model registry, feature→model mapping, typed settings, usage contracts). This is the Admin control plane — **not** a second AiModelManager.
2. **Preserve** AiModelManager, Ollama, Memory, Knowledge, System Health, all generation engines.
3. **Admin UI** as workspace `admin` with its own shell/sidebar, plus public path `/admin` that loads the studio and opens Admin.
4. **Auth boundary** module (`assertAdminAccess`) — allow-all in Stage 1 for development, structured so real auth plugs in later without redesign. Public APIs never return secrets.
5. **Persistence** at `{storageRoot}/admin-control-plane/*.json` via safe JSON helpers — additive only.
6. **APIs** under `/api/admin/*` in a dedicated handler module, wired from `dev/server/index.ts`.

## Target flow (future)

```
Customer App → Orchestrator → Admin Control Plane → Feature Map → Model Registry → Provider Registry → Credential Manager → AI Runtime
```

## Stage 1 deliverables

- Dashboard (truthful empty/status aggregation)
- Model Registry CRUD foundation
- Provider Registry (credentials masked)
- Feature Mapping UI + store
- Typed Settings foundation
- Usage/cost data contracts (no fabricated metrics)
- Design system components + responsive Admin shell
- Tests + CI + deploy verification

## Explicit non-goals (Stage 1)

Customer registration/login, billing, replacing Ollama, new generation providers wiring into engines, destructive DB resets.
