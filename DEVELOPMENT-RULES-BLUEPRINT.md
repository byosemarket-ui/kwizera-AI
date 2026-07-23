# KWIZERA AI STUDIO — Development Rules, Engineering Policy & Project Governance

**Document status:** Permanent foundation · Step 1K  
**Effective date:** 2026-06-28  
**Scope:** Mandatory engineering rules, development standards, project governance, and implementation policies for every future phase — not application code, APIs, database schemas, or UI components.

**Companion documents:** See [BLUEPRINT-INDEX.md](./BLUEPRINT-INDEX.md)

| Official identity | Value |
|-------------------|-------|
| **Project name** | **KWIZERA AI STUDIO** |
| **Official logo** | **`KWIZERA AI.png`** (project root) |
| **Official AI assistant** | **KWIZERA AI** |

**Related standards:** [QUALITY-STANDARDS-BLUEPRINT.md](./QUALITY-STANDARDS-BLUEPRINT.md) · [SYSTEM-ARCHITECTURE-BLUEPRINT.md](./SYSTEM-ARCHITECTURE-BLUEPRINT.md) · [DEVELOPMENT-RULES-BLUEPRINT.md](./DEVELOPMENT-RULES-BLUEPRINT.md) *(this document)*

---

## 1. Blueprint Purpose

This document defines the **permanent development rules**, **engineering policy**, and **project governance** that **every future development phase** of **KWIZERA AI STUDIO** must follow.

These rules are **mandatory** for the entire project. No implementation work may bypass them.

### 1.1 Authority hierarchy

| Priority | Source | Governs |
|----------|--------|---------|
| 1 | Phase 1 Blueprints (1A–1K) | What to build and how to behave |
| 2 | This document (1K) | How to implement and validate |
| 3 | [QUALITY-STANDARDS-BLUEPRINT.md](./QUALITY-STANDARDS-BLUEPRINT.md) (1J) | Quality and testing bars |
| 4 | Phase-specific technical addenda | Implementation detail — must not contradict 1–3 |

**Rule:** If implementation conflicts with the Blueprint, **revise implementation or amend the Blueprint explicitly** — never ship silent contradictions.

### 1.2 Clean project mandate

| Rule | Requirement |
|------|-------------|
| **New project** | Do not reuse BYOSE AI Studio or legacy code, architecture, or branding |
| **Blueprint first** | No feature without [FEATURE-BLUEPRINT.md](./FEATURE-BLUEPRINT.md) entry |
| **Logo** | **`KWIZERA AI.png`** only — per [BRAND-IDENTITY.md](./BRAND-IDENTITY.md) |
| **AI identity** | **KWIZERA AI** only — per [AI-IDENTITY-BLUEPRINT.md](./AI-IDENTITY-BLUEPRINT.md) |

---

## 2. General Development Rules

Development **must always** follow these principles:

| Principle | Requirement |
|-----------|-------------|
| **Blueprint First** | Read relevant blueprints before design or code; amend blueprint before adding scope |
| **Architecture Before Code** | Confirm layer, module, interfaces, and data ownership before implementation |
| **Stability Before New Features** | Working core beats unstable feature breadth |
| **Quality Before Quantity** | Few excellent outputs beat many mediocre ones |
| **Simplicity Before Complexity** | Simplest design that meets the objective |
| **Local-First Design** | Primary compute, storage, and workflow on user's Windows machine |
| **Modular Development** | One responsibility per module; defined interfaces |
| **Incremental Development** | Small validated increments — not big-bang integration |
| **Continuous Validation** | Verify at every step — not only at release |
| **Continuous Documentation** | Update docs, blueprint index, and change history with every significant change |

### 2.1 Priority when principles conflict

1. **User data safety**  
2. **Stability and recovery**  
3. **Blueprint compliance**  
4. **Simplicity** (user-facing)  
5. **Modularity** (system layer)  
6. **Speed of delivery**  

---

## 3. Implementation Rules

Before implementing **any feature**, complete this **five-step verification gate**. **Only then** begin implementation.

| Step | Verification | Reference |
|------|--------------|-----------|
| **1. Verify it exists in the Blueprint** | Feature listed in [FEATURE-BLUEPRINT.md](./FEATURE-BLUEPRINT.md); not deprecated | Step 1D §6 change control |
| **2. Verify its dependencies** | All dependent modules and data sources identified and available | Feature Blueprint dependency matrix |
| **3. Verify its architecture** | Layer assignment, interfaces, Storage Gateway path, error isolation | [SYSTEM-ARCHITECTURE-BLUEPRINT.md](./SYSTEM-ARCHITECTURE-BLUEPRINT.md) |
| **4. Verify its workflow** | User journey stage + AI workflow step + thinking cycle hooks | Steps 1E, 1F, 1G |
| **5. Verify its inputs and outputs** | Expected I/O documented; data contracts defined | Feature module spec + [DATA-FLOW-BLUEPRINT.md](./DATA-FLOW-BLUEPRINT.md) |

### 3.1 Implementation gate checklist

- [ ] Feature ID and module number recorded  
- [ ] Dependencies implemented or stubbed with explicit TODO in phase plan  
- [ ] Architecture review complete (layer + interface list)  
- [ ] Workflow mapping documented  
- [ ] Input/output contracts written  
- [ ] Test plan drafted (§8–§9)  
- [ ] Quality standards identified (Step 1J)  

**No code** for the feature until all seven items are satisfied or explicitly waived in phase documentation with blueprint amendment.

---

## 4. Module Rules

Every module **must**:

| Requirement | Standard |
|-------------|----------|
| **One clear responsibility** | Single primary purpose per module — Feature Blueprint §3 |
| **Independent** | Operable without tight coupling to other modules' internals |
| **Reusable** | Shared logic extracted — not copy-pasted |
| **Testable** | Unit and integration tests via interfaces |
| **Documented** | Purpose, I/O, dependencies, and recovery in blueprint or module addendum |
| **Easy to maintain** | Clear ownership; no god-objects |

### 4.1 Module communication rule

**No module shall directly modify another module's internal data.**

| Allowed | Forbidden |
|---------|-----------|
| Commands and queries via defined interfaces | Direct file/DB access to another module's store |
| Read-only snapshots and event payloads | Shared mutable global state |
| Storage via Storage Gateway only | Bypass Gateway writes |

### 4.2 Module registration

New modules require:

1. [FEATURE-BLUEPRINT.md](./FEATURE-BLUEPRINT.md) amendment  
2. Architecture layer assignment (Step 1H)  
3. Data ownership entry ([DATA-FLOW-BLUEPRINT.md](./DATA-FLOW-BLUEPRINT.md))  
4. Quality validation row ([QUALITY-STANDARDS-BLUEPRINT.md](./QUALITY-STANDARDS-BLUEPRINT.md) §15)  
5. [BLUEPRINT-INDEX.md](./BLUEPRINT-INDEX.md) update if new document affected  

---

## 5. Data Rules

### 5.1 Permanent storage

| Rule | Requirement |
|------|-------------|
| **All important user data stored permanently** | Projects, products, media metadata, memory, knowledge, exports index, settings |
| **Nothing important in temp-only storage** | Session cache is non-authoritative; must rebuild from persistent store |
| **RWF pricing** | Stored with currency context; primary currency **RWF** per Step 1B |

### 5.2 Data protection events

The application **must protect user data** during:

| Event | Requirement |
|-------|-------------|
| **Restart** | State reloads from Layer 6; no silent loss |
| **Shutdown** | Graceful flush; bounded wait for in-flight saves |
| **Recovery** | Checkpoints + WAL; no destructive rollback of user assets |
| **Update** | Migration with pre-migrate backup |
| **Crash** | Next launch: integrity check + Recovery Engine |

### 5.3 Data implementation rules

| Rule | Source |
|------|--------|
| Storage Gateway sole write path | Architecture 1H |
| Transactional project saves | AI Workflow Step 10 |
| Versioned asset regeneration | Data Flow §8 |
| Additive learning only | Steps 1B, 1G |
| Backup before destructive migration | Architecture §9 |

---

## 6. Architecture Rules (Summary)

| Rule | Requirement |
|------|-------------|
| **Seven layers** | Desktop → Presentation → AI Core → Business Logic → Memory/Knowledge → Storage → Infrastructure |
| **Downward dependencies** | Upper depends on lower — no reverse dependency |
| **Storage Gateway** | Sole write path to Layer 6 |
| **Interface + Event Bus** | Cross-module communication |
| **Error isolation** | Module failure must not crash entire app |
| **Extensibility** | Register plugins — do not redesign layers |

Full specification: [SYSTEM-ARCHITECTURE-BLUEPRINT.md](./SYSTEM-ARCHITECTURE-BLUEPRINT.md)

---

## 7. AI Development Rules

| Rule | Requirement |
|------|-------------|
| Identity | **KWIZERA AI** only — Step 1C |
| Thinking | 16-step cycle — Step 1G |
| Workflow | 12-step pipeline — Step 1F |
| User guidance | 7-step decision process — Step 1C |
| Verify before success | Never false completion |
| Output quality | Score and improve before present — Step 1J §4–§5 |
| Learning | Additive only — never intentionally forget user data |
| Currency | **RWF** primary for pricing |

---

## 8. Testing Rules

No feature may be considered **complete** until it passes **all applicable** test categories:

| Category | Scope |
|----------|-------|
| **Unit Testing** | Module logic in isolation with mocked dependencies |
| **Integration Testing** | Interface communication between modules |
| **Functional Testing** | Behavior matches Feature Blueprint specification |
| **Runtime Testing** | Service init, lifecycle, and shutdown under load |
| **Recovery Testing** | Failure injection → retry/restore; no data loss |
| **User Experience Testing** | [QUALITY-STANDARDS-BLUEPRINT.md](./QUALITY-STANDARDS-BLUEPRINT.md) §3 |
| **Performance Testing** | Meets performance standards — Step 1J §12 |

### 8.1 Completion rule

**No feature is complete until all applicable tests pass.**

### 8.2 Test layering

| Layer | Approach |
|-------|----------|
| L4 Business Logic | Unit tests; mock Gateway + Memory API |
| L3 AI Core | Thinking/workflow tests; mock L4/L5 |
| L5 Memory/Knowledge | Search and additive write tests |
| L6 Storage | Repository integration on temp roots |
| L7 Infrastructure | Health, recovery, job queue failure tests |
| L2 Presentation | UX + integration (when UI exists) |

---

## 9. Live Validation Rules

Every **completed feature** must pass **LIVE validation** before marked complete.

### 9.1 Live validation process

The validator (developer, QA, or **KWIZERA AI**-assisted test protocol in future phases) must:

| Step | Action |
|------|--------|
| 1 | **Open the application** on supported Windows environment |
| 2 | **Use the feature like a real user** — not only unit tests |
| 3 | **Verify every workflow** mapped to the feature |
| 4 | **Verify every interactive control** (buttons, actions, navigation) |
| 5 | **Verify every internal service** invoked by the feature responds correctly |
| 6 | **Verify every save operation** persists after restart |
| 7 | **Verify every loading operation** completes or fails with meaningful message — never infinite load |
| 8 | **Verify every generated result** meets quality standards where applicable |

### 9.2 Live validation gate

**Only after successful LIVE validation** may the feature be marked **complete**.

### 9.3 Live validation record

Each live validation must produce:

| Field | Content |
|-------|---------|
| Feature ID | From Feature Blueprint |
| Date / phase | When validated |
| Environment | Windows version, hardware notes if relevant |
| Workflows tested | Journey stages / workflow steps |
| Pass/fail | Per workflow and control |
| Issues found | Root cause + fix reference |
| Sign-off | Validator identity |

---

## 10. Error Handling Rules

If **any error** is detected during development or validation:

| Step | Action |
|------|--------|
| 1 | **Stop** — do not mark complete or proceed blindly |
| 2 | **Find the root cause** — not symptoms alone |
| 3 | **Repair the problem** — fix at source |
| 4 | **Test again** — rerun failed and related tests |
| 5 | **Verify the repair** — confirm fix; no regression |

### 10.1 Error handling standards

| Requirement | Policy |
|-------------|--------|
| Detect | Structured capture — module, step, severity |
| Log | Logging Engine with correlation ID |
| Explain | User-facing plain language |
| Recover | Auto-retry, checkpoint, service restart per policy |
| Protect data | No delete on failure; transactional rollback |

**Never claim success without verification.** Aligns with Steps 1C, 1G, 1J §13.

---

## 11. Performance Rules

Optimize **continuously**:

| Target | Policy |
|--------|--------|
| **Startup speed** | Lazy-load; parallel service init; Dashboard ≤ 8s goal on reference hardware |
| **Memory usage** | LRU cache; stream video; bounded growth |
| **CPU usage** | Job queue limits; worker isolation |
| **Database performance** | Indexed queries; pagination; batch writes |
| **Search performance** | Indexed memory/knowledge; typical < 2s |
| **AI response time** | Progress events; bounded timeouts |

**Maintain professional desktop application performance** — UI responsive during background work (Step 1J §12).

Long operations **> 500ms** → Job Queue with progress (Architecture 1H).

---

## 12. Code Quality Rules

The project **must avoid**:

| Anti-pattern | Rule |
|--------------|------|
| **Duplicate code** | Extract and reuse; DRY within reason |
| **Circular dependencies** | Layers and modules acyclic |
| **Unused files** | Remove or archive with documentation |
| **Unused imports** | Clean on commit |
| **Dead code** | Remove; do not comment-out indefinitely |
| **Infinite loops** | Bounded retries; timeouts on all waits |
| **Blocking operations** | No block UI thread for I/O or render |
| **Unhandled exceptions** | Catch at module boundary; log + recover |
| **Hard-coded values** | Config, constants file, or blueprint-documented exceptions |

### 12.1 Architecture cleanliness

| Rule | Requirement |
|------|-------------|
| Clean architecture | Clear layers and boundaries — Step 1B |
| Separation of concerns | Presentation ≠ business ≠ storage |
| No duplicate logic | Single source of truth per domain |
| Official interfaces only | Cross-module via contracts |

---

## 13. Version Control & Change History Rules

Every **important change** must be documented.

| History type | What to keep |
|--------------|--------------|
| **Development history** | Commits with meaningful messages; phase tags |
| **Architecture history** | Amendments to Step 1H and technical addenda |
| **Blueprint history** | Amendments to Steps 1A–1K with date and rationale |
| **Change history** | Feature additions, deprecations, breaking interface changes |

### 13.1 Change documentation requirements

| Change type | Required documentation |
|-------------|------------------------|
| New feature | Feature Blueprint amendment + index update |
| Architecture change | System Architecture amendment |
| AI behavior change | Steps 1C, 1F, or 1G amendment |
| Quality bar change | Step 1J amendment |
| Governance change | This document (1K) amendment |
| Breaking interface | Version bump + migration notes |

### 13.2 Commit discipline (when VCS in use)

- One logical change per commit where practical  
- Reference feature/module ID in message  
- No commit of secrets, credentials, or user data  
- No force-push to main without explicit project owner approval  

---

## 14. Recovery Rules

The application **must always** recover safely after:

| Event | Requirement |
|-------|-------------|
| **Crash** | Next launch: integrity check + Recovery Engine |
| **Power failure** | WAL + checkpoint restore where possible |
| **Windows restart** | Persistent data intact; session recovery optional |
| **Application restart** | Reload from Layer 6; resume in-progress project if checkpoint exists |
| **Update** | Pre-migrate backup; forward migration; verify on first launch |

### 14.1 Data loss prohibition

**No important work should ever be lost.**

| Protected | Mechanism |
|-----------|-----------|
| User projects | Transactional save + backup |
| Uploads | Written to media store before ack |
| Generated assets | Versioned files + manifest |
| Memory / knowledge | Additive writes + backup scope |
| Workflow state | Checkpoints per AI Workflow Step 1F |

Full specification: Architecture §9, User Journey Stage 1, AI Workflow Step 10.

---

## 15. Project Governance

### 15.1 Phase governance

| Rule | Requirement |
|------|-------------|
| **Phase authorization** | Each phase requires explicit start authorization |
| **Blueprint compliance** | Phase deliverables mapped to blueprint sections |
| **Phase exit** | Final Approval Rule (§16) before next phase |
| **Scope control** | No out-of-blueprint features |

### 15.2 Roles (conceptual)

| Role | Responsibility |
|------|----------------|
| **Project owner** | Phase authorization; blueprint amendment approval |
| **Engineering** | Implementation per this document |
| **Quality** | Live validation sign-off |
| **KWIZERA AI** (runtime) | Guided workflows; verify-before-success at runtime |

### 15.3 Amendment process

1. Identify contradiction or gap  
2. Draft blueprint amendment  
3. Check consistency against [BLUEPRINT-INDEX.md](./BLUEPRINT-INDEX.md) documents  
4. Update affected documents + index  
5. Record in blueprint change history  
6. Resume implementation  

---

## 16. Final Approval Rule

**No future phase may begin** until:

| Gate | Requirement |
|------|-------------|
| **Current phase validation** | All phase deliverables pass §8 Testing + §9 Live Validation (where applicable) |
| **Critical issues** | All critical and blocking issues resolved |
| **Documentation** | Phase docs, blueprint updates, and change history complete |
| **Blueprint consistency** | No unresolved contradictions across Steps 1A–1K |

### 16.1 Phase completion checklist

- [ ] All phase features pass applicable tests (§8)  
- [ ] Live validation complete for user-facing features (§9)  
- [ ] Quality standards met ([QUALITY-STANDARDS-BLUEPRINT.md](./QUALITY-STANDARDS-BLUEPRINT.md))  
- [ ] Blueprint index updated  
- [ ] Known issues documented with severity  
- [ ] Explicit authorization for next phase obtained  

### 16.2 Relationship to Master Blueprint (Step 1I)

[MASTER-BLUEPRINT-REPORT.md](./MASTER-BLUEPRINT-REPORT.md) approved Phase 1 foundation. Steps **1J** and **1K** extend governance and quality policy. **Phase 2** still requires:

1. Master Blueprint foundation (1A–1K)  
2. Explicit **Phase 2 authorization**  
3. Phase 2 exit per §16 before Phase 3  

---

## 17. Branding & Identity Rules (Development)

| Rule | Requirement |
|------|-------------|
| App logo | **`KWIZERA AI.png`** only |
| Product name | **KWIZERA AI STUDIO** / **KWIZERA AI** |
| Assistant | **KWIZERA AI** — no alternate personas |
| Legacy | No BYOSE branding or code reuse |

Source: [BRAND-IDENTITY.md](./BRAND-IDENTITY.md), [AI-IDENTITY-BLUEPRINT.md](./AI-IDENTITY-BLUEPRINT.md)

---

## 18. Explicit Non-Goals (Step 1K)

This document does **not** authorize:

- Application source code  
- UI component implementation  
- API endpoint specifications  
- Database table schemas  
- CI/CD pipeline configuration  
- Technology stack selection (deferred to Phase 2 addendum)  

---

## 19. Quick Reference — Mandatory Rules

**Before code:** Blueprint → dependencies → architecture → workflow → I/O  

**Modules:** One job · independent · testable · interface-only communication  

**Data:** Permanent · protected · Gateway-only writes  

**Testing:** Unit → integration → functional → runtime → recovery → UX → performance  

**Live:** Real app · real user paths · verify saves, loads, results  

**Errors:** Stop → root cause → fix → retest → verify  

**Ship:** No complete without tests + live validation + blueprint consistency  

**Phases:** No next phase until current passes Final Approval Rule  

---

**KWIZERA AI STUDIO** — Discipline in development. Integrity in delivery.

*End of Development Rules, Engineering Policy & Project Governance — Step 1K*
