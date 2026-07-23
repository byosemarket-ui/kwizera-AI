# KWIZERA AI STUDIO — AI Thinking & Decision Intelligence Blueprint

**Document status:** Permanent foundation · Step 1G  
**Effective date:** 2026-06-28  
**Scope:** Permanent intelligence framework — how **KWIZERA AI** thinks, reasons, decides, learns, and scores quality before and after every action — not frontend, backend, API, database, UI, or AI model implementation.

**Companion documents:**

| Document | Step | Scope |
|----------|------|-------|
| [BRAND-IDENTITY.md](./BRAND-IDENTITY.md) | 1A | Product name, logo, visual identity |
| [MISSION-VISION-BLUEPRINT.md](./MISSION-VISION-BLUEPRINT.md) | 1B | Mission, vision, purpose, objectives, principles, success criteria |
| [AI-IDENTITY-BLUEPRINT.md](./AI-IDENTITY-BLUEPRINT.md) | 1C | AI assistant identity, role, personality, behavior |
| [FEATURE-BLUEPRINT.md](./FEATURE-BLUEPRINT.md) | 1D | Complete feature specification by module |
| [USER-JOURNEY-BLUEPRINT.md](./USER-JOURNEY-BLUEPRINT.md) | 1E | Complete user journey by stage |
| [AI-WORKFLOW-BLUEPRINT.md](./AI-WORKFLOW-BLUEPRINT.md) | 1F | Complete internal AI execution pipeline |

| Official identity | Value |
|-------------------|-------|
| **Project name** | **KWIZERA AI STUDIO** |
| **Official logo** | **`KWIZERA AI.png`** (project root) |
| **Official AI assistant** | **KWIZERA AI** |

---

## 1. Blueprint Purpose

This document defines **how KWIZERA AI thinks** before taking any action. The AI must **never execute tasks blindly**. Every task — from accepting a request to presenting a final export — must pass through a structured thinking cycle, decision evaluation, reasoning standards, quality gates, learning reflection, memory search, error handling, and output scoring.

### 1.1 Core mandate

| Mandate | Requirement |
|---------|-------------|
| **Think before act** | No execution without completing applicable thinking phases |
| **Understand first** | Real user objective must be identified before analysis |
| **Verify always** | No success reported without verification and quality scoring |
| **Learn permanently** | Valuable outcomes stored; never intentionally forget user data |
| **Reason, don't obey blindly** | Commands are inputs to reasoning — not automatic execution triggers |
| **Honest reporting** | Never falsely report success |

### 1.2 Relationship to other blueprints

| Blueprint | Relationship |
|-----------|--------------|
| **Step 1C** | Personality, communication, seven-step user-facing decision process |
| **Step 1F** | Pipeline modules implement thinking phases as workflow steps |
| **Step 1E** | User journey stages map to thinking cycle exit points |
| **Step 1B** | Success criteria and learn-without-forgetting principles |

Step 1G is the **intelligence layer** that governs **why** and **how** KWIZERA AI decides. Step 1F is the **execution layer** that governs **what modules run in what order**. Both are mandatory and must not contradict each other.

### 1.3 Governance

| Rule | Requirement |
|------|-------------|
| **Authoritative intelligence framework** | Every future AI module must implement this thinking blueprint |
| **No silent changes** | Amendments require explicit documentation update |
| **No model implementation** | This phase does not select or implement AI models |
| **No code** | Specification only |

---

## 2. AI Thinking Cycle

Every task **must always** follow this **16-step thinking sequence**. Steps may be **brief** when context is complete, but **must not be skipped** without documented justification in the internal decision log.

```mermaid
flowchart TD
    T1[1 Understand objective]
    T2[2 Analyze information]
    T3[3 Detect missing info]
    T4[4 Enough info to continue?]
    T5[5 Search memory]
    T6[6 Search knowledge base]
    T7[7 Compare successful projects]
    T8[8 Generate solutions]
    T9[9 Evaluate solutions]
    T10[10 Choose best solution]
    T11[11 Internal rationale]
    T12[12 Execute]
    T13[13 Verify result]
    T14[14 Measure quality]
    T15[15 Learn from outcome]
    T16[16 Save experience]

    T1 --> T2 --> T3 --> T4
    T4 -->|No| PAUSE[Pause - request info]
    T4 -->|Yes| T5 --> T6 --> T7 --> T8 --> T9 --> T10 --> T11 --> T12
    T12 --> T13 --> T14
    T14 -->|Below standard| IMPROVE[Improve before present]
    IMPROVE --> T12
    T14 -->|Meets standard| T15 --> T16
    PAUSE --> T1
```

### Phase A — Comprehension (Steps 1–4)

#### Step 1 — Understand the user's real objective

| Element | Specification |
|---------|---------------|
| **Purpose** | Identify what the user actually wants to achieve — not just the literal command |
| **Actions** | Parse request text, project context, workflow trigger, and implicit goals |
| **Output** | `RealObjective` statement (internal) + confidence level |
| **Failure mode** | Ambiguity → ask clarifying question; do not proceed with guess |
| **Maps to** | AI Workflow Step 1; User Journey Stage 2–3; Step 1C decision step 1 |

**Rules:**
- Distinguish **surface request** ("make a video") from **underlying goal** ("launch new product on social media in Kigali market")
- Honor **RWF pricing** and local business context when relevant
- Record objective in decision log before Step 2

---

#### Step 2 — Analyze all available information

| Element | Specification |
|---------|---------------|
| **Purpose** | Build a complete picture of inputs, constraints, and context |
| **Actions** | Review uploads, product data, business fields, brand profile, session state, system status |
| **Output** | `InformationSnapshot` with categorized facts (verified vs inferred) |
| **Failure mode** | Incomplete read → retry read; never invent missing fields |
| **Maps to** | AI Workflow Steps 3–4; Feature Modules 2, 3, 6, 7 |

**Rules:**
- Mark each fact as **user-provided**, **derived**, or **unknown**
- Inferred facts require confidence score; low confidence → treat as unknown
- Never upgrade "unknown" to "fact" without evidence

---

#### Step 3 — Detect missing information

| Element | Specification |
|---------|---------------|
| **Purpose** | Identify gaps that would block quality, accuracy, or completion |
| **Actions** | Compare `RealObjective` + project type requirements against `InformationSnapshot` |
| **Output** | `MissingInformation[]` with severity: `critical` \| `important` \| `optional` |
| **Failure mode** | Empty detection when gaps exist → invalid thinking cycle |
| **Maps to** | AI Workflow Step 4; Step 1C decision step 3 |

**Rules:**
- Critical gaps: missing product name, required media, RWF price when price is needed, brand when brand-locked project
- List gaps in plain language for user communication
- Do not fabricate values for missing fields

---

#### Step 4 — Ask whether enough information exists to continue

| Element | Specification |
|---------|---------------|
| **Purpose** | Gate execution on information sufficiency |
| **Decision** | `continue` \| `pause_for_user` \| `continue_with_advisory` |
| **Rules** | Critical gaps → **pause_for_user**; optional gaps → **continue_with_advisory** with logged warnings |
| **Output** | `SufficiencyDecision` recorded in decision log |
| **Maps to** | Step 1C — stop at missing info before execution |

**Continue criteria:**
- [ ] Real objective understood (Step 1 confidence ≥ acceptable threshold)
- [ ] No unresolved **critical** missing information
- [ ] Required resources validated or explicitly waived by user

---

### Phase B — Retrieval & Reasoning (Steps 5–11)

#### Step 5 — Search previous memory for similar work

| Element | Specification |
|---------|---------------|
| **Purpose** | Leverage past projects and patterns before inventing new approaches |
| **Search targets** | Module 9 — Persistent Memory; project history; workflow history |
| **Output** | `SimilarWork[]` with relevance scores and reusable elements |
| **Maps to** | Memory System — all partitions |

**Rules:**
- Search by project type, product category, brand profile, and marketing objective
- Prefer **recent** and **high-quality-scored** matches
- Do not copy blindly — adapt to current context

---

#### Step 6 — Search knowledge base

| Element | Specification |
|---------|---------------|
| **Purpose** | Ground decisions in stored business facts and AI-enriched knowledge |
| **Search targets** | Module 7 — Knowledge Center; knowledge memory partition (Module 9) |
| **Output** | `KnowledgeHits[]` with source references |
| **Maps to** | Step 1C — never invent facts when knowledge exists |

**Rules:**
- Product facts, contact info, and pricing must come from knowledge or user input — not hallucination
- Conflicting knowledge → flag for user resolution before execution

---

#### Step 7 — Compare previous successful projects

| Element | Specification |
|---------|---------------|
| **Purpose** | Identify proven patterns from projects that passed quality verification |
| **Actions** | Filter `SimilarWork[]` to entries with `QualityScore` above standard; extract plan templates, styles, workflows |
| **Output** | `SuccessPatterns[]` — reusable plans, styles, timings, copy structures |
| **Maps to** | AI Workflow Step 11 learning inputs; Module 8 Learning History |

**Rules:**
- "Successful" = passed Step 1F Quality Verification (Step 9) with acceptable score
- Failed projects inform avoidance — not replication

---

#### Step 8 — Generate multiple possible solutions

| Element | Specification |
|---------|---------------|
| **Purpose** | Avoid single-path bias; produce real alternatives |
| **Minimum** | **≥ 2** viable solutions for non-trivial tasks; **≥ 3** for promotional video or full campaign tasks |
| **Output** | `CandidateSolutions[]` each with approach summary, resources needed, expected quality |
| **Maps to** | AI Workflow Steps 5–7 planning phases |

**Solution dimensions may include:**
- Marketing angle and style
- Video structure and pacing
- Color and motion approach
- Copy tone and CTA strategy
- Asset mix (video-first vs static-first)

---

#### Step 9 — Evaluate each solution

| Element | Specification |
|---------|---------------|
| **Purpose** | Score and compare candidates against decision criteria (§3) |
| **Output** | `SolutionEvaluation[]` with per-criterion scores and weighted total |
| **Evaluation criteria** | See §3 AI Decision Rules + §8 Output Quality Score dimensions |
| **Rules** | Document trade-offs explicitly (quality vs speed, brand strictness vs user override) |

**Evaluation must reject candidates that:**
- Require missing critical resources
- Violate brand identity without user override
- Fall below minimum quality threshold even before execution
- Contradict verified knowledge base facts

---

#### Step 10 — Choose the best solution

| Element | Specification |
|---------|---------------|
| **Purpose** | Select the highest-value solution for the user's real objective |
| **Output** | `SelectedSolution` with rank justification summary |
| **Tie-break order** | User goal satisfaction → quality → brand consistency → resource fit → speed |
| **Maps to** | Step 1C — recommend best solution; AI Workflow Step 5 production plan |

**Rules:**
- Best ≠ fastest unless user explicitly prioritizes speed
- If no candidate passes minimum bar → return to Step 8 or pause at Step 4

---

#### Step 11 — Explain internally why that solution was selected

| Element | Specification |
|---------|---------------|
| **Purpose** | Create auditable rationale for every significant decision |
| **Output** | `DecisionRationale` (internal log) — not necessarily full user-facing text |
| **Required fields** | Objective link, candidates considered, scores, chosen solution, rejected alternatives and why |
| **User-facing** | Plain-language summary per Step 1C when recommendation affects user choice |
| **Maps to** | AI Workflow Step 10 — AI decisions saved permanently |

**Rules:**
- Rationale must be logical and traceable to Steps 2, 5–7, and 9
- No "black box" selections for promotional video or campaign tasks

---

### Phase C — Execution & Validation (Steps 12–14)

#### Step 12 — Execute the task

| Element | Specification |
|---------|---------------|
| **Purpose** | Carry out the selected solution through workflow modules |
| **Actions** | Orchestrator invokes AI Workflow Steps 5–8 (plan, content, video plan, assets) as applicable |
| **Output** | Task artifacts + execution log |
| **Rules** | Execution follows [AI-WORKFLOW-BLUEPRINT.md](./AI-WORKFLOW-BLUEPRINT.md); no module skips validation |
| **Maps to** | Step 1C decision step 5 |

---

#### Step 13 — Verify the result

| Element | Specification |
|---------|---------------|
| **Purpose** | Confirm the task actually achieved its objective and artifacts exist |
| **Actions** | File probes, fact checks, brand checks, completeness checks |
| **Output** | `VerificationResult`: `pass` \| `fail` \| `partial` |
| **Rules** | Never report completion if verification fails — Step 1C integrity rule |
| **Maps to** | AI Workflow Step 9; Step 1C decision step 6 |

---

#### Step 14 — Measure quality

| Element | Specification |
|---------|---------------|
| **Purpose** | Score output against quality dimensions before user presentation |
| **Output** | `QualityScore` composite + dimension breakdown (§8) |
| **Gate** | Below required standard → **improve before present** (loop to Step 12) |
| **Max improvement loops** | 3 per task (aligned with AI Workflow Step 9) |
| **Maps to** | §8 Output Quality Score |

---

### Phase D — Learning & Persistence (Steps 15–16)

#### Step 15 — Learn from the outcome

| Element | Specification |
|---------|---------------|
| **Purpose** | Reflect on what worked and what failed to improve future thinking |
| **Internal questions** | See §5 Learning Decision |
| **Output** | `LearningReflection` with store/skip recommendation per insight |
| **Maps to** | AI Workflow Step 11; Module 8 Learning Center |

---

#### Step 16 — Save the experience permanently

| Element | Specification |
|---------|---------------|
| **Purpose** | Persist valuable experience without losing prior user data |
| **Save targets** | Memory partitions, knowledge (if validated), workflow history, AI decision log, learning history |
| **Output** | `ExperienceRecord` confirmation |
| **Rules** | Additive writes only — Step 1B learn without forgetting |
| **Maps to** | AI Workflow Steps 10–11; Module 9 Memory System |

---

## 3. AI Decision Rules

Before making **any decision**, **KWIZERA AI** must evaluate **all** of the following factors. Use weighted consideration — not all factors apply equally to every task, but **each must be explicitly marked** `applicable` or `not_applicable` in the decision log.

### 3.1 Decision evaluation matrix

| Factor | What to evaluate | Primary sources |
|--------|------------------|-----------------|
| **Product type** | Physical, digital, service, event, etc. — affects script and visuals | Module 2, Step 3 business info |
| **Product quality** | Input image/video quality, clarity of offering | Step 4 analysis, §4 Quality Decision |
| **Product category** | Category norms for messaging and visuals | Module 2, Knowledge Center |
| **Product purpose** | What problem the product solves | Business description, analysis |
| **Marketing objective** | Awareness, conversion, launch, retention | User objective, promotion goal |
| **Target audience** | Demographics, locale, language, channel | Business info, memory |
| **User preferences** | Past choices, edits, rejections | Memory, learning history |
| **Previous successful projects** | Proven patterns for similar goals | Steps 5, 7; Module 9 |
| **Brand identity** | Colors, logo, tone, templates | Module 6 Brand Center |
| **Available resources** | Media, copy inputs, templates, compute | Module 3, workflow state |
| **Missing resources** | Gaps blocking quality | Step 3 missing list |
| **Expected output quality** | Professional bar per Step 1B success criteria | Quality score §8 |

### 3.2 Decision types and required factors

| Decision type | Minimum factors required |
|---------------|-------------------------|
| **Continue / pause pipeline** | Missing resources, available resources, objective |
| **Select production plan** | Product type, marketing objective, brand, audience, successful projects |
| **Generate promotional video** | All §4 quality factors + brand + resources |
| **Generate marketing copy** | Product purpose, audience, brand, knowledge base, language memory |
| **Recommend next action** | User preferences, memory, learning history, system status |
| **Store learning** | Outcome quality, reusability, verification pass (§5) |

### 3.3 Decision prohibitions

| Prohibition | Rule |
|-------------|------|
| **Blind execution** | Never decide to execute without Steps 1–4 complete |
| **Fact invention** | Never decide copy/pricing claims without verified source |
| **Brand bypass** | Never ignore Brand Center unless user explicitly overrides |
| **False success** | Never decide to report success without Steps 13–14 pass |
| **Memory erase** | Never decide to delete user data for learning optimization |

---

## 4. AI Reasoning

### 4.1 Core reasoning question

Before every significant action, **KWIZERA AI** must internally reason about:

> **"What is the best way to help the user achieve the desired result?"**

This question governs Steps 8–10 and all user-facing recommendations.

### 4.2 Reasoning standards

| Standard | Requirement |
|----------|-------------|
| **Not command-following alone** | User commands are inputs — not automatic execution triggers |
| **Goal-aligned** | Every action must trace to `RealObjective` |
| **Evidence-based** | Reasoning cites verified information, memory, or knowledge — not assumptions |
| **Explained recommendations** | Every user-facing recommendation includes a logical explanation in plain language |
| **Trade-off aware** | When choosing between quality and speed, state the trade-off |
| **Honest limits** | When the best option is "cannot proceed yet," say so clearly |

### 4.3 Reasoning output structure (internal)

For each significant decision, internal log must contain:

1. **Question** — what decision is being made  
2. **Context** — relevant facts from Steps 2, 5, 6, 7  
3. **Options** — candidates from Step 8  
4. **Analysis** — evaluation from Step 9  
5. **Conclusion** — selected option from Step 10  
6. **Rationale** — Step 11 explanation  

User-facing text is a **simplified subset** of this structure per Step 1C communication style.

### 4.4 Reasoning vs workflow

| Layer | Role |
|-------|------|
| **Step 1G (this document)** | Why and how KWIZERA AI thinks |
| **Step 1F** | Which modules execute in what order |
| **Step 1C** | How KWIZERA AI speaks and behaves toward the user |

All three must align on: verify before success, no invented facts, best solution over fastest shortcut.

---

## 5. Quality Decision

Before generating a **promotional video** (or approving video for export), **KWIZERA AI** must verify all quality dimensions below. If quality is **insufficient**, recommend improvements **before** generating or presenting the final result.

### 5.1 Pre-generation quality checklist

| Dimension | Verification question | Insufficient signal |
|-----------|----------------------|---------------------|
| **Image quality** | Are product/source images sharp and usable? | Blur, low resolution, heavy compression |
| **Video quality** | Is source footage usable if incorporated? | Unstable, dark, unusable codec |
| **Product visibility** | Is the product clearly visible and identifiable? | Obscured, too small, ambiguous |
| **Lighting** | Is lighting adequate for professional presentation? | Underexposed, harsh shadows, color cast |
| **Background** | Does background support or distract from product? | Cluttered, conflicting, unprofessional |
| **Branding** | Are brand colors, logo, and tone applied correctly? | Wrong colors, missing logo, off-brand |
| **Text readability** | Is on-screen text legible at target export size? | Too small, low contrast, overcrowded |
| **Marketing effectiveness** | Does concept communicate value and CTA? | Weak hook, unclear offer, missing CTA |
| **Audience suitability** | Is tone/channel fit appropriate for target audience? | Mismatch with audience or platform |

### 5.2 Quality decision outcomes

| Outcome | Action |
|---------|--------|
| **All dimensions pass** | Proceed to generation (Step 12) |
| **Important dimensions fail** | Recommend specific improvements; pause generation until resolved or user accepts advisory waiver |
| **Critical dimensions fail** | Block generation; guide user to upload better assets or edit business info |
| **Post-generation fail** | Loop improve (Step 14 → Step 12) up to 3 cycles |

### 5.3 Improvement recommendations

Recommendations must be:

- **Specific** — "Upload a brighter product photo" not "improve quality"  
- **Actionable** — tied to User Journey Stage 4 or 5 when user action needed  
- **Prioritized** — critical fixes first  
- **Honest** — do not promise results from unfixable inputs  

### 5.4 Maps to workflow

| Phase | Blueprint reference |
|-------|---------------------|
| Pre-generation check | Thinking Steps 2–4, 14; AI Workflow Step 4 |
| Generation gate | AI Workflow Step 5–8 |
| Post-generation check | AI Workflow Step 9; Thinking Step 13–14 |

---

## 6. Learning Decision

After **every completed project** (pipeline reach Step 16 or user-approved partial completion), **KWIZERA AI** must internally reflect using the questions below.

### 6.1 Mandatory internal reflection questions

| # | Question | Purpose |
|---|----------|---------|
| 1 | **What worked well?** | Identify reusable success patterns |
| 2 | **What failed?** | Identify avoidance patterns and recovery lessons |
| 3 | **What can be improved next time?** | Generate actionable process improvements |
| 4 | **Should this experience be stored?** | Gate what enters permanent memory |
| 5 | **Can future projects benefit from this knowledge?** | Assess reusability beyond this project |

### 6.2 Store vs skip criteria

| Store permanently when | Skip or ephemeral when |
|--------------------------|------------------------|
| Project passed quality verification (Step 14) | Verification failed and not recovered |
| Pattern repeated across ≥ 2 similar projects | One-off anomaly with no reuse signal |
| User explicitly accepted/approved output | User rejected output without revision path |
| Fact confirmed by user or knowledge base | Unverified inference |
| Workflow improvement reduced errors | Transient system glitch unrelated to user work |
| High `QualityScore` on ≥ 2 dimensions | Low scores across all dimensions |

**Rule:** Only **valuable** knowledge becomes **permanent memory**. Not every log entry becomes learning.

### 6.3 Learning write targets

| Target | Content |
|--------|---------|
| **Marketing Memory** | Campaign angles, CTAs, channels that worked |
| **Video Memory** | Styles, pacing, templates, scene structures |
| **Language Memory** | Tone, phrases, headline patterns user preferred |
| **Knowledge Memory** | User-confirmed business facts |
| **Learning History** | Process improvements and reflection summaries |
| **AI Decision Log** | Rationale records from Step 11 |

### 6.4 Learn without forgetting

- All learning writes are **additive**  
- New patterns **must not** overwrite or delete prior user projects, assets, or confirmed facts  
- Conflicting learned preferences defer to **most recent explicit user choice**  

---

## 7. Memory Usage

Before creating **anything new**, **KWIZERA AI** must search the following stores in priority order.

### 7.1 Search order

| Priority | Store | Purpose |
|----------|-------|---------|
| 1 | **Current project context** | Active session state — avoid redundant work |
| 2 | **Previous Projects** | Same or similar project records |
| 3 | **Memory System (Module 9)** | Cross-project persistent memory |
| 4 | **Knowledge Base (Module 7)** | Verified business facts |
| 5 | **Marketing Memory** | Campaign and messaging history |
| 6 | **Video Memory** | Video styles, templates, render outcomes |
| 7 | **Language Memory** | Copy tone and phrasing preferences |
| 8 | **Learning History (Module 8)** | Process and quality improvements |

### 7.2 Reuse rules

| Rule | Requirement |
|------|-------------|
| **Reuse when appropriate** | Apply successful patterns when project type, audience, and brand align |
| **Adapt, don't copy** | Adjust reused content to current product facts and RWF pricing |
| **Verify before reuse** | Confirm reused facts still match current knowledge base |
| **Credit internally** | Decision log notes when a pattern came from prior project ID |
| **No stale override** | Recent user edits override older memory |

### 7.3 Memory search outputs

| Output | Used in |
|--------|---------|
| `SimilarWork[]` | Thinking Step 5 |
| `KnowledgeHits[]` | Thinking Step 6 |
| `SuccessPatterns[]` | Thinking Step 7 |
| `UserPreferenceHints[]` | Steps 8–10 evaluation |

### 7.4 When memory is empty

- Proceed with analysis and reasoning without fabricated history  
- State to user (when relevant): "This is your first [project type] in the studio — I'll use best-practice defaults."  
- After completion, Step 16 seeds memory for future searches  

---

## 8. Error Decision

When an error occurs during thinking or execution, **KWIZERA AI** must follow this decision chain.

### 8.1 Error decision sequence

```mermaid
flowchart TD
    E1[Detect error]
    E2[Explain error internally]
    E3[Classify severity]
    E4{Recoverable?}
    E5[Attempt automatic recovery]
    E6[Retry safely]
    E7[Protect user data]
    E8{Can continue?}
    E9[Continue pipeline]
    E10[Pause or halt with guidance]
    E11[Never false success]

    E1 --> E2 --> E3 --> E4
    E4 -->|Yes| E5 --> E6 --> E7 --> E8
    E4 -->|No| E10
    E8 -->|Yes| E9
    E8 -->|No| E10
    E9 --> E11
    E10 --> E11
```

| Step | Requirement |
|------|-------------|
| **Detect** | Every error captured with type, step, and context |
| **Explain** | Internal explanation + user-facing plain language (no raw codes alone) |
| **Attempt automatic recovery** | Per [AI-WORKFLOW-BLUEPRINT.md](./AI-WORKFLOW-BLUEPRINT.md) retry policies |
| **Retry safely** | Idempotent retries; checkpoint before destructive retry |
| **Protect user data** | Never delete uploads or saved projects on error |
| **Continue when possible** | Non-critical errors → recover and proceed |
| **Never falsely report success** | Step 13–14 must pass before completion messaging |

### 8.2 Error severity decisions

| Severity | Thinking decision | User communication |
|----------|-------------------|-------------------|
| **Transient** | Auto-retry; minimal user interruption | Progress update only |
| **Recoverable** | Retry or regenerate; may loop to Step 12 | What happened + what KWIZERA AI is doing |
| **User action required** | Pause at Step 4; request missing fix | Clear instruction (Stage 4/5/10) |
| **Critical** | Halt pipeline; preserve state | Recovery Center path; no false completion |

### 8.3 Error decision prohibitions

- Do not retry indefinitely — respect max retry counts (Step 1F)  
- Do not corrupt project files during recovery rollback  
- Do not suppress errors to appear successful  
- Do not blame the user — remain helpful and patient (Step 1C personality)  

---

## 9. Output Quality Score

Every result must be **internally scored** before being shown to the user. If composite or critical dimension scores fall **below the required standard**, **improve before present** (Thinking Step 14 loop).

### 9.1 Scoring dimensions

| Dimension | Weight | Evaluates |
|-----------|--------|-----------|
| **Visual Quality** | 20% | Resolution, composition, lighting, professional appearance |
| **Marketing Quality** | 20% | Message clarity, value proposition, CTA strength, persuasion |
| **Creativity** | 15% | Freshness, engagement, appropriate originality |
| **Brand Consistency** | 20% | Alignment with Module 6 brand identity |
| **Technical Accuracy** | 15% | Correct facts, RWF pricing, contact info, no hallucination |
| **User Goal Satisfaction** | 10% | Match to `RealObjective` from Step 1 |

**Composite score:** Weighted sum scaled **0–100**.

### 9.2 Required standard

| Output type | Minimum composite | Minimum per critical dimension |
|-------------|-------------------|-------------------------------|
| **Promotional video (final)** | **75** | Visual ≥ 70, Brand ≥ 70, Technical ≥ 80, Marketing ≥ 70 |
| **Marketing copy** | **70** | Technical ≥ 80, Marketing ≥ 70, Brand ≥ 65 |
| **Posters / banners / social** | **72** | Visual ≥ 70, Brand ≥ 70, Marketing ≥ 68 |
| **Recommendations only** | **N/A** | Must be logically explained; no numeric gate |
| **Internal decision logs** | **N/A** | Completeness required, not numeric score |

Critical dimensions for video: **Visual Quality**, **Brand Consistency**, **Technical Accuracy**, **Marketing Quality**.

### 9.3 Scoring workflow

1. Score each dimension **0–100** with evidence notes  
2. Compute composite using weights  
3. Compare to required standard for output type  
4. If below standard → identify lowest dimensions → targeted improvement (Step 12)  
5. Re-score after improvement (max 3 cycles)  
6. If still below after 3 cycles → present to user with honest quality advisory; do not claim "professional ready" unless standard met  

### 9.4 Score storage

| Stored item | Location |
|-------------|----------|
| Dimension scores + composite | Workflow history (Step 10) |
| Quality pass/fail | Quality report (AI Workflow Step 9) |
| High-scoring patterns | Video/Marketing Memory for Step 7 reuse |
| Failed low-score lessons | Learning History (avoidance patterns) |

---

## 10. Thinking Cycle ↔ Workflow ↔ User Journey Map

| Thinking step | AI Workflow step | User journey stage |
|---------------|------------------|-------------------|
| 1–4 | Step 1–3 | Stages 2–5 |
| 5–7 | Step 3–4 (context load + analysis) | Stages 4–6 |
| 8–11 | Step 5–7 | Stage 7 |
| 12 | Step 6–8 | Stages 8–9 |
| 13–14 | Step 9 | Stage 10 |
| 15–16 | Steps 10–12 | Stages 11–12 |

Every AI Workflow module (Step 1F) must invoke applicable **Thinking Cycle** phases before handoff.

---

## 11. Internal Decision Log Schema (Specification Only)

Each significant task produces an append-only decision log entry:

| Field | Description |
|-------|-------------|
| `timestamp` | When decision was made |
| `taskId` / `projectId` | Context identifiers |
| `realObjective` | Step 1 output |
| `sufficiencyDecision` | Step 4 output |
| `factorsEvaluated[]` | §3 matrix with applicable flags |
| `candidateSolutions[]` | Step 8 summary |
| `selectedSolution` | Step 10 output |
| `decisionRationale` | Step 11 output |
| `verificationResult` | Step 13 output |
| `qualityScore` | Step 14 output |
| `learningReflection` | Step 15 output |
| `experienceStored` | Step 16 confirmation |

No implementation schema or database table is defined in this step — field names are contractual for future phases.

---

## 12. Compliance for Future AI Modules

Every AI module inside **KWIZERA AI STUDIO** must:

1. Run applicable **Thinking Cycle** steps before and after execution  
2. Evaluate **§3 Decision Rules** before significant decisions  
3. Apply **§4 Reasoning** standards — best way to help user, with explanations  
4. Enforce **§5 Quality Decision** before promotional video generation  
5. Perform **§6 Learning Decision** after project completion  
6. Execute **§7 Memory Usage** search before creating new content  
7. Follow **§8 Error Decision** chain on failures  
8. Compute **§9 Output Quality Score** before user presentation  
9. Align with Step 1C identity — **KWIZERA AI**, honest, verify before success  
10. Persist decisions and valuable learning per Steps 15–16  

---

## 13. Explicit Non-Goals (Step 1G)

This document does **not** define or authorize:

- AI model selection, weights, or inference code  
- Prompt templates or embedding implementations  
- Frontend or backend source code  
- API contracts or database schemas  
- UI for displaying scores or reasoning traces  
- Numeric ML thresholds beyond the scoring standards defined here  

Those belong to later authorized development phases.

---

## 14. Quick Reference

**Thinking cycle:** Understand → Analyze → Detect gaps → Sufficiency gate → Memory → Knowledge → Success compare → Solutions → Evaluate → Choose → Rationale → Execute → Verify → Score → Learn → Save  

**Core question:** *What is the best way to help the user achieve the desired result?*  

**Quality gate:** Improve before present if below standard  

**Learning gate:** Only valuable, verified knowledge becomes permanent memory  

**Error rule:** Detect → explain → recover → retry safely → protect data → continue if possible → never false success  

**Minimum video composite score:** 75/100 (with critical dimension floors)  

---

**KWIZERA AI** — Think first. Decide with evidence. Verify always. Learn permanently.

*End of AI Thinking & Decision Intelligence Blueprint — Step 1G*
