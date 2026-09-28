import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PersistentMemoryCenter } from "../../../../dev/server/persistent-memory-center.js";
import { KnowledgePipeline, adaptKnowledgeStorageEngine } from "../../../../ai/knowledge-acquisition-engine/knowledge-pipeline.js";
import { ensureCoreKnowledge } from "../../../../ai/knowledge-acquisition-engine/kwizera-core-knowledge.js";
import { TrainingCenter } from "../../../../ai/training-center/training-center.js";
import type { AudioMeasurement, CapabilityAvailability, KnowledgeRecord, MediaAnalysis } from "../../../../ai/training-center/training-types.js";
import type { TeachingMediaAnalyzer } from "../../../../ai/training-center/teaching-media.js";
import type { DeepMediaAnalyzer, ImageDeepAnalysis, SceneMeasurement, VideoDeepAnalysis } from "../../../../ai/training-center/teaching-deep-media.js";
import { buildObservations, classifyCamera, type SceneExtras } from "../../../../ai/training-center/video-observations.js";
import { buildCreativeProfile, extractAudioPatterns, extractImagePatterns, loudnessLevel } from "../../../../ai/training-center/creative-patterns.js";
import { assessNovelty, contextualVariation, enrichesStatement, patternSignature } from "../../../../ai/training-center/knowledge-novelty.js";
import {
  RUNTIME_PATTERN_QUERIES, learnedBeatAlignment, learnedMusicGuidance, learnedTypographyLayout, selectCreativePatterns, type ActiveCreativePattern,
} from "../../../../ai/creative-planning/learned-creative-patterns.js";
import { AUDIO_INTELLIGENCE_VERSION, type AudioTimingIntelligence } from "../../../../ai/audio-intelligence/types.js";
import { applyBeatSyncTiming } from "../../../../ai/video-production/beat-sync-timing.js";
import type { VideoTimelineClip } from "../../../../ai/video-production/types.js";
import { choosePlacement } from "../../../../ai/typography/placement.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

// ---------- controlled fixtures ----------

const W = 64;
const H = 48;
const beats = Array.from({ length: 24 }, (_, i) => i * 0.5);
const AUDIO: AudioMeasurement = {
  durationSec: 12, sampleRate: 44_100, channels: 2, codec: "aac", bpm: 120, tempoConfidence: 0.9, tempoStatus: "available",
  beatCount: 24, downbeatCount: 6, firstBeats: beats.slice(0, 8), beatTimes: beats, downbeatTimes: beats.filter((_, i) => i % 4 === 0),
  sections: [{ label: "INTRO", start: 0, end: 4 }, { label: "DROP", start: 4, end: 12 }],
  energyTimeline: [{ start: 0, end: 4, energy: 0.3 }, { start: 4, end: 12, energy: 0.8 }], energyTransitions: [{ time: 4, type: "ENERGY_RISE" }],
  silences: [], fadeInSec: null, fadeOutSec: null, rmsDbfs: -14, peakDbfs: -1, clippedRatio: 0, silent: false,
};

function scene(index: number, start: number, end: number, extra: Partial<SceneMeasurement> = {}): SceneMeasurement {
  return {
    index, start, end, durationSec: end - start, motion: 0.02, motionClass: "STATIC", subjectCoverage: 0.2,
    subjectCenterX: 0.5, framingChange: "STABLE", horizontalDrift: null, meanLuma: 120, contrast: 0.4,
    transitionIn: index === 1 ? "START" : "CUT", onBeat: index === 1 ? null : true, energy: index === 1 ? 0.3 : 0.8, vision: null, ...extra,
  };
}
const subject = (coverage: number) => ({
  separable: true, coverage, box: { left: 0.3, top: 0.3, right: 0.7, bottom: 0.8 }, margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.2 },
  centerX: 0.5, centerY: 0.55, touchesEdge: false,
});
const STATIC_CAM = classifyCamera(Array.from({ length: 6 }, () => ({ dx: 0, dy: 0, scale: 1, gain: 0 })), 4, W, H);
const PUSH_CAM = classifyCamera(Array.from({ length: 6 }, () => ({ dx: 0, dy: 0, scale: 1.06, gain: 0.7 })), 4, W, H);
const DISSOLVE = { type: "DISSOLVE" as const, durationSec: 0.5, confidence: 0.85, method: "dense sampling", evidence: "8 frames are blends of both shots." };
const FADE_BLACK = { type: "FADE_THROUGH_BLACK" as const, durationSec: 0.6, confidence: 0.85, method: "dense sampling", evidence: "Frames dip to black between shots." };
const CUT = { type: "CUT" as const, durationSec: 0, confidence: 0.85, method: "dense sampling", evidence: "No mixed frames." };
const noText = { presence: "NOT_DETECTED" as const, method: "edge-density bands", regions: [], seenAtSec: [], readable: false as const };
const textBand = { presence: "DETECTED" as const, method: "edge-density bands", regions: [{ x0: 0.1, y0: 0.82, x1: 0.9, y1: 0.9, label: "bottom text-like band" }], seenAtSec: [8.5], readable: false as const };

const SCENES = [scene(1, 0, 4), scene(2, 4, 8, { subjectCoverage: 0.4 }), scene(3, 8, 12)];
const extras = (reveal: SceneExtras["transition"]): SceneExtras[] => [
  { camera: STATIC_CAM, transition: null, keySubject: subject(0.2), text: noText },
  { camera: PUSH_CAM, transition: reveal, keySubject: subject(0.4), text: noText },
  { camera: STATIC_CAM, transition: CUT, keySubject: subject(0.2), text: textBand },
];

const IMAGE_DEEP: ImageDeepAnalysis = {
  width: 1080, height: 1920, meanLuma: 180, contrast: 0.5, dynamicRange: 0.8,
  subject: { separable: true, coverage: 0.22, box: { left: 0.05, top: 0.3, right: 0.45, bottom: 0.75 }, margins: { left: 0.05, right: 0.55, top: 0.3, bottom: 0.25 }, centerX: 0.25, centerY: 0.52, touchesEdge: false },
  whitespaceShare: 0.48, balance: { horizontal: -0.3, vertical: 0 }, dominantColors: [{ hex: "#f4f1ea", share: 0.6 }, { hex: "#1f2a44", share: 0.2 }],
  subjectBackgroundContrast: 8.2, layoutBands: 3, vision: null,
  textRegions: [
    { x0: 0.55, y0: 0.06, x1: 0.95, y1: 0.16, label: "top text-like band" },
    { x0: 0.55, y0: 0.86, x1: 0.93, y1: 0.91, label: "bottom text-like band" },
  ],
  unavailable: [], notes: ["Text-like bands located on a 192 px grey pass."],
};

const fakeAnalyzer: TeachingMediaAnalyzer = {
  async analyze(kind, file) {
    if (readFileSync(String(file), "utf8").includes("broken")) throw new Error("Synthetic decode failure");
    if (kind === "IMAGE") return { kind, width: 1080, height: 1920, aspectRatio: "9:16", notes: [] };
    if (kind === "AUDIO") return { kind, durationSec: 12, audio: AUDIO, notes: [] };
    return { kind, width: 1080, height: 1920, aspectRatio: "9:16", durationSec: 12, hasAudioStream: true, sceneChanges: [0, 4, 8], sceneCount: 3, meanShotSec: 4, audio: AUDIO, notes: [] } as MediaAnalysis;
  },
};

const fakeDeep: DeepMediaAnalyzer = {
  async video(file, _base, opts): Promise<VideoDeepAnalysis> {
    const variant = readFileSync(String(file), "utf8").includes("variant");
    opts.onProgress?.("FRAME_ANALYSIS", "48 frames", { framesTotal: 48, framesProcessed: 48 });
    opts.onProgress?.("SCENE_DETECTION", "3 scenes", { scenesTotal: 3, scenesProcessed: 0 });
    opts.onProgress?.("MOTION_ANALYSIS", "3 scenes", { scenesProcessed: 3 });
    opts.onProgress?.("TRANSITION_ANALYSIS", "2 boundaries", { boundariesTotal: 2, boundariesProcessed: 2 });
    opts.onProgress?.("SYNC_ANALYSIS", "2 of 2 cuts on the beat");
    opts.onProgress?.("CREATIVE_PATTERN_ANALYSIS", "3 observations");
    return {
      sampledFps: 4, frames: 48, scenes: SCENES,
      transitions: { START: 1, CUT: 2, FADE_THROUGH_BLACK: 0, SOFT: 0 }, startsFromBlack: false, endsInBlack: false,
      sync: { bpm: 120, cuts: 2, onBeat: 2, onDownbeat: 1, toleranceSec: 0.075, chanceRatio: 0.3, durationEnergyCorrelation: null },
      unavailable: ["On-screen text content — vision analysis is not available."], notes: [],
      observations: buildObservations({ sourceId: opts.sourceId ?? "fixture", scenes: SCENES, extras: extras(variant ? FADE_BLACK : DISSOLVE), audio: AUDIO, visionUsed: false }),
      transitionKinds: { START: 1, [variant ? "FADE_THROUGH_BLACK" : "DISSOLVE"]: 1, CUT: 1 }, gradualBoundaries: [4],
    };
  },
  async image() {
    return structuredClone(IMAGE_DEEP);
  },
};

const CAPS: CapabilityAvailability[] = [
  { capability: "CAMERA_MOTION", label: "Camera motion", implemented: true, configured: true, executable: true, state: "EXECUTABLE", reason: "Measured.", route: "FFmpeg" },
  { capability: "SPEECH_TO_TEXT", label: "Speech transcription", implemented: false, configured: false, executable: false, state: "NOT_IMPLEMENTED", reason: "No adapter.", route: "—" },
];

async function makeCenter() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-18d-"));
  roots.push(root);
  const memory = new PersistentMemoryCenter();
  await memory.boot(root);
  const pipeline = new KnowledgePipeline({
    store: adaptKnowledgeStorageEngine(memory.getKnowledgeStorageEngine()),
    dataDir: path.join(memory.getKnowledgeRoot(), "pipeline"), fetcher: null, embedder: null,
  });
  await pipeline.boot();
  await Promise.all(ensureCoreKnowledge(pipeline).map((j) => pipeline.waitForJob(j.jobId)));
  const dataDir = path.join(memory.getKnowledgeRoot(), "training");
  const center = new TrainingCenter({
    dataDir, pipeline: () => pipeline, analyzer: fakeAnalyzer, deepAnalyzer: fakeDeep, patterns: null,
    projectExists: async (id) => id === "proj-a", loadFonts: async () => [], ai: () => null, capabilities: () => CAPS,
  });
  center.boot();
  return { center, dataDir, root };
}

const b64 = (s: string) => Buffer.from(s).toString("base64");

async function learn(center: TrainingCenter, capability: string, inputs: Array<Record<string, unknown>>, instructions = "") {
  const ids: string[] = [];
  for (const input of inputs) ids.push((await center.addSource({ capability, ...input }, "tester")).source.sourceId);
  const session = await center.createSession({ capability, teachingType: "STYLE", instructions, sourceIds: ids }, "tester");
  const job = await center.waitForJob(session.jobId!);
  return { job, session: center.getSession(session.sessionId), sourceIds: ids };
}

async function commitPublishActivate(center: TrainingCenter, sessionId: string, body: Record<string, unknown> = {}) {
  const result = await center.commitSession(sessionId, body, "tester");
  for (const r of center.getDataset(result.datasetId).records) {
    if (r.validation.state === "NEEDS_REVIEW") center.reviewRecord(result.datasetId, r.recordId, "APPROVED", "Reviewed", "tester");
  }
  const pub = await center.waitForJob(center.publish(result.datasetId, "learned", "tester").jobId);
  expect(pub.status, JSON.stringify(pub.error ?? pub.result)).toBe("COMPLETED");
  const version = pub.result!.version as number;
  const ev = await center.waitForJob(center.evaluate(result.datasetId, version, "tester").jobId);
  const evaluation = center.getEvaluation(ev.result!.evaluationId as string);
  expect(evaluation.status, JSON.stringify(evaluation.checks.filter((c) => c.status === "FAILED"))).toBe("PASSED");
  const act = await center.waitForJob(center.activate(result.datasetId, version, "tester").jobId);
  expect(act.status, JSON.stringify(act.error)).toBe("COMPLETED");
  return { result, version };
}

const VIDEO = (bytes = "controlled-fixture-bytes") => ({ fileName: `${bytes}.mp4`, title: "Reference edit", mimeType: "video/mp4", dataBase64: b64(bytes) });
const AUDIO_FILE = (bytes = "controlled-audio-bytes") => ({ fileName: `${bytes}.mp3`, title: "Reference track", mimeType: "audio/mpeg", dataBase64: b64(bytes) });
const IMAGE_FILE = { fileName: "poster.png", title: "Reference poster", mimeType: "image/png", dataBase64: b64("controlled-image-bytes") };
const patternOf = (r: KnowledgeRecord) => r.structuredData.creativePattern as { family: string; parameters: Record<string, unknown>; evidence: string[] } | undefined;

// ---------- structural novelty, contextual variation, enrichment ----------

const candidate = (family: string, parameters: Record<string, unknown>, confidence = 0.8): KnowledgeRecord => ({
  id: "cand", title: `Creative pattern · ${family.toLowerCase()}`, statement: `${family} pattern measured in the reference.`, canonicalStatement: "",
  flags: [], suggestedGuidance: [], confidence, structuredData: { creativePattern: { family, parameters } },
} as unknown as KnowledgeRecord);
const known = (id: string, family: string, parameters: Record<string, unknown>) => ({ id, title: `Known ${family}`, text: `${family} pattern already learned.`, kind: "DATASET" as const, pattern: { family, parameters } });

describe("Phase 18D — novelty is structural for patterns and contextual for advice", () => {
  it("classifies creative patterns by family and defining parameters, not wording", () => {
    const pool = [known("d1", "TRANSITION", { transition: "DISSOLVE", position: "INTO_REVEAL", durationSec: 0.5 })];
    const dup = assessNovelty(candidate("TRANSITION", { transition: "DISSOLVE", position: "INTO_REVEAL", durationSec: 0.52 }), pool);
    expect(dup).toMatchObject({ class: "DUPLICATE", method: "STRUCTURAL_PATTERN", matched: { id: "d1" } });
    const knownVariant = assessNovelty(candidate("TRANSITION", { transition: "DISSOLVE", position: "INTO_REVEAL", durationSec: 1.4 }), pool);
    expect(knownVariant.class).toBe("KNOWN");
    const fresh = assessNovelty(candidate("TRANSITION", { transition: "FADE_THROUGH_BLACK", position: "INTO_REVEAL", durationSec: 0.6 }), pool);
    expect(fresh).toMatchObject({ class: "NEW", method: "STRUCTURAL_PATTERN" });
    expect(fresh.reason).toMatch(/variation/);
    expect(assessNovelty(candidate("TRANSITION", { transition: "CUT", position: "INTO_REVEAL" }, 0.3), pool).class).toBe("LOW_CONFIDENCE");
    expect(assessNovelty(candidate("CAMERA", { movement: "PUSH_IN", role: "REVEAL" }), pool).method).toBe("LEXICAL_SEMANTIC");
    expect(patternSignature({ family: "AUDIO_SYNC", parameters: { downbeatRatio: 0.6, onBeatRatio: 1 } })).toBe(patternSignature({ family: "AUDIO_SYNC", parameters: { alignTo: "DOWNBEAT" } }));
    expect(patternSignature({ family: "MUSIC_TEMPO", parameters: { bpm: 121, energyLevel: "HIGH" } })).toBe(patternSignature({ family: "MUSIC_TEMPO", parameters: { bpm: 119, energyLevel: "HIGH" } }));
  });

  it("context-dependent advice is a variation, not a contradiction; enrichment keeps what the old statement said", () => {
    const calm = "For calm product videos, use slow crossfade transitions between the product scenes.";
    const energetic = "For energetic product videos, use hard cut transitions between the product scenes.";
    expect(contextualVariation(calm, energetic)).toMatchObject({ mine: ["calm"], theirs: ["energetic"] });
    const rec = { id: "c", title: "Transitions", statement: energetic, canonicalStatement: energetic, flags: [], suggestedGuidance: [], confidence: 0.8, structuredData: {} } as unknown as KnowledgeRecord;
    const n = assessNovelty(rec, [{ id: "k", title: "Calm transitions", text: calm, kind: "DATASET" }]);
    expect(n.class).not.toBe("CONTRADICTORY");
    expect(n.reason).toMatch(/Contextual variation/);

    expect(enrichesStatement("Keep the product centred in every scene.", "Keep the product centred in every scene and leave text-safe space on the right for headlines.")).toBe(true);
    expect(enrichesStatement("Keep the product centred in every scene.", "Never keep the product centred in every scene.")).toBe(false);
    expect(enrichesStatement("Keep the product centred in every scene.", "Use warm colour grading.")).toBe(false);
  });
});

// ---------- audio, image, cross-modal pattern extraction ----------

describe("Phase 18D — audio and image patterns, creative profile", () => {
  it("audio yields tempo and structure patterns with evidence; nothing is guessed", () => {
    expect(loudnessLevel(-9)).toBe("HIGH");
    expect(loudnessLevel(-14)).toBe("MEDIUM");
    expect(loudnessLevel(-24)).toBe("LOW");
    const { patterns, unavailable } = extractAudioPatterns(AUDIO, { subject: "Track" });
    const tempo = patterns.find((p) => p.family === "MUSIC_TEMPO")!;
    expect(tempo.parameters).toMatchObject({ bpm: 120, energyLevel: "MEDIUM", beatsPerBar: 4 });
    expect(tempo.evidence.join(" ")).toMatch(/downbeats at 0\.00, 2\.00/);
    expect(patterns.find((p) => p.family === "MUSIC_STRUCTURE")!.parameters).toMatchObject({ sequence: "INTRO>DROP", introSec: 4, firstRiseSec: 4 });
    expect(unavailable.join(" ")).toMatch(/speech-to-text/);
    const unsure = extractAudioPatterns({ ...AUDIO, tempoStatus: "low_confidence" } as AudioMeasurement, { subject: "Track" });
    expect(unsure.patterns.some((p) => p.family === "MUSIC_TEMPO")).toBe(false);
    expect(unsure.unavailable.join(" ")).toMatch(/BPM is not guessed/);
  });

  it("image yields layout, typography layout and contrast; fonts are never named", () => {
    const { patterns, unavailable } = extractImagePatterns(IMAGE_DEEP);
    expect(patterns.find((p) => p.family === "LAYOUT")!.parameters).toMatchObject({ subjectPlacement: "left", textSafeSide: "right" });
    expect(patterns.find((p) => p.family === "TYPOGRAPHY_LAYOUT")!.parameters).toMatchObject({ headlinePosition: "top", textSide: "right", ctaBand: "bottom", readByVision: false, textBands: 2 });
    expect(patterns.find((p) => p.family === "COLOR_CONTRAST")!.parameters).toMatchObject({ contrastClass: "HIGH" });
    expect(JSON.stringify(patterns)).not.toMatch(/font-family|Helvetica|Arial|Roboto/i);
    expect(unavailable.join(" ")).toMatch(/font names are never guessed/);
  });

  it("the creative profile needs two modalities and references each component", () => {
    const img = extractImagePatterns(IMAGE_DEEP).patterns;
    const aud = extractAudioPatterns(AUDIO, { subject: "Track" }).patterns;
    expect(buildCreativeProfile(img.map((pattern) => ({ modality: "IMAGE" as const, pattern, sourceTitle: "Poster" })), null)).toBeNull();
    const profile = buildCreativeProfile([
      ...img.map((pattern) => ({ modality: "IMAGE" as const, pattern, sourceTitle: "Poster" })),
      ...aud.map((pattern) => ({ modality: "AUDIO" as const, pattern, sourceTitle: "Track" })),
    ], { onBeatRatio: 1, downbeatRatio: 1, bpm: 120 })!;
    expect(profile.family).toBe("CREATIVE_PROFILE");
    expect(profile.parameters).toMatchObject({ modalities: "AUDIO+IMAGE+VIDEO", audio: expect.stringMatching(/120 BPM/) });
    expect(profile.description).toMatch(/Sync: 100% of cuts on the beat/);
  });
});

// ---------- runtime consumers ----------

const pattern = (id: string, family: ActiveCreativePattern["family"], parameters: ActiveCreativePattern["parameters"]): ActiveCreativePattern => ({
  family, name: `${family} ${id}`, description: "", parameters, compatibleContexts: ["vertical"], variationOptions: [], scenes: [1, 2], confidence: 0.8, evidence: ["measured"],
  patternId: id, usageCount: 0, provenance: { datasetId: "ds", datasetKey: "LEARNED_X", version: 1, recordId: id, sources: [{ sourceId: "s", title: "Reference", locations: ["0–12 s"] }] },
});

function intel(): AudioTimingIntelligence {
  const list: AudioTimingIntelligence["beats"] = [];
  for (let i = 1; i <= 31; i++) {
    const down = i % 4 === 0;
    list.push({ time: i * 0.5, strength: down ? 0.92 : i % 2 === 0 ? 0.8 : 0.55, strengthClass: down || i % 2 === 0 ? "strong" : "normal", confidence: 0.85, type: down ? "downbeat" : "beat" });
  }
  return {
    audioAssetId: "a", contentHash: "h", analysisVersion: AUDIO_INTELLIGENCE_VERSION, status: "READY", analyzedAt: new Date(0).toISOString(), analysisDurationMs: 0,
    technical: { durationSec: 16, sampleRate: 22050, channels: 1, codec: "pcm", bitrate: null, format: "raw", silent: false, insufficientDuration: false },
    tempo: { bpm: 120, primaryBpm: 120, alternativeBpm: 60, confidence: 0.8, method: "test", status: "available" },
    duration: 16, bpm: 120, bpmConfidence: 0.8, beats: list, strongBeats: list.filter((b) => b.strength >= 0.8), downbeats: list.filter((b) => b.type === "downbeat"),
    energyTimeline: [{ start: 0, end: 16, energy: 0.6, trend: "high" }], energyTransitions: [],
    sections: [{ label: "SECTION_1", start: 0, end: 16, energy: 0.6, beatDensity: 2, confidence: 0.6 }],
    beatDensity: [{ start: 0, end: 16, beatsPerSecond: 2, density: "normal" }], meanEnergy: 0.6,
  };
}
const clip = (order: number, purpose: string, durationMs: number): VideoTimelineClip => ({
  id: `c${order}`, sceneId: `s${order}`, order, purpose, assetId: "x", startMs: 0, durationMs, layer: "video",
  camera: "medium", motion: "hold", lighting: "natural", background: "clean", transitionIn: "cut", transitionOut: "cut", text: [], audioDirection: "bed",
});

describe("Phase 18D — learned patterns change real runtime decisions", () => {
  it("beat sync prefers measured downbeats when an AUDIO_SYNC pattern learned downbeat cutting; the stored note carries no ids", () => {
    const alignment = learnedBeatAlignment(selectCreativePatterns([pattern("a", "AUDIO_SYNC", { onBeatRatio: 1, downbeatRatio: 1, onDownbeat: 2 })], { seed: "p", context: [] }))!;
    expect(alignment.value).toBe("DOWNBEAT");
    const clips = [clip(1, "FEATURE", 2300), clip(2, "FEATURE", 2300), clip(3, "BENEFIT", 2300), clip(4, "CTA", 2300)];
    const base = applyBeatSyncTiming({ clips, mode: "SMART", intelligence: intel() });
    const learned = applyBeatSyncTiming({ clips, mode: "SMART", intelligence: intel(), learned: { alignTo: "DOWNBEAT", patternId: "a", name: "Cuts on the downbeat", dataset: "LEARNED_X" } });
    const downs = (p: typeof base.plan) => p.scenes.filter((s) => s.alignmentType === "DOWNBEAT").length;
    expect(downs(learned.plan)).toBeGreaterThan(downs(base.plan));
    expect(learned.plan.learned).toMatchObject({ alignTo: "DOWNBEAT", applied: true, name: "Cuts on the downbeat" });
    expect(JSON.stringify(learned.plan.learned)).not.toMatch(/LEARNED_X|"patternId"|"dataset"/);
    const off = applyBeatSyncTiming({ clips, mode: "OFF", intelligence: intel(), learned: { alignTo: "DOWNBEAT", patternId: "a", name: "n", dataset: "LEARNED_X" } });
    expect(off.plan.learned).toMatchObject({ applied: false });
    expect(off.plan.learned!.note).toMatch(/off/);
  });

  it("typography placement follows learned text sides and CTA band; music guidance is reference only", () => {
    const layout = learnedTypographyLayout(selectCreativePatterns([
      pattern("l", "LAYOUT", { subjectPlacement: "left", textSafeSide: "right" }),
      pattern("t", "TYPOGRAPHY_LAYOUT", { headlinePosition: "top", textSide: "right", ctaBand: "top" }),
    ], { seed: "p", context: [] }))!;
    expect(layout.value).toEqual({ textSides: ["right"], ctaPlacement: "top" });
    const product = { productCentered: true, productOccupiedRegion: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 } };
    expect(choosePlacement({ role: "cta", hierarchy: 3, ...product, ctaPlacement: "top" })).toMatch(/^top|^upper/);
    expect(choosePlacement({ role: "headline", hierarchy: 1, ...product, preferredTextSides: layout.value.textSides })).toMatch(/right/);

    const music = learnedMusicGuidance(selectCreativePatterns([
      pattern("m", "MUSIC_TEMPO", { bpm: 120, energyLevel: "HIGH" }), pattern("s", "MUSIC_STRUCTURE", { sequence: "INTRO>DROP", introSec: 4 }),
    ], { seed: "p", context: [] }))!;
    expect(music.value).toEqual({ bpmRange: [113, 127], energyLevel: "HIGH", structure: "INTRO>DROP", introSec: 4 });
  });

  it("each runtime consumer reads only its task families", () => {
    expect(RUNTIME_PATTERN_QUERIES.beatSync().families).not.toContain("LAYOUT");
    expect(RUNTIME_PATTERN_QUERIES.typography().families).not.toContain("AUDIO_SYNC");
    expect(RUNTIME_PATTERN_QUERIES.videoPlan(false).alsoTasks).toEqual(["TYPOGRAPHY_PLAN", "AUDIO_PLAN"]);
  });
});

// ---------- end-to-end teaching ----------

describe("Phase 18D — multimodal teaching end-to-end", { timeout: 180_000 }, () => {
  it("audio teaching: real stages, music patterns, activation and music-guidance consumption", async () => {
    const { center, root } = await makeCenter();
    const { job, session } = await learn(center, "AUDIO_ANALYSIS", [AUDIO_FILE()]);
    expect(job.status).toBe("COMPLETED");
    const stages = job.stages.map((s) => s.stage);
    for (const s of ["AUDIO_METADATA", "WAVEFORM_ANALYSIS", "SPEECH_ANALYSIS", "BPM_ANALYSIS", "BEAT_ANALYSIS", "ENERGY_ANALYSIS", "PATTERN_ANALYSIS", "KNOWLEDGE_EXTRACTION"]) expect(stages).toContain(s);
    expect(job.stages.find((s) => s.stage === "SPEECH_ANALYSIS")!.note).toMatch(/Unavailable/);
    expect(session.analysis.perSource[0]!.summary).toMatchObject({ bpm: 120, beats: 24, downbeats: 6, musicPatterns: 2 });
    const k = session.knowledge!;
    const musical = k.filter((r) => ["MUSIC_TEMPO", "MUSIC_STRUCTURE"].includes(patternOf(r)?.family ?? ""));
    expect(musical).toHaveLength(2);
    const { result } = await commitPublishActivate(center, session.sessionId, { accept: musical.map((r) => r.id) });
    expect(center.activeCreativePatterns({ ...RUNTIME_PATTERN_QUERIES.beatSync(), projectId: null, context: [] }).map((p) => p.family).sort()).toEqual(["MUSIC_STRUCTURE", "MUSIC_TEMPO"]);
    expect(center.activeCreativePatterns({ ...RUNTIME_PATTERN_QUERIES.typography(), projectId: null, context: [] })).toEqual([]);
    const test = await center.runtimeTest(result.datasetId, {});
    const guidance = test.consumption.find((c) => /learned music guidance/.test(c.consumer))!;
    expect(guidance.usesTeaching).toBe(true);
    expect(guidance.measured).toMatchObject({ bpmRange: [113, 127], structure: "INTRO>DROP", musicGeneration: "UNAVAILABLE" });
    expect(JSON.stringify(test)).not.toContain(root);
  });

  it("image teaching: real stages, layout patterns reach typography placement; deactivation removes them", async () => {
    const { center, root } = await makeCenter();
    const { job, session } = await learn(center, "PRODUCT_VIDEO_TYPOGRAPHY", [IMAGE_FILE]);
    expect(job.status).toBe("COMPLETED");
    const stages = job.stages.map((s) => s.stage);
    for (const s of ["IMAGE_METADATA", "COMPOSITION_ANALYSIS", "TEXT_ANALYSIS", "TYPOGRAPHY_ANALYSIS", "DESIGN_PATTERN_ANALYSIS", "KNOWLEDGE_EXTRACTION"]) expect(stages).toContain(s);
    expect(job.stages.find((s) => s.stage === "TYPOGRAPHY_ANALYSIS")!.note).toMatch(/Unavailable/);
    expect(session.analysis.perSource[0]!.summary).toMatchObject({ textBands: 2, designPatterns: 3, visionUsed: false });
    const design = session.knowledge!.filter((r) => patternOf(r));
    expect(design.map((r) => patternOf(r)!.family).sort()).toEqual(["COLOR_CONTRAST", "LAYOUT", "TYPOGRAPHY_LAYOUT"]);
    const { result } = await commitPublishActivate(center, session.sessionId, { accept: design.map((r) => r.id) });
    expect(center.activeCreativePatterns({ ...RUNTIME_PATTERN_QUERIES.typography(), projectId: null, context: [] })).toHaveLength(3);
    expect(center.activeCreativePatterns({ ...RUNTIME_PATTERN_QUERIES.videoPlan(false), projectId: null, context: [] }).length).toBeGreaterThan(0);
    expect(center.activeCreativePatterns({ ...RUNTIME_PATTERN_QUERIES.beatSync(), projectId: null, context: [] })).toEqual([]);
    const test = await center.runtimeTest(result.datasetId, {});
    const placement = test.consumption.find((c) => /learned layout/.test(c.consumer))!;
    expect(placement.usesTeaching, placement.detail).toBe(true);
    expect(placement.measured).toMatchObject({ textSides: ["right"], ctaPlacement: "bottom" });
    expect(JSON.stringify(placement.measured!.after)).toMatch(/right/);
    expect(JSON.stringify(test)).not.toContain(root);

    expect((await center.waitForJob(center.deactivate(result.datasetId, "tester").jobId)).status).toBe("COMPLETED");
    expect(center.activeCreativePatterns({ ...RUNTIME_PATTERN_QUERIES.typography(), projectId: null, context: [] })).toEqual([]);
    expect((await center.runtimeTest(result.datasetId, {})).consumption.some((c) => /learned layout/.test(c.consumer))).toBe(false);
  });

  it("video × audio correlation: paired sync with per-cut evidence, creative profile, beat-sync consumption after source deletion", async () => {
    const { center, dataDir } = await makeCenter();
    const { job, session, sourceIds } = await learn(center, "AUDIO_VIDEO_SYNC", [VIDEO(), { ...AUDIO_FILE(), retention: "DELETE_SOURCE_AFTER_LEARNING" }]);
    expect(job.status).toBe("COMPLETED");
    expect(job.stages.map((s) => s.stage)).toContain("SYNC_ANALYSIS");
    const k = session.knowledge!;
    const paired = k.find((r) => patternOf(r)?.family === "AUDIO_SYNC" && patternOf(r)!.parameters.pairedSources)!;
    expect(paired.title).toMatch(/Reference edit × Reference track: 2\/2 cuts on beat/);
    expect(patternOf(paired)!.parameters).toMatchObject({ alignTo: "DOWNBEAT", downbeatRatio: 1 });
    expect(patternOf(paired)!.evidence.join(" ")).toMatch(/cut 4\.00 s ↔ Reference track downbeat 4\.00 s \(Δ 0 ms\)/);
    const profile = k.find((r) => patternOf(r)?.family === "CREATIVE_PROFILE")!;
    expect(String(patternOf(profile)!.parameters.modalities)).toBe("AUDIO+VIDEO");
    expect(profile.sourceLocations.map((l) => l.sourceTitle).sort()).toEqual(["Reference edit", "Reference track"]);

    const audioSource = center.listSources().find((s) => s.sourceId === sourceIds[1])!;
    expect(audioSource.retentionState).toBe("PENDING_ACTIVATION");
    const accept = k.filter((r) => patternOf(r) && r.novelty.class !== "DUPLICATE").map((r) => r.id);
    const { result } = await commitPublishActivate(center, session.sessionId, { accept });
    const gone = center.listSources({ includeArchived: true }).find((s) => s.sourceId === sourceIds[1])!;
    expect(gone).toMatchObject({ retained: false, retentionState: "DELETED_AFTER_LEARNING" });
    expect(existsSync(path.join(dataDir, "sources", `${gone.contentHash}.mp3`))).toBe(false);

    const test = await center.runtimeTest(result.datasetId, {});
    const sync = test.consumption.find((c) => /Beat-sync timing/.test(c.consumer))!;
    expect(sync.measured).toMatchObject({ alignTo: "DOWNBEAT" });
    expect(sync.usesTeaching, sync.detail).toBe(true);
    expect(JSON.stringify(sync.measured!.after)).toMatch(/DOWNBEAT/);
  });

  it("re-teaching the same material adds nothing; a partially new video adds only the new pattern and keeps the old one", async () => {
    const { center } = await makeCenter();
    const first = await learn(center, "PRODUCT_SLIDESHOW", [VIDEO()]);
    const firstPatterns = first.session.knowledge!.filter((r) => patternOf(r));
    const { result } = await commitPublishActivate(center, first.session.sessionId, { accept: firstPatterns.map((r) => r.id) });
    const before = center.getDataset(result.datasetId).records.length;

    const again = await learn(center, "PRODUCT_SLIDESHOW", [VIDEO("controlled-fixture-copy")]);
    const repeated = again.session.knowledge!.filter((r) => patternOf(r));
    expect(repeated.length).toBeGreaterThan(0);
    for (const r of repeated) {
      expect(["DUPLICATE", "KNOWN"], `${patternOf(r)!.family}: ${r.novelty.reason}`).toContain(r.novelty.class);
      expect(r.novelty.method).toBe("STRUCTURAL_PATTERN");
    }
    const merged = await center.commitSession(again.session.sessionId, { datasetId: result.datasetId, accept: repeated.map((r) => r.id) }, "tester");
    expect(merged.created).toBe(0);
    expect(center.getDataset(result.datasetId).records.length).toBe(before);

    const variant = await learn(center, "PRODUCT_SLIDESHOW", [VIDEO("controlled-fixture-variant")]);
    const vp = variant.session.knowledge!.filter((r) => patternOf(r));
    const fresh = vp.filter((r) => r.novelty.class === "NEW");
    expect(fresh.some((r) => patternOf(r)!.family === "TRANSITION" && patternOf(r)!.parameters.transition === "FADE_THROUGH_BLACK")).toBe(true);
    expect(vp.some((r) => r.novelty.class === "DUPLICATE" || r.novelty.class === "KNOWN")).toBe(true);
    const added = await center.commitSession(variant.session.sessionId, { datasetId: result.datasetId, accept: fresh.map((r) => r.id) }, "tester");
    expect(added.created).toBe(fresh.length);
    const transitions = center.getDataset(result.datasetId).records
      .map((r) => (r.knowledge?.structuredData.creativePattern as { family: string; parameters: { transition?: string } } | undefined))
      .filter((p) => p?.family === "TRANSITION").map((p) => p!.parameters.transition);
    expect(transitions).toEqual(expect.arrayContaining(["DISSOLVE", "FADE_THROUGH_BLACK"]));
  });

  it("an extended statement enriches the existing record and keeps the previous wording", async () => {
    const { center } = await makeCenter();
    const first = await learn(center, "PRODUCT_VIDEO_TYPOGRAPHY", [{ text: "Keep the product centred in every scene so it stays the focus.", title: "Notes A" }]);
    const committed = await center.commitSession(first.session.sessionId, { accept: first.session.knowledge!.map((r) => r.id) }, "tester");
    const second = await learn(center, "PRODUCT_VIDEO_TYPOGRAPHY", [{ text: "Keep the product centred in every scene so it stays the focus, and leave text-safe space on the right side for the headline and the price.", title: "Notes B" }]);
    const ext = second.session.knowledge!.find((r) => !patternOf(r))!;
    expect(second.session.knowledge!.find((r) => patternOf(r))?.structuredData.creativePattern).toMatchObject({ family: "LAYOUT", parameters: { textSafeSide: "right" } });
    expect(ext.novelty.class, ext.novelty.reason).toBe("PARTIALLY_NEW");
    const res = await center.commitSession(second.session.sessionId, { datasetId: committed.datasetId, accept: [ext.id] }, "tester");
    expect(res).toMatchObject({ created: 0, enriched: 1 });
    const record = center.getDataset(committed.datasetId).records.find((r) => r.recordId === res.enrichedRecordIds[0])!;
    const revision = record.knowledge!.revisions.find((r) => r.action === "ENRICHED")!;
    expect(revision.previousStatement).toMatch(/^Keep the product centred in every scene so it stays the focus\.$/);
    expect(record.knowledge!.statement).toMatch(/text-safe space on the right/);
    expect(record.knowledge!.sourceIds).toHaveLength(2);
  });
});
