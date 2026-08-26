# PHASE 7 — STEP 3 REPORT
## Online Knowledge Acquisition + Offline Knowledge Engine

**Date:** 2026-08-25  
**Verdict:** Online/offline knowledge acquisition is integrated on the **existing** Step 2 Knowledge Base (`PersistentMemoryCenter` + storage engines). No second Knowledge Base. No model training. Application remains usable offline.

---

### 1. Existing architecture inspected

| Area | Reuse |
|------|--------|
| Step 2 PMC | `saveKnowledge` / `searchKnowledge` / backup |
| Research stack | `ConnectivityDetector`, professional domains, trusted source library |
| Download safety patterns | Allowlist hosts, size limits, strip HTML as DATA |
| Electron probe pattern | MSFT connecttest + DNS fallback |
| Knowledge Center UI | Extended (not replaced) |

### 2–3. Online/offline engine & network detection

`OnlineKnowledgeEngine` (`dev/server/online-knowledge-engine.ts`)

States: `ONLINE` | `OFFLINE` | `CONNECTING` | `LIMITED` | `ERROR`  
Modes: `ONLINE_KNOWLEDGE` | `OFFLINE_KNOWLEDGE`  
Startup does **not** block on network (async probe).

### 4–8. Research → store pipeline

```
QUERY → scope check → LOCAL SEARCH
  → if ONLINE: allowlisted trusted sources → FETCH text → STRIP/EXTRACT
  → VALIDATE (relevance, injection flags, host policy)
  → DEDUPE/CONFLICT check vs existing KB
  → SAVE via PersistentMemoryCenter
  → INDEX (existing engine)
  → AVAILABLE OFFLINE
```

Sources limited to `TRUSTED_SOURCE_LIBRARY` hosts (official docs preference).  
Not unrestricted web browsing.

### 9–16. Validation, trust, extraction, dedupe, versioning, freshness

- New online items: `Unverified` or `Pending` (never auto-trusted blindly)
- Extraction: summary + key facts + practical use (no full page dump)
- Content hash in payload; PMC dedupe/update path reused
- Conflicts → `KNOWLEDGE_CONFLICT` note + pending status (no silent overwrite)
- Freshness tag `CURRENT` on acquire; refresh queue foundation for later automation

### 17–19. Security

- HTTP(S) GET text only; size cap 512KB; timeout
- Private IPs / blocked host fragments rejected
- Scripts/styles stripped; content never executed
- Prompt-injection patterns flagged; treated as DATA
- Rate limit: 12 requests/minute
- No model retraining

### 20–22. APIs

| Endpoint | Purpose |
|----------|---------|
| `GET /api/online-knowledge/status` | Local + internet + phase |
| `GET /api/online-knowledge/network` | Refresh probe |
| `POST /api/online-knowledge/research` | Manual research |
| `POST /api/online-knowledge/retrieve-local` | Offline retrieval |
| `GET /api/online-knowledge/history` | Research history |
| `GET/POST /api/online-knowledge/refresh-queue` | Refresh foundation |

Booted from `dev/server/index.ts` alongside PMC (non-blocking).

### 23–24. UI

Knowledge Center tabs: Status · Memory · Knowledge · **Online Research** · Backup  
Live indicator: Internet ONLINE/OFFLINE + research phase  
Manual research + “Use local only”

### 25. Backup

Online-acquired knowledge lands in the same knowledge tree backed up by Step 2 PMC backups.

### 26. Tests performed

| Test | Result |
|------|--------|
| `tests/online-knowledge-engine.test.ts` | **9/9 PASS** |
| Boot offline-capable / no model training flag | PASS |
| Network refresh (ONLINE or OFFLINE both accepted) | PASS |
| Research without crash (online or offline path) | PASS |
| Empty query rejected | PASS |
| Local retrieve without network | PASS |
| Dedupe via PMC | PASS |
| Research history | PASS |
| Injection-pattern query does not crash | PASS |
| Restart simulation (new engine + local retrieve) | PASS |
| Step 2 suite still green (when run alone / after PMC reboot fix) | PASS |
| Full Windows OS reboot | **NOT RUN** in this environment |
| End-to-end live multi-source product-ad research with disconnect cycle | Partially covered by research test (depends on live network); user should confirm once on machine |

### 27–28. Passed / failed

- Passed: 9/9 Step 3 unit/integration tests  
- Failed: none in final run  
- Fixed during implementation: PMC/Online engine singleton reboot when `KWIZERA_STORAGE_ROOT` changes between test suites; `KnowledgeVerificationStatus.Reviewed` → `Verified` for starter knowledge

### 29. Files created

- `dev/server/online-knowledge-engine.ts`
- `tests/online-knowledge-engine.test.ts`
- `desktop/persistent-memory/PHASE-7-STEP-3-REPORT.md` (this file)

### 30. Files modified

- `dev/server/index.ts` — boot + API routes
- `dev/server/persistent-memory-center.ts` — reboot-on-new-root; starter verification enum
- `desktop/persistent-memory/api-client.ts` — `onlineKnowledgeApi`
- `desktop/persistent-memory/PersistentMemoryWorkspace.tsx` — research UI + status
- `desktop/persistent-memory/persistent-memory.css`

### 31. Commands

```text
npx vitest run tests/online-knowledge-engine.test.ts
```

### 32. Remaining limitations

1. Research fetches **allowlisted trusted documentation URLs** matched to the query — not a general search engine crawler.
2. Automatic background refresh is queue-only (for Automation Center later).
3. Multi-source agreement scoring is lightweight.
4. OS reboot persistence relies on Step 2 disk layout (verified via process restart simulation, not Windows reboot).
5. Some official doc sites may block or return non-extractable shells; those sources are ignored without crashing.

### Honest claims

- The system **acquires selected information**, validates/classifies it, stores structured knowledge in the **existing** Knowledge Base, and retrieves it offline.
- It does **not** “learn everything from the internet” and does **not** retrain models.

**Phase 7 Step 4 not started.**
