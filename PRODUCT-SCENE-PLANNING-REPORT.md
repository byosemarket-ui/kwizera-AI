# PRODUCT SCENE PLANNING REPORT
## KWIZERA AI STUDIO — AI Creative Generation Pipeline Step 3

**Status:** COMPLETE  
**Scope:** Product Scene Planning only (no storyboard generation, no video generation)  
**Date:** 2026-08-09

---

### 1. Existing Scene Planning capability

Before Step 3, KWIZERA had related but different engines:

| Capability | Location | Role vs Step 3 |
|---|---|---|
| Creative planning | `ai/creative-planning` | Generic 3-scene creative plan; does not consume cutouts |
| Visual / storyboard / scene generation | `ai/visual-planning-engine`, `storyboard-intelligence-engine`, `scene-generation-engine` | Later video/storyboard steps — not used here |
| Storytelling/camera/lighting/marketing knowledge | `ai/video-knowledge-engine` | Offline knowledge packs consumed as domain guidance |
| Step 1 Product Intelligence | `ai/product-intelligence` | Product profile input |
| Step 2 Product Asset Preparation | `ai/product-asset-preparation` | Transparent asset library input |

**No dedicated Product Scene Planning runtime existed.** Step 2 deferred scene planning (`scenePlanningDeferred: true`).

---

### 2. Components upgraded

- `ai/creative-pipeline/creative-pipeline-manager.ts` — new stage `scene-planning` after `asset-preparation`
- `ai/conversation/conversation-engine.ts` + `types.ts` — `product-scene-planning` AI Me intent/provider
- `dev/persistent/runtime.ts` — initializes/wires Product Scene Planning + conversation + pipeline
- `dev/server/index.ts` — dashboard + plan API endpoints
- `ai/index.ts` / `package.json` — exports + `validate:product-scene-planning`
- `PRODUCT-ASSET-PREPARATION-REPORT.md` §13 — Step 3 marked implemented

---

### 3. Components created

- `ai/product-scene-planning/`
  - `types.ts`
  - `product-scene-planning-manager.ts`
  - `product-scene-planning-plugin.ts`
  - `index.ts`
- `scripts/validate-product-scene-planning.ts`
- `tests/unit/ai/product-scene-planning/product-scene-planning-manager.test.ts`
- This report: `PRODUCT-SCENE-PLANNING-REPORT.md`

No duplicate of creative-planning / storyboard / scene-generation engines.

---

### 4. Total planned scenes

Plans are evidence-driven from product profile + prepared assets + marketing goal.

Typical validation run produced a complete spine including:

- Hero Introduction
- Product Reveal
- Feature / detail / material / lifestyle / rotation / brand / price scenes when evidence supports them
- Call-To-Action Scene
- Closing Scene

Unsupported scene types (e.g. comparison without comparison data, promo without offer language) are omitted rather than invented.

Validation sample: **11 scenes**  
`hero-introduction → product-rotation → product-reveal → feature-highlight → detail-showcase → material-close-up → lifestyle-scene → brand-scene → price-presentation → call-to-action → closing-scene`

---

### 5. Scene sequence

Scenes are ordered by professional marketing flow:

1. Attention  
2. Interest  
3. Product Reveal  
4. Product Features  
5. Benefits  
6. Trust  
7. Price  
8. Offer  
9. Call To Action  

Each scene records: ID, name, type, objective, product view, camera angle/movement, lighting, background, environment, animation, transition, duration, product utilization, and why-it-exists.

---

### 6. Camera planning quality

Every scene includes camera angle + camera movement grounded in product view availability (front/detail/side/etc.).  
Validation: **cameraPlanningScore ≥ 70** (PASS).

---

### 7. Lighting planning quality

Every scene includes lighting style + background style + environment.  
Validation: **lightingPlanningScore ≥ 70** (PASS).

---

### 8. Marketing flow quality

Flow checks require attention + product-reveal + call-to-action coverage, ordered stages, and weak-flow detection.  
Validation: **marketingFlowScore ≥ 70** (PASS).

---

### 9. AI Me capability

AI Me can:

- Explain why every scene exists (`explainScenes`)
- Recommend better scene order (`recommendSceneOrder`)
- Detect missing scenes (`detectMissingScenes`)
- Detect weak marketing flow (`detectWeakMarketingFlow`)
- Report awareness (`getAiMeProductScenePlanningAwareness`)

Conversation terms include: `product scene plan`, `plan product scenes`, `marketing scene plan`, `explain product scenes`, `weak marketing flow`.

Storyboard and video generation remain **deferred**.

---

### 10. Issues found

1. No Step 3 runtime consumed prepared cutouts for marketing scene structure.
2. Pipeline jumped from asset-preparation → generic creative planning without product scene planning.
3. Conversation lacked a dedicated product scene planning intent.
4. Risk of inventing scenes unrelated to product evidence (mitigated by required-evidence gates).

---

### 11. Issues repaired

1. Created `ProductScenePlanningManager` consuming Step 1 profile + Step 2 asset library.
2. Inserted pipeline stage `scene-planning`.
3. Wired AI Me provider + HTTP APIs + offline knowledge domain bridge.
4. Auto-repair adds CTA/reveal, reorders flow, and reassigns assets when quality checks fail.
5. Unit + validate scripts added; all green.

---

### 12. Test results

**Unit test**

```
✓ plans a marketing scene sequence from product profile and prepared assets without storyboard/video
Tests 1 passed (1)
```

**Automatic validation** (`npm run validate:product-scene-planning`)

```
PASS sceneCompleteness
PASS sceneOrder
PASS marketingFlow
PASS productUsage
PASS cameraPlanning
PASS lightingPlanning
PASS aiMeCapability
PASS noStoryboardVideo
PASS healthCheck
Overall: PASS
```

---

### 13. Remaining work before Step 4

Step 4 (Storyboard & Marketing Script Generation) is implemented in `ai/product-storyboard/` and documented in `STORYBOARD-MARKETING-SCRIPT-REPORT.md`. Remaining follow-ons:

1. Optionally enrich storyboards with live Knowledge Foundation recommendations when KF is warm.
2. Surface storyboard/script review in desktop UI for manual approval.
3. Keep video generation deferred until later pipeline steps.
4. Proceed to Step 5 (Prompt & AI Model Orchestration) only when storyboards are approved.

**Step 3 verdict:** Product Scene Planning Engine is ready. It plans the complete visual marketing structure from real product assets and information without generating storyboards or videos.
