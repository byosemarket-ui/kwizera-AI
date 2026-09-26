import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CapabilityRuntime } from "../../../../ai/admin-control-plane/capability-runtime.js";
import {
  PmvWorkflowOrchestrator,
  WorkflowStartBlockedError,
  migrateRecord,
  type OrchestratorDeps,
  type StepExecutor,
  type WorkflowSnapshot,
} from "../../../../ai/pmv-orchestrator/engine.js";
import {
  createStepExecutors,
  loadWorkflowSnapshot,
  readProjectState,
  type ExecutorManagers,
} from "../../../../ai/pmv-orchestrator/executors.js";
import { classifyWorkflowError } from "../../../../ai/pmv-orchestrator/failure.js";
import { computeStepFingerprints, type FingerprintInputs } from "../../../../ai/pmv-orchestrator/fingerprints.js";
import { createModeReadinessProbe } from "../../../../ai/pmv-orchestrator/mode-readiness.js";
import { buildExecutionPlan, type PlanInput } from "../../../../ai/pmv-orchestrator/plan.js";
import { customerStepLabel, type WorkflowRecord, type WorkflowStepId } from "../../../../ai/pmv-orchestrator/types.js";
import { toAdminView, toCustomerSummary } from "../../../../ai/pmv-orchestrator/views.js";
import {
  DEFAULT_PMV_VIDEO_MODE,
  PMV_VIDEO_MODES,
  PMV_VIDEO_MODE_COPY,
  isPmvVideoMode,
  legacyGenerationMode,
  productionModeForVideoMode,
  resolveStoredVideoMode,
  type PmvVideoMode,
} from "../../../../ai/pmv-shared/modes.js";
import {
  PMV_CAPABILITY_SOURCE,
  PMV_MODE_REQUIREMENTS,
  allModeCapabilities,
  buildVideoModeExecutionPlan,
  listModeAvailability,
  resolveVideoMode,
  type CapabilityReadinessMap,
  type PmvModeCapability,
  type ProductionConfigurationInput,
} from "../../../../ai/pmv-shared/video-mode-resolver.js";
import { videoStyleOptions } from "../../../../desktop/customer-platform/workspace/pmv/view-model.js";

type AnyRecord = Record<string, unknown>;

const root = path.resolve(__dirname, "../../../..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

/** Readiness with the given capabilities executable and everything else not configured. */
function readinessMap(executable: PmvModeCapability[]): CapabilityReadinessMap {
  const map: CapabilityReadinessMap = {};
  for (const capability of allModeCapabilities()) {
    const ok = executable.includes(capability) && PMV_CAPABILITY_SOURCE[capability].kind !== "NOT_BUILT";
    map[capability] = { capability, state: ok ? "READY" : "NOT_CONFIGURED", executable: ok };
  }
  return map;
}

const BASELINE: PmvModeCapability[] = ["PRODUCT_INTELLIGENCE", "PRODUCT_IDENTITY_LOCK", "TEXT_RENDERING", "VIDEO_RENDERING", "QA", "AUDIO_INTELLIGENCE", "BEAT_SYNC"];
const EVERYTHING = allModeCapabilities();

function config(overrides: Partial<ProductionConfigurationInput> = {}): ProductionConfigurationInput {
  return {
    projectId: "p1",
    mode: "PRODUCT_SLIDESHOW",
    sourceAssetIds: ["img-1", "img-2"],
    heroAssetId: "img-1",
    identityLock: { version: "id-1", status: "LOCKED" },
    platform: "instagram",
    aspectRatio: "9:16",
    projectPlatform: null,
    durationSeconds: 15,
    audio: { selectedAudioAssetId: "song-1", beatSyncMode: "SMART", volume: 0.8 },
    voice: { narrationRequested: false },
    creativePlan: { id: "plan-1", version: 2 },
    creativeRequest: "",
    ...overrides,
  };
}

function planInput(videoMode: PmvVideoMode): PlanInput {
  return {
    projectId: "p1",
    videoMode,
    creativeRequest: "",
    heroWidth: 1600,
    heroHeight: 1600,
    editorAcceptsMask: false,
    musicGenerationRequested: false,
    estimatedSceneCount: 4,
    visionQaAvailable: false,
  };
}

function project(direction: AnyRecord = {}, pmv: AnyRecord = {}): AnyRecord {
  return {
    id: "p1",
    name: "Shoe",
    language: "en",
    platform: null,
    productImages: [{ id: "img-1", mimeType: "image/jpeg", fileName: "a.jpg", width: 1600, height: 1600 }],
    productInformation: { name: "Shoe" },
    brandInformation: { name: "Kwizera" },
    campaignInformation: { callToAction: "Shop now" },
    workspaceSettings: {
      productMarketingVideo: { heroAssetId: "img-1", platform: "tiktok", aspectRatio: "9:16", durationSeconds: 30, creativeDirection: direction, ...pmv },
    },
    selectedAudioAssetId: "song-7",
    beatSyncMode: "ON",
  };
}

function managers(p: AnyRecord, readiness?: CapabilityReadinessMap): ExecutorManagers {
  return {
    workspace: { getProject: async () => p as never, updateProject: async () => p as never } as never,
    planning: { getPlan: async () => null } as never,
    production: {} as never,
    intelligence: null,
    canonical: null,
    runtime: () => null,
    i2vAvailable: async () => false,
    ...(readiness ? { modeReadiness: async () => readiness } : {}),
  };
}

/** Minimal fake of the Admin manager / vault / adapter registry for CapabilityRuntime.readiness. */
function runtimeWith(opts: {
  status?: string;
  provider?: AnyRecord | null;
  hasSecret?: boolean;
  executableAdapter?: boolean;
}): CapabilityRuntime {
  const provider = opts.provider === undefined
    ? { id: "prov-1", type: "openai", enabled: true, healthStatus: "healthy" }
    : opts.provider;
  const manager = {
    resolveFeatureExecution: () => ({
      status: opts.status ?? "READY",
      selectedModel: { modelId: "m-1" },
      providerId: provider ? String(provider.id) : null,
      mapping: null,
      reason: "",
    }),
    getProviderRecord: () => provider,
  };
  const credentials = { has: () => opts.hasSecret ?? true };
  const adapters = { resolve: () => (opts.executableAdapter === false ? { id: "a" } : { id: "a", execute: async () => ({}) }) };
  return new CapabilityRuntime(manager as never, credentials as never, adapters as never);
}

describe("Phase 10 — 1. canonical mode validation", () => {
  it("accepts exactly the three canonical modes and rejects anything else", () => {
    expect(PMV_VIDEO_MODES).toEqual(["PRODUCT_SLIDESHOW", "PRODUCT_3D_SHOWCASE", "CINEMATIC_AI"]);
    for (const mode of PMV_VIDEO_MODES) expect(isPmvVideoMode(mode)).toBe(true);
    for (const bad of ["", "slideshow", "CINEMATIC", "EXACT_PRODUCT", "product_slideshow", null, undefined, 3, {}, ["PRODUCT_SLIDESHOW"]]) {
      expect(isPmvVideoMode(bad)).toBe(false);
    }
  });

  it("uses the customer copy from the specification", () => {
    expect(PMV_VIDEO_MODE_COPY.PRODUCT_SLIDESHOW).toEqual({ label: "Product Slideshow", description: "Turn your product photos into a polished promotional video." });
    expect(PMV_VIDEO_MODE_COPY.PRODUCT_3D_SHOWCASE).toEqual({ label: "3D Product Showcase", description: "Present your product with a 3D/360-style visual experience." });
    expect(PMV_VIDEO_MODE_COPY.CINEMATIC_AI).toEqual({ label: "Cinematic AI Advertisement", description: "Create cinematic AI-generated product scenes." });
  });
});

describe("Phase 10 — 2. serialization", () => {
  it("round-trips through JSON as a plain string in the existing creative direction", () => {
    for (const mode of PMV_VIDEO_MODES) {
      const stored = JSON.parse(JSON.stringify({ videoMode: mode, generationMode: legacyGenerationMode(mode) ?? "EXACT_PRODUCT" }));
      expect(resolveStoredVideoMode(stored)).toBe(mode);
    }
  });

  it("an explicit videoMode always wins over the legacy field", () => {
    expect(resolveStoredVideoMode({ videoMode: "PRODUCT_3D_SHOWCASE", generationMode: "EXACT_PRODUCT" })).toBe("PRODUCT_3D_SHOWCASE");
    expect(resolveStoredVideoMode({ videoMode: "PRODUCT_SLIDESHOW", generationMode: "CINEMATIC" })).toBe("PRODUCT_SLIDESHOW");
  });
});

describe("Phase 10 — 3. legacy compatibility", () => {
  it("maps pre-Phase-10 projects deterministically", () => {
    expect(resolveStoredVideoMode(undefined)).toBe(DEFAULT_PMV_VIDEO_MODE);
    expect(resolveStoredVideoMode({})).toBe("PRODUCT_SLIDESHOW");
    expect(resolveStoredVideoMode({ generationMode: "EXACT_PRODUCT" })).toBe("PRODUCT_SLIDESHOW");
    expect(resolveStoredVideoMode({ generationMode: "ADVANCED_CREATIVE" })).toBe("PRODUCT_SLIDESHOW");
    expect(resolveStoredVideoMode({ generationMode: "CINEMATIC" })).toBe("CINEMATIC_AI");
    expect(resolveStoredVideoMode({ videoMode: "bogus", generationMode: "CINEMATIC" })).toBe("CINEMATIC_AI");
  });

  it("loads a saved legacy project and a legacy workflow record without migration", () => {
    expect(readProjectState(project({ generationMode: "CINEMATIC" }) as never).videoMode).toBe("CINEMATIC_AI");
    expect(readProjectState(project({}) as never).videoMode).toBe("PRODUCT_SLIDESHOW");
    const legacy = migrateRecord({ generationMode: "CINEMATIC", steps: [], plan: {} } as unknown as WorkflowRecord);
    expect(legacy.videoMode).toBe("CINEMATIC_AI");
    expect(legacy.modePlan).toBeNull();
    expect(migrateRecord({ steps: [], plan: {} } as unknown as WorkflowRecord).videoMode).toBe("PRODUCT_SLIDESHOW");
  });

  it("keeps legacy fingerprints stable so existing projects are not re-planned", () => {
    const src = read("ai/pmv-orchestrator/executors.ts");
    expect(src).toContain("mode: legacyGenerationMode(s.videoMode) ?? s.videoMode");
    expect(legacyGenerationMode("PRODUCT_SLIDESHOW")).toBe("EXACT_PRODUCT");
    expect(legacyGenerationMode("CINEMATIC_AI")).toBe("CINEMATIC");
    expect(legacyGenerationMode("PRODUCT_3D_SHOWCASE")).toBeNull();
  });
});

describe("Phase 10 — 4. availability", () => {
  it("slideshow is ready on the internal baseline; cinematic needs creative reasoning and image-to-video; 3D is coming soon", () => {
    const base = Object.fromEntries(listModeAvailability(readinessMap(BASELINE)).map((m) => [m.mode, m.availability]));
    expect(base).toEqual({ PRODUCT_SLIDESHOW: "READY", PRODUCT_3D_SHOWCASE: "COMING_SOON", CINEMATIC_AI: "UNAVAILABLE" });
    const all = Object.fromEntries(listModeAvailability(readinessMap(EVERYTHING)).map((m) => [m.mode, m.availability]));
    expect(all).toEqual({ PRODUCT_SLIDESHOW: "READY", PRODUCT_3D_SHOWCASE: "COMING_SOON", CINEMATIC_AI: "READY" });
  });

  it("an empty readiness answer makes nothing available", () => {
    expect(listModeAvailability({}).every((m) => !m.selectable)).toBe(true);
  });
});

describe("Phase 10 — 5. executable readiness (not just mapped)", () => {
  it("reports READY only for an enabled, credentialed, executable and healthy provider", () => {
    expect(runtimeWith({}).readiness("VIDEO_IMAGE_TO_VIDEO")).toEqual({ feature: "VIDEO_IMAGE_TO_VIDEO", state: "READY", executable: true });
  });

  it("distinguishes every non-executable cause", () => {
    const cases: Array<[Parameters<typeof runtimeWith>[0], string]> = [
      [{ status: "NOT_CONFIGURED" }, "NOT_CONFIGURED"],
      [{ provider: null }, "NOT_CONFIGURED"],
      [{ provider: { id: "p", type: "openai", enabled: false, healthStatus: "healthy" } }, "DISABLED"],
      [{ executableAdapter: false }, "NOT_IMPLEMENTED"],
      [{ hasSecret: false }, "CREDENTIAL_MISSING"],
      [{ provider: { id: "p", type: "openai", enabled: true, healthStatus: "unhealthy" } }, "AUTH_FAILED"],
      [{ provider: { id: "p", type: "openai", enabled: true, healthStatus: "degraded" } }, "PROVIDER_ERROR"],
      [{ provider: { id: "p", type: "openai", enabled: true, healthStatus: "unchecked" } }, "UNVERIFIED"],
    ];
    for (const [opts, state] of cases) {
      const r = runtimeWith(opts).readiness("VIDEO_IMAGE_TO_VIDEO");
      expect(r.state, JSON.stringify(opts)).toBe(state);
      expect(r.executable).toBe(false);
    }
  });

  it("the mode probe reuses CapabilityRuntime readiness and the render pipeline check", async () => {
    const probe = (pipeline: boolean, renderer = true) => createModeReadinessProbe({
      runtime: () => runtimeWith({}),
      rendererAvailable: async () => renderer,
      productIntelligenceAvailable: () => true,
      imageToVideoPipelineReady: async () => pipeline,
    })();
    const ok = await probe(true);
    expect(ok.VIDEO_IMAGE_TO_VIDEO?.executable).toBe(true);
    expect(ok.PRODUCT_3D_GENERATION).toMatchObject({ state: "NOT_BUILT", executable: false });
    expect((await probe(false)).VIDEO_IMAGE_TO_VIDEO).toMatchObject({ state: "NOT_IMPLEMENTED", executable: false });
    expect((await probe(true, false)).VIDEO_RENDERING?.executable).toBe(false);
    const noAdmin = await createModeReadinessProbe({
      runtime: () => null,
      rendererAvailable: async () => true,
      productIntelligenceAvailable: () => true,
      imageToVideoPipelineReady: async () => true,
    })();
    expect(noAdmin.CREATIVE_REASONING).toMatchObject({ state: "NOT_CONFIGURED", executable: false });
  });

  it("there is one health system: the probe never probes providers itself", () => {
    const src = read("ai/pmv-orchestrator/mode-readiness.ts");
    expect(src).toContain("runtime.readiness(");
    expect(src).not.toMatch(/healthCheckProvider|fetch\(|probeHealth/);
  });
});

describe("Phase 10 — 6. requirements", () => {
  it("follows the per-mode requirement table", () => {
    expect(PMV_MODE_REQUIREMENTS.PRODUCT_SLIDESHOW.required).toEqual(["PRODUCT_INTELLIGENCE", "TEXT_RENDERING", "VIDEO_RENDERING", "QA"]);
    expect(PMV_MODE_REQUIREMENTS.PRODUCT_3D_SHOWCASE.required).toEqual(expect.arrayContaining(["PRODUCT_3D_GENERATION", "PRODUCT_IDENTITY_LOCK", "VIDEO_RENDERING", "QA"]));
    expect(PMV_MODE_REQUIREMENTS.CINEMATIC_AI.required).toEqual(expect.arrayContaining(["CREATIVE_REASONING", "VIDEO_IMAGE_TO_VIDEO", "PRODUCT_IDENTITY_LOCK", "VIDEO_RENDERING", "QA"]));
  });

  it("slideshow never requires or allows image-to-video or 3D", () => {
    const all = [...PMV_MODE_REQUIREMENTS.PRODUCT_SLIDESHOW.required, ...PMV_MODE_REQUIREMENTS.PRODUCT_SLIDESHOW.optional];
    expect(all).not.toContain("VIDEO_IMAGE_TO_VIDEO");
    expect(all).not.toContain("PRODUCT_3D_GENERATION");
  });

  it("3D generation is not built, so no Admin mapping can make it ready", () => {
    expect(PMV_CAPABILITY_SOURCE.PRODUCT_3D_GENERATION.kind).toBe("NOT_BUILT");
    const forced = { PRODUCT_3D_GENERATION: { capability: "PRODUCT_3D_GENERATION", state: "READY", executable: true } } as CapabilityReadinessMap;
    expect(resolveVideoMode("PRODUCT_3D_SHOWCASE", { ...readinessMap(EVERYTHING), ...forced }).availability).toBe("COMING_SOON");
  });
});

describe("Phase 10 — 7. resolver", () => {
  it("returns the route without executing anything", () => {
    const slideshow = resolveVideoMode("PRODUCT_SLIDESHOW", readinessMap(BASELINE));
    expect(slideshow).toMatchObject({
      availability: "READY", sceneStrategy: "SLIDESHOW_STILLS", renderEngine: "AI_PRODUCT_MOTION",
      fallbackPolicy: "DETERMINISTIC_BASELINE", unavailableCapabilities: [], customerMessage: null,
    });
    const cinematic = resolveVideoMode("CINEMATIC_AI", readinessMap(BASELINE));
    expect(cinematic).toMatchObject({ availability: "UNAVAILABLE", sceneStrategy: "GENERATIVE_IMAGE_TO_VIDEO", renderEngine: "CINEMATIC_3D", fallbackPolicy: "NO_SILENT_FALLBACK" });
    expect(cinematic.unavailableCapabilities).toEqual(["CREATIVE_REASONING", "VIDEO_IMAGE_TO_VIDEO"]);
    const threeD = resolveVideoMode("PRODUCT_3D_SHOWCASE", readinessMap(EVERYTHING));
    expect(threeD).toMatchObject({ availability: "COMING_SOON", sceneStrategy: "THREE_D_ASSET", renderEngine: null });
  });

  it("only executable optional capabilities are enabled", () => {
    const r = resolveVideoMode("PRODUCT_SLIDESHOW", readinessMap([...BASELINE, "CREATIVE_REASONING"]));
    expect(r.enabledOptionalCapabilities).toContain("CREATIVE_REASONING");
    expect(r.enabledOptionalCapabilities).not.toContain("TEXT_TO_SPEECH");
  });

  it("is a single pure resolver with no provider or network access", () => {
    const src = read("ai/pmv-shared/video-mode-resolver.ts");
    expect(src).not.toMatch(/fetch\(|import .*admin-control-plane|process\.env|openai|fal\.|replicate|anthropic|qwen/i);
  });
});

describe("Phase 10 — 8. execution plan", () => {
  it("one plan shape for all modes carrying the production configuration", () => {
    for (const mode of PMV_VIDEO_MODES) {
      const plan = buildVideoModeExecutionPlan(config({ mode }), readinessMap(EVERYTHING));
      expect(Object.keys(plan).sort()).toEqual([
        "audio", "audioStrategy", "availability", "capabilityReadiness", "creativePlan", "customerMessage", "duration",
        "fallbackPolicy", "mode", "optionalCapabilities", "output", "platform", "productIdentityLock", "productProjectId",
        "projectId", "qaStrategy", "renderStrategy", "requiredCapabilities", "sceneStrategy", "sourceAssets", "timelineStrategy", "voice",
      ].sort());
      expect(plan.timelineStrategy).toBe("SHARED_TIMELINE");
      expect(plan.productIdentityLock).toEqual({ version: "id-1", status: "LOCKED", enforced: true });
      expect(plan.sourceAssets).toEqual({ assetIds: ["img-1", "img-2"], heroAssetId: "img-1" });
      expect(plan.creativePlan).toEqual({ id: "plan-1", version: 2 });
    }
  });

  it("only cinematic is generative; slideshow renders stills through the deterministic engine", () => {
    const slideshow = buildVideoModeExecutionPlan(config(), readinessMap(EVERYTHING));
    expect(slideshow.renderStrategy).toEqual({ engine: "AI_PRODUCT_MOTION", generative: false });
    const cinematic = buildVideoModeExecutionPlan(config({ mode: "CINEMATIC_AI" }), readinessMap(EVERYTHING));
    expect(cinematic.renderStrategy).toEqual({ engine: "CINEMATIC_3D", generative: true });
  });
});

describe("Phase 10 — 9. mode reaches the backend request and plan", () => {
  it("the saved mode drives the snapshot, orchestration plan and mode route", async () => {
    const p = project({ videoMode: "CINEMATIC_AI", generationMode: "CINEMATIC" });
    const snapshot = await loadWorkflowSnapshot(managers(p, readinessMap(EVERYTHING)), "p1");
    expect(snapshot.planInput.videoMode).toBe("CINEMATIC_AI");
    expect(snapshot.modePlan).toMatchObject({ mode: "CINEMATIC_AI", sceneStrategy: "GENERATIVE_IMAGE_TO_VIDEO", availability: "READY" });
    expect(buildExecutionPlan(snapshot.planInput).steps.map((s) => s.id)).toContain("VIDEO_GENERATION");
  });

  it("slideshow plans never include image-to-video or 3D steps", () => {
    const ids = buildExecutionPlan(planInput("PRODUCT_SLIDESHOW")).steps.map((s) => s.id);
    expect(ids).not.toContain("VIDEO_GENERATION");
    expect(ids).not.toContain("MEDIA_PREPARATION");
    expect(ids).not.toContain("PRODUCT_3D_GENERATION");
    const threeD = buildExecutionPlan(planInput("PRODUCT_3D_SHOWCASE"));
    expect(threeD.mode).toBe("THREE_D");
    expect(threeD.steps.map((s) => s.id)).toContain("PRODUCT_3D_GENERATION");
    expect(threeD.steps.map((s) => s.id)).not.toContain("VIDEO_GENERATION");
  });

  it("the existing PMV workflow endpoint validates an optional mode against the saved one", () => {
    const server = read("dev/server/index.ts");
    expect(server).toContain('"INVALID_VIDEO_MODE"');
    expect(server).toContain('"VIDEO_MODE_MISMATCH"');
    expect(server).toContain("readProjectState(");
    expect(server).toMatch(/instanceof WorkflowStartBlockedError[\s\S]{0,80}sendJson\(res, 409/);
    expect(server).toContain('url.pathname === "/api/pmv/video-modes"');
    const client = read("desktop/pmv-workflow/usePmvWorkflow.ts");
    expect(client).toContain("productSetupEngine.snapshot().creativeDirection.videoMode");
  });
});

describe("Phase 10 — 10/11/12. platform, duration and audio flow through the plan", () => {
  it("platform and output format come from the saved destination", () => {
    const plan = buildVideoModeExecutionPlan(config({ platform: "youtube", aspectRatio: "16:9" }), readinessMap(BASELINE));
    expect(plan.platform).toBe("youtube");
    expect(plan.output).toMatchObject({ aspectRatio: "16:9", formatAdjusted: false });
    expect(plan.output.width).toBeGreaterThan(plan.output.height);
  });

  it("duration is validated per mode and budgets scenes", () => {
    const ok = buildVideoModeExecutionPlan(config({ durationSeconds: 30 }), readinessMap(BASELINE));
    expect(ok.duration).toMatchObject({ totalSeconds: 30, problem: null });
    expect(ok.duration.sceneBudgetSeconds).toBeLessThanOrEqual(30);
    const tooLong = buildVideoModeExecutionPlan(config({ platform: "tiktok", durationSeconds: 60 * 60 * 3 }), readinessMap(BASELINE));
    expect(tooLong.duration.problem).toBeTruthy();
  });

  it("audio is carried, never invented", () => {
    const withTrack = buildVideoModeExecutionPlan(config(), readinessMap(EVERYTHING));
    expect(withTrack.audio).toEqual({ selectedAudioAssetId: "song-1", beatSync: "SMART", volume: 0.8, musicGeneration: false });
    expect(withTrack.audioStrategy).toBe("SELECTED_TRACK");
    const none = buildVideoModeExecutionPlan(config({ audio: { selectedAudioAssetId: null, beatSyncMode: "ON", volume: null } }), readinessMap(EVERYTHING));
    expect(none.audio.beatSync).toBe("OFF");
    expect(none.audioStrategy).toBe("NO_MUSIC");
    const voice = buildVideoModeExecutionPlan(config({ voice: { narrationRequested: true } }), readinessMap(BASELINE));
    expect(voice.voice.narration).toBe(false);
  });

  it("the saved project configuration reaches the mode plan unchanged", async () => {
    const snapshot = await loadWorkflowSnapshot(managers(project({ videoMode: "PRODUCT_SLIDESHOW" }), readinessMap(BASELINE)), "p1");
    expect(snapshot.modePlan).toMatchObject({
      platform: "tiktok",
      duration: { totalSeconds: 30 },
      audio: { selectedAudioAssetId: "song-7", beatSync: "ON" },
    });
  });
});

describe("Phase 10 — 13. mode-aware progress", () => {
  it("labels follow the selected mode and only list stages that exist", () => {
    expect(customerStepLabel("CREATIVE_PLANNING", "PRODUCT_SLIDESHOW")).toBe("Planning slideshow");
    expect(customerStepLabel("CREATIVE_PLANNING", "CINEMATIC_AI")).toBe("Planning cinematic scenes");
    expect(customerStepLabel("CREATIVE_PLANNING", "PRODUCT_3D_SHOWCASE")).toBe("Preparing 3D production");
    expect(customerStepLabel("PRODUCT_3D_GENERATION", "PRODUCT_3D_SHOWCASE")).toBe("3D generation");
    expect(customerStepLabel("TIMELINE", "PRODUCT_3D_SHOWCASE")).toBe("Building scene");
    expect(customerStepLabel("VIDEO_GENERATION", "CINEMATIC_AI")).toBe("Generating scenes");
    expect(customerStepLabel("TIMELINE", "PRODUCT_SLIDESHOW")).toBe("Building timeline");
  });
});

describe("Phase 10 — 14. mode switching", () => {
  function fp(mode: string) {
    const input: FingerprintInputs = {
      assetFingerprint: "a", lockVersion: "id-1", lockStatus: "LOCKED", mode, creativeTone: "Modern", durationSeconds: 15,
      aspectRatio: "9:16", creativeRequest: "", text: { brandName: "K", cta: "Buy", website: "", phone: "", logoAssetId: null, language: "en" },
      audio: { selectedAudioAssetId: "song-1", beatSyncMode: "SMART", audioVolume: 0.8 }, planId: "plan-1", planVersion: 1,
    };
    return computeStepFingerprints(input);
  }

  it("invalidates only mode-derived work; product, lock and audio work is preserved", () => {
    const before = fp("EXACT_PRODUCT");
    const after = fp("CINEMATIC");
    for (const id of ["PRODUCT_INTELLIGENCE", "PRODUCT_LOCK", "AUDIO"] as WorkflowStepId[]) expect(after[id]).toBe(before[id]);
    expect(after.CREATIVE_PLANNING).not.toBe(before.CREATIVE_PLANNING);
  });

  it("the Studio switch keeps product, photos, brand, platform, duration and audio", () => {
    const src = read("desktop/product-setup/product-setup-engine.ts");
    const setter = src.slice(src.indexOf("private applyVideoMode"), src.indexOf("async refreshVideoModes"));
    expect(setter).toContain("videoMode: mode");
    expect(setter).not.toMatch(/videoSettings|imageCards|essentials|selectedAudioAssetId|heroAssetId/);
    expect(src).toContain('this.setCreativeDirectionField("videoMode", mode)');
  });
});

describe("Phase 10 — 15. unavailable modes are rejected by the backend", () => {
  async function orchestratorFor(modePlan: WorkflowSnapshot["modePlan"], videoMode: PmvVideoMode) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-p10-"));
    roots.push(dir);
    const o = new PmvWorkflowOrchestrator();
    const deps: OrchestratorDeps = {
      loadSnapshot: async () => ({ fingerprints: fp(), planInput: planInput(videoMode), modePlan }),
      executors: {},
      writeProjectSummary: async () => undefined,
      sleep: async () => undefined,
      log: () => undefined,
    };
    await o.initialize(dir, deps);
    return o;
  }
  function fp() {
    return computeStepFingerprints({
      assetFingerprint: "a", lockVersion: null, lockStatus: null, mode: "EXACT_PRODUCT", creativeTone: "Modern", durationSeconds: 15,
      aspectRatio: "9:16", creativeRequest: "", text: { brandName: "", cta: "", website: "", phone: "", logoAssetId: null, language: "" },
      audio: { selectedAudioAssetId: null, beatSyncMode: "SMART", audioVolume: null }, planId: null, planVersion: null,
    });
  }

  it("refuses to start cinematic when it is not executable, with a customer-safe reason", async () => {
    const plan = buildVideoModeExecutionPlan(config({ mode: "CINEMATIC_AI" }), readinessMap(BASELINE));
    const o = await orchestratorFor(plan, "CINEMATIC_AI");
    const error = await o.start("p1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WorkflowStartBlockedError);
    expect(error).toMatchObject({ code: "MODE_UNAVAILABLE", customerMessage: "Cinematic AI Advertisement is not available yet. Choose another video style." });
    expect(o.getLatest("p1")).toBeNull();
  });

  it("refuses 3D (coming soon) and unsupported durations", async () => {
    const threeD = await orchestratorFor(buildVideoModeExecutionPlan(config({ mode: "PRODUCT_3D_SHOWCASE" }), readinessMap(EVERYTHING)), "PRODUCT_3D_SHOWCASE");
    expect(await threeD.start("p1").catch((e: unknown) => e)).toMatchObject({ code: "MODE_UNAVAILABLE", customerMessage: "3D Product Showcase is coming soon." });
    const long = await orchestratorFor(buildVideoModeExecutionPlan(config({ durationSeconds: 60 * 60 * 3 }), readinessMap(BASELINE)), "PRODUCT_SLIDESHOW");
    expect(await long.start("p1").catch((e: unknown) => e)).toMatchObject({ code: "DURATION_NOT_SUPPORTED" });
  });
});

describe("Phase 10 — 16/17. no direct provider calls, no credential exposure", () => {
  const files = [
    "ai/pmv-shared/modes.ts",
    "ai/pmv-shared/video-mode-resolver.ts",
    "ai/pmv-orchestrator/mode-readiness.ts",
    "desktop/customer-platform/workspace/pmv/view-model.ts",
    "desktop/customer-platform/workspace/pmv/PmvStyleStep.tsx",
    "desktop/pmv-workflow/api.ts",
  ];

  it("mode code never calls or names providers", () => {
    for (const file of files) {
      const src = read(file);
      expect(src, file).not.toMatch(/fetch\(\s*["'`]https?:/);
      expect(src, file).not.toMatch(/openai|anthropic|googleapis|gemini|dashscope|qwen|fal\.ai|fal-ai|replicate/i);
    }
  });

  it("customer availability carries only labels and states", () => {
    const modes = listModeAvailability(readinessMap(EVERYTHING));
    for (const m of modes) expect(Object.keys(m).sort()).toEqual(["availability", "description", "label", "mode", "note", "selectable"]);
    expect(JSON.stringify(modes)).not.toMatch(/VIDEO_IMAGE_TO_VIDEO|CREATIVE_REASONING|provider|model|credential|key|cost|health/i);
  });

  it("the customer workflow summary carries the mode but no route internals", () => {
    const plan = buildExecutionPlan(planInput("CINEMATIC_AI"));
    const record = migrateRecord({
      id: "wf", projectId: "p1", mode: plan.mode, videoMode: "CINEMATIC_AI", generationMode: "CINEMATIC", plan,
      modePlan: buildVideoModeExecutionPlan(config({ mode: "CINEMATIC_AI" }), readinessMap(EVERYTHING)),
      steps: plan.steps.map((s) => ({ ...s, status: "PENDING", inputFingerprint: null, attempts: 0, maxAttempts: 3, history: [], failure: null, artifactRefs: {}, startedAt: null, completedAt: null })),
      status: "QUEUED", currentStep: null, createdAt: "t", updatedAt: "t",
    } as unknown as WorkflowRecord);
    const text = JSON.stringify(toCustomerSummary(record));
    expect(text).toContain('"videoMode":"CINEMATIC_AI"');
    expect(text).not.toMatch(/capabilityReadiness|sceneStrategy|VIDEO_IMAGE_TO_VIDEO|NO_SILENT_FALLBACK|providerId|modelId/);
    expect(toAdminView(record).modeRoute).toMatchObject({ sceneStrategy: "GENERATIVE_IMAGE_TO_VIDEO", fallbackPolicy: "NO_SILENT_FALLBACK" });
  });
});

describe("Phase 10 — 18. no fake fallback", () => {
  it("3D never runs a fake generator", async () => {
    const executors = createStepExecutors(managers(project({ videoMode: "PRODUCT_3D_SHOWCASE" })));
    const step = executors.PRODUCT_3D_GENERATION as StepExecutor;
    const error = await step({} as never).catch((e: unknown) => e);
    expect(classifyWorkflowError(error, "PRODUCT_3D_GENERATION")).toMatchObject({ failureClass: "CONFIGURATION_ERROR", code: "THREE_D_UNAVAILABLE", retryable: false });
  });

  it("cinematic is never replaced by slideshow or a stills render", () => {
    const engine = read("desktop/product-setup/product-setup-engine.ts");
    expect(engine).not.toMatch(/Using Exact Product mode instead|generationMode: "EXACT_PRODUCT",\s*\};\s*this\.creativeError/);
    expect(engine).toContain("an unavailable mode is refused, not replaced");
    const manager = read("ai/video-production/video-production-manager.ts");
    expect(manager).toMatch(/renderProfile\.mode === "CINEMATIC_3D" && !renderProfile\.usesGenerativeVideo[\s\S]{0,80}"I2V_UNAVAILABLE"/);
    expect(productionModeForVideoMode("PRODUCT_3D_SHOWCASE")).toBeNull();
  });

  it("the render layer's image-to-video flag follows executable readiness, not mapping", () => {
    const bootstrap = read("ai/pmv-orchestrator/bootstrap.ts");
    expect(bootstrap).toContain("setAdminOnlineImageToVideoAvailable(Boolean(map.VIDEO_IMAGE_TO_VIDEO?.executable))");
    const server = read("dev/server/index.ts");
    expect(server).toContain('readiness("VIDEO_IMAGE_TO_VIDEO").executable');
  });
});

describe("Phase 10 — 19/20. lineage and versioning", () => {
  it("delivery and QA record the mode and configuration that produced the asset", () => {
    const src = read("ai/pmv-orchestrator/executors.ts");
    const delivery = src.slice(src.indexOf("const DELIVERY: StepExecutor"));
    for (const field of ["videoMode: s.videoMode", "platform: s.platform", "aspectRatio: s.aspectRatio"]) expect(delivery).toContain(field);
    expect(src).toContain("qaSummary(qa, s.videoMode)");
  });

  it("each regeneration is a new workflow version linked to the previous run", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-p10-lineage-"));
    roots.push(dir);
    const done: StepExecutor = async (ctx) => ctx.step.id === "DELIVERY"
      ? { kind: "COMPLETED", delivery: { outputAssetId: "v", renderJobId: "j", creativePlanId: null, creativePlanVersion: null, identityLockVersion: null, sourceAssetIds: [], qaCheckedAt: "t", deliveredAt: "t" } }
      : ctx.step.id === "QA"
        ? { kind: "COMPLETED", qa: { overallStatus: "QA_PASSED", renderJobId: "j", videoAssetId: "v", failures: [], checkedAt: "t", expectedMode: "PRODUCT_SLIDESHOW" } }
        : { kind: "COMPLETED" };
    const ids: WorkflowStepId[] = ["PRODUCT_INTELLIGENCE", "PRODUCT_LOCK", "CREATIVE_PLANNING", "AUDIO", "TIMELINE", "RENDER", "QA", "REPAIR", "DELIVERY"];
    const o = new PmvWorkflowOrchestrator();
    await o.initialize(dir, {
      loadSnapshot: async () => ({
        fingerprints: computeStepFingerprints({
          assetFingerprint: "a", lockVersion: null, lockStatus: null, mode: "EXACT_PRODUCT", creativeTone: "Modern", durationSeconds: 15,
          aspectRatio: "9:16", creativeRequest: "", text: { brandName: "", cta: "", website: "", phone: "", logoAssetId: null, language: "" },
          audio: { selectedAudioAssetId: null, beatSyncMode: "SMART", audioVolume: null }, planId: null, planVersion: null,
        }),
        planInput: planInput("PRODUCT_SLIDESHOW"),
        modePlan: buildVideoModeExecutionPlan(config(), readinessMap(BASELINE)),
      }),
      executors: Object.fromEntries(ids.map((id) => [id, done])),
      writeProjectSummary: async () => undefined,
      sleep: async () => undefined,
      log: () => undefined,
    });
    const first = await o.start("p1");
    await o.whenIdle();
    const second = await o.start("p1");
    await o.whenIdle();
    expect(o.get(first.id)!.status).toBe("COMPLETED");
    expect(second.id).not.toBe(first.id);
    expect(o.get(second.id)!.previousWorkflowId).toBe(first.id);
    expect(o.get(second.id)!.videoMode).toBe("PRODUCT_SLIDESHOW");
    expect(o.get(second.id)!.modePlan?.qaStrategy.expectedMode).toBe("PRODUCT_SLIDESHOW");
    expect(o.get(first.id)!.delivery).not.toBeNull();
  });
});

describe("Phase 10 — 21/22. customer-safe availability and errors", () => {
  it("cards show plain notes and never mark an unready mode selectable", () => {
    const cards = videoStyleOptions(listModeAvailability(readinessMap(BASELINE)));
    expect(cards.map((c) => [c.id, c.availability, c.note])).toEqual([
      ["PRODUCT_SLIDESHOW", "available", null],
      ["PRODUCT_3D_SHOWCASE", "coming_soon", "Coming soon"],
      ["CINEMATIC_AI", "unavailable", "Not available yet"],
    ]);
  });

  it("customer-facing mode errors contain no internal vocabulary", () => {
    const internal = /[A-Z]{2,}_[A-Z]|provider|model|capability|credential|api key|admin|fal|openai|health|ffmpeg|i2v/i;
    for (const mode of PMV_VIDEO_MODES) {
      const message = resolveVideoMode(mode, {}).customerMessage;
      if (message) expect(message).not.toMatch(internal);
    }
    const src = read("ai/pmv-orchestrator/executors.ts");
    expect(src).toContain('"3D Product Showcase is coming soon. Choose another video style."');
    const failure = read("ai/pmv-orchestrator/failure.ts");
    expect(failure).toContain("This video style is unavailable right now. Choose Product Slideshow or try again later.");
    const server = read("dev/server/index.ts");
    expect(server).toContain('"Choose a valid video style."');
  });
});
