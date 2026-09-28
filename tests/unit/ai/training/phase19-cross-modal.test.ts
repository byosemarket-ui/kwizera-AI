import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PersistentMemoryCenter } from "../../../../dev/server/persistent-memory-center.js";
import { KnowledgePipeline, adaptKnowledgeStorageEngine } from "../../../../ai/knowledge-acquisition-engine/knowledge-pipeline.js";
import { ensureCoreKnowledge } from "../../../../ai/knowledge-acquisition-engine/kwizera-core-knowledge.js";
import { TrainingCenter } from "../../../../ai/training-center/training-center.js";
import type { KnowledgeRecord } from "../../../../ai/training-center/training-types.js";
import { creativeRulesFromSentence } from "../../../../ai/training-center/creative-patterns.js";
import { storyRoles } from "../../../../ai/training-center/video-observations.js";
import { assessNovelty } from "../../../../ai/training-center/knowledge-novelty.js";
import {
  applyLearnedPatternsToTimeline, applyLearnedStoryToScenes, buildCrossModalCreativeContext, crossModalPromptView, musicEnergyFromTempo,
  publicLearnedDirection, registerCreativePatternProvider, selectCreativePatterns, type ActiveCreativePattern, type CreativePattern,
} from "../../../../ai/creative-planning/learned-creative-patterns.js";

const roots: string[] = [];
afterEach(async () => {
  registerCreativePatternProvider(null);
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

const meta = { sourceTitle: "Story notes", location: "line 1" };
const rule = (s: string) => creativeRulesFromSentence(s, meta);

function active(p: CreativePattern, id: string, datasetId = "ds-1"): ActiveCreativePattern {
  return { ...p, patternId: id, usageCount: 0, provenance: { datasetId, datasetKey: `KEY_${datasetId}`, version: 1, recordId: id, sources: [{ sourceId: "s1", title: "Story notes", locations: ["line 1"] }] } };
}

const timeline = () => [
  { sceneId: "scene-1", order: 1, purpose: "HOOK", durationMs: 2500, motion: "slow-zoom", camera: "medium", transitionIn: "cut" as const, transitionOut: "cut" as const },
  { sceneId: "scene-2", order: 2, purpose: "PRODUCT_REVEAL", durationMs: 3000, motion: "hold", camera: "medium", transitionIn: "cut" as const, transitionOut: "cut" as const },
  { sceneId: "scene-3", order: 3, purpose: "FEATURE", durationMs: 3000, motion: "hold", camera: "medium", transitionIn: "cut" as const, transitionOut: "cut" as const },
  { sceneId: "scene-4", order: 4, purpose: "CTA", durationMs: 3000, motion: "hold", camera: "medium", transitionIn: "cut" as const, transitionOut: "cut" as const },
];
const total = (clips: Array<{ durationMs: number }>) => clips.reduce((a, c) => a + c.durationMs, 0);
const select = (patterns: ActiveCreativePattern[]) => selectCreativePatterns(patterns, { seed: "t", context: ["product-video"] });

describe("Phase 19 — creative rules stated in text become structured patterns", () => {
  it("parses story order, energy pacing and layout; ignores ordinary sentences", () => {
    const [story] = rule("Product reveal should be followed by a short close-up.");
    expect(story).toMatchObject({ family: "STORYTELLING", parameters: { rule: "FOLLOWED_BY", after: "PRODUCT_REVEAL", next: "CLOSE_UP", nextDuration: "SHORT", sequence: "PRODUCT_REVEAL>CLOSE_UP" } });
    expect(story!.evidence[0]).toMatch(/Story notes \(line 1\)/);
    expect(rule("HOOK > PRODUCT_REVEAL > CLOSE_UP > OFFER > CTA")[0]).toMatchObject({ family: "STORYTELLING", parameters: { rule: "SEQUENCE", sequence: "HOOK>PRODUCT_REVEAL>CLOSE_UP>OFFER>CTA" } });
    expect(rule("Higher energy means faster pacing.")[0]).toMatchObject({ family: "PACING", parameters: { rule: "ENERGY_PACING", direction: "FASTER_WHEN_HIGH" } });
    expect(rule("Lower music energy calls for slower cuts.")[0]?.parameters.direction).toBe("FASTER_WHEN_HIGH");
    expect(rule("Keep the product centred and place the text on the right.")[0]).toMatchObject({ family: "LAYOUT", parameters: { subjectPlacement: "center", textSafeSide: "right" } });
    const scoped = rule("For luxury videos, the product reveal should be followed by a close-up.")[0]!;
    expect(scoped.description).toMatch(/for luxury videos/);
    expect(scoped.compatibleContexts).toContain("luxury");
    expect(rule("Our brand was founded in 2010 and sells shoes.")).toEqual([]);
  });

  it("video observations mark a close-up right after the reveal", () => {
    const roles = storyRoles([
      { index: 1, durationSec: 2, subjectCoverage: 0.2, transitionIn: "START", vision: null, camera: "STATIC", textDetected: false },
      { index: 2, durationSec: 3, subjectCoverage: 0.3, transitionIn: "CUT", vision: null, camera: "PUSH_IN", textDetected: false },
      { index: 3, durationSec: 1.5, subjectCoverage: 0.6, transitionIn: "CUT", vision: null, camera: "STATIC", textDetected: false },
      { index: 4, durationSec: 3, subjectCoverage: 0.3, transitionIn: "CUT", vision: null, camera: "STATIC", textDetected: true },
    ] as never);
    expect(roles.map((r) => r.role)).toEqual(["HOOK", "REVEAL", "CLOSE_UP", "CTA"]);
  });
});

describe("Phase 19 — the planner applies learned story and pacing rules", () => {
  const story = active(rule("Product reveal should be followed by a short close-up.")[0]!, "p-story");
  const pacing = active(rule("Higher energy means faster pacing.")[0]!, "p-pace", "ds-2");

  it("reveal is followed by a short close-up; total duration and the CTA are preserved; user edits win", () => {
    const base = timeline();
    const out = applyLearnedPatternsToTimeline(base, select([story]));
    expect(out.clips.map((c) => c.storyRole ?? c.purpose)).toEqual(["HOOK", "PRODUCT_REVEAL", "CLOSE_UP", "CTA"]);
    expect(out.clips[2]).toMatchObject({ camera: "close-up", durationMs: 2100 });
    expect(total(out.clips)).toBe(total(base));
    expect(out.decisions[0]).toMatchObject({ applied: true, family: "STORYTELLING", provenance: { datasetId: "ds-1" } });
    const edited = timeline();
    edited[2]!.userEdited = true as never;
    expect(applyLearnedPatternsToTimeline(edited, select([story])).clips[2]!.camera).toBe("medium");
    const short = timeline().filter((c) => c.purpose !== "FEATURE");
    const res = applyLearnedPatternsToTimeline(short, select([story]));
    expect(res.decisions[0]!.applied).toBe(false);
    expect(res.clips.map((c) => c.purpose)).toEqual(["HOOK", "PRODUCT_REVEAL", "CTA"]);
  });

  it("energy pacing applies only with measured music energy", () => {
    const base = timeline();
    const fast = applyLearnedPatternsToTimeline(base, select([pacing]), { musicEnergy: "HIGH" });
    expect(fast.clips[1]!.durationMs).toBe(2400);
    expect(total(fast.clips)).toBe(total(base));
    const none = applyLearnedPatternsToTimeline(base, select([pacing]), { musicEnergy: null });
    expect(none.decisions[0]).toMatchObject({ applied: false });
    expect(none.decisions[0]!.reason).toMatch(/UNAVAILABLE/);
    expect(musicEnergyFromTempo({ bpm: 128, tempoMeasured: true })).toBe("HIGH");
    expect(musicEnergyFromTempo({ bpm: 128, tempoMeasured: false })).toBeNull();
  });

  it("timing and direction phases split the work; the storyboard step marks the close-up", () => {
    const timed = applyLearnedPatternsToTimeline(timeline(), select([story, pacing]), { phase: "timing", musicEnergy: "HIGH" });
    expect(timed.decisions.map((d) => d.family).sort()).toEqual(["PACING", "STORYTELLING"]);
    const reset = timed.clips.map((c) => ({ ...c, camera: "medium" }));
    const directed = applyLearnedPatternsToTimeline(reset, select([story, pacing]), { phase: "direction" });
    expect(directed.decisions).toEqual([]);
    expect(directed.clips[2]!.camera).toBe("close-up");
    const board = applyLearnedStoryToScenes(timeline().map((c) => ({ id: c.sceneId, purpose: c.purpose, camera: c.camera })), select([story]));
    expect(board.scenes[2]!.camera).toBe("close-up");
    expect(board.applied[0]).toMatch(/scene-2 → scene-3/);
  });
});

describe("Phase 19 — cross-modal context", () => {
  it("groups by modality, excludes low confidence and contradictions, keeps provenance internal", () => {
    const layout = active({ ...rule("Keep the product centred and place the text on the right.")[0]!, confidence: 0.72 }, "p-layout", "ds-img");
    const tempo = active({ family: "MUSIC_TEMPO", name: "120 BPM", description: "", parameters: { bpm: 120, energyLevel: "HIGH" }, compatibleContexts: ["music"], variationOptions: [], scenes: [], confidence: 0.8, evidence: [] }, "p-tempo", "ds-audio");
    const weak = active({ ...rule("Higher energy means faster pacing.")[0]!, confidence: 0.3 }, "p-weak", "ds-weak");
    const story = active(rule("Product reveal should be followed by a short close-up.")[0]!, "p-story");
    const clash = active(rule("Product reveal should be followed by the offer.")[0]!, "p-clash", "ds-clash");
    const all = [layout, tempo, weak, story];
    registerCreativePatternProvider({ active: (q) => all.filter((p) => !q.families || q.families.includes(p.family)), recordUsage: () => undefined });
    const ctx = buildCrossModalCreativeContext({ task: "PRODUCT_VIDEO_CREATION", projectId: null, aspectRatio: "9:16", audio: { bpm: 120, tempoMeasured: true, energyLevel: "HIGH" } });
    expect(ctx.storytellingPatterns.map((e) => e.patternId)).toEqual(["p-story"]);
    expect(ctx.compositionPatterns[0]!.patternId).toBe("p-layout");
    expect(ctx.productPatterns[0]!.patternId).toBe("p-layout");
    expect(ctx.audioPatterns[0]!.patternId).toBe("p-tempo");
    expect(ctx.excluded).toEqual([expect.objectContaining({ patternId: "p-weak" })]);
    expect(ctx.provenance.map((p) => p.datasetKey)).toContain("KEY_ds-img");
    const view = JSON.stringify(crossModalPromptView(ctx));
    expect(view).not.toMatch(/KEY_ds|p-story|patternId|datasetId/);
    expect(view).toMatch(/PRODUCT_REVEAL>CLOSE_UP/);

    all.push(clash);
    const conflicted = buildCrossModalCreativeContext({ task: "PRODUCT_VIDEO_CREATION", projectId: null });
    expect(conflicted.storytellingPatterns).toEqual([]);
    expect(conflicted.excluded.map((e) => e.patternId).sort()).toEqual(["p-clash", "p-story", "p-weak"]);
    expect(conflicted.unavailable.join(" ")).toMatch(/BPM/);

    const code = buildCrossModalCreativeContext({ task: "CODE_AI", projectId: null });
    expect(code.selections).toEqual([]);
    expect(code.unavailable[0]).toMatch(/CODE_AI/);
    expect(buildCrossModalCreativeContext({ task: "TYPOGRAPHY", projectId: null }).compositionPatterns[0]!.patternId).toBe("p-layout");
  });

  it("customer view of learned direction has no ids, dataset keys or sources", () => {
    const out = applyLearnedPatternsToTimeline(timeline(), select([active(rule("Product reveal should be followed by a short close-up.")[0]!, "p-story")]));
    const view = JSON.stringify(publicLearnedDirection({ decisions: out.decisions, selected: [{ family: "STORYTELLING", name: "x" }] }));
    expect(view).toMatch(/CLOSE_UP|close-up/);
    expect(view).not.toMatch(/KEY_ds|p-story|provenance|Story notes/);
  });
});

describe("Phase 19 — repeat teaching, contradiction and contextual variation", () => {
  const cand = (p: CreativePattern, statement = p.description): KnowledgeRecord => ({
    id: "c", title: `Creative pattern · ${p.family}`, statement, canonicalStatement: statement, flags: [], suggestedGuidance: [], confidence: 0.8,
    structuredData: { creativePattern: p },
  } as unknown as KnowledgeRecord);
  const base = rule("Product reveal should be followed by a short close-up.")[0]!;
  const pool = [{ id: "k1", title: "Reveal → close-up", text: base.description, statement: base.description, kind: "DATASET" as const, pattern: { family: base.family, parameters: base.parameters } }];

  it("same rule is DUPLICATE, a longer order is PARTIALLY_NEW, a contradiction needs review, context makes a variation", () => {
    expect(assessNovelty(cand(rule("The product reveal must be followed by a short close up.")[0]!), pool).class).toBe("DUPLICATE");
    const ext = assessNovelty(cand(rule("HOOK > PRODUCT_REVEAL > CLOSE_UP > OFFER > CTA")[0]!), pool);
    expect(ext.class).toBe("PARTIALLY_NEW");
    expect(ext.reason).toMatch(/Extends/);
    expect(assessNovelty(cand(rule("Product reveal should be followed by the offer.")[0]!), pool).class).toBe("REQUIRES_REVIEW");
    const calm = rule("For calm luxury videos, the product reveal is followed by a close-up.")[0]!;
    const calmPool = [{ ...pool[0]!, text: calm.description, statement: calm.description, pattern: { family: calm.family, parameters: calm.parameters } }];
    expect(assessNovelty(cand(rule("For energetic videos, the product reveal is followed by the offer.")[0]!), calmPool).class).toBe("PARTIALLY_NEW");
    const pace = rule("Higher energy means faster pacing.")[0]!;
    const pacePool = [{ id: "k2", title: "pace", text: pace.description, statement: pace.description, kind: "DATASET" as const, pattern: { family: pace.family, parameters: pace.parameters } }];
    expect(assessNovelty(cand(rule("Higher energy means slower pacing.")[0]!), pacePool).class).toBe("REQUIRES_REVIEW");
  });

  it("a rule stated for a narrower context is a contextual variation of the general rule, not a contradiction", () => {
    const scoped = rule("For luxury jewelry, product reveal should be followed by the offer.")[0]!;
    const res = assessNovelty(cand(scoped), pool);
    expect(res.class).toBe("PARTIALLY_NEW");
    expect(res.reason).toMatch(/Contextual variation.*luxury jewelry.*general/);
    const scopedPool = [{ ...pool[0]!, text: scoped.description, statement: scoped.description, pattern: { family: scoped.family, parameters: scoped.parameters } }];
    expect(assessNovelty(cand(rule("Product reveal should be followed by a short close-up.")[0]!), scopedPool).class).toBe("PARTIALLY_NEW");
  });

  it("at runtime the scoped rule applies only to matching requests and the general rule keeps working elsewhere", () => {
    const general = active(rule("Product reveal should be followed by a short close-up.")[0]!, "p-general");
    const scoped = active(rule("For luxury jewelry, product reveal should be followed by the offer.")[0]!, "p-jewelry", "ds-jewelry");
    registerCreativePatternProvider({ active: (q) => [general, scoped].filter((p) => !q.families || q.families.includes(p.family)), recordUsage: () => undefined });
    const other = buildCrossModalCreativeContext({ task: "PRODUCT_VIDEO_CREATION", projectId: null, product: "Canvas sneakers" });
    expect(other.storytellingPatterns.map((e) => e.patternId)).toEqual(["p-general"]);
    expect(other.excluded).toEqual([expect.objectContaining({ patternId: "p-jewelry", reason: expect.stringMatching(/only/) })]);
    const jewelry = buildCrossModalCreativeContext({ task: "PRODUCT_VIDEO_CREATION", projectId: null, product: "Luxury gold jewelry ring" });
    expect(jewelry.storytellingPatterns.map((e) => e.patternId)).toEqual(["p-jewelry"]);
    expect(jewelry.excluded).toEqual([expect.objectContaining({ patternId: "p-general", reason: expect.stringMatching(/jewelry\/luxury/) })]);

    const measured = active({
      family: "STORYTELLING", name: "HOOK → REVEAL → CLOSE_UP → CTA", description: "Measured story order.", scenes: [1, 2, 3, 4], confidence: 0.75, evidence: [],
      parameters: { sequence: "HOOK>REVEAL>CLOSE_UP>CTA", after: "PRODUCT_REVEAL", next: "CLOSE_UP", nextDuration: "SHORT", measuredRoles: 3 },
      compatibleContexts: ["product-video", "9:16", "vertical", "short-form"], variationOptions: [],
    }, "p-video", "ds-video");
    registerCreativePatternProvider({ active: (q) => [measured, scoped].filter((p) => !q.families || q.families.includes(p.family)), recordUsage: () => undefined });
    const plain = buildCrossModalCreativeContext({ task: "PRODUCT_VIDEO_CREATION", projectId: null, product: "Canvas sneakers" });
    expect(plain.storytellingPatterns.map((e) => e.patternId)).toEqual(["p-video"]);
    expect(plain.selections.filter((s) => s.family === "STORYTELLING")).toHaveLength(1);
    const lux = buildCrossModalCreativeContext({ task: "PRODUCT_VIDEO_CREATION", projectId: null, product: "Luxury jewelry pendant", aspectRatio: "9:16" });
    expect(lux.storytellingPatterns.map((e) => e.patternId)).toEqual(["p-jewelry"]);
  });
});

// ---------- end-to-end through the Training Center ----------

async function makeCenter() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-19-"));
  roots.push(root);
  const memory = new PersistentMemoryCenter();
  await memory.boot(root);
  const pipeline = new KnowledgePipeline({
    store: adaptKnowledgeStorageEngine(memory.getKnowledgeStorageEngine()),
    dataDir: path.join(memory.getKnowledgeRoot(), "pipeline"), fetcher: null, embedder: null,
  });
  await pipeline.boot();
  await Promise.all(ensureCoreKnowledge(pipeline).map((j) => pipeline.waitForJob(j.jobId)));
  const center = new TrainingCenter({
    dataDir: path.join(memory.getKnowledgeRoot(), "training"), pipeline: () => pipeline, analyzer: null as never, deepAnalyzer: null as never, patterns: null,
    projectExists: async () => false, loadFonts: async () => [], ai: () => null, capabilities: () => [],
  });
  center.boot();
  return center;
}

const b64 = (s: string) => Buffer.from(s).toString("base64");

async function teachText(center: TrainingCenter, capability: string, text: string, title: string) {
  const { source } = await center.addSource({ capability, fileName: `${title.replace(/\W+/g, "-")}.txt`, title, mimeType: "text/plain", dataBase64: b64(text) }, "tester");
  const session = await center.createSession({ capability, teachingType: "STYLE", instructions: "Learn the storytelling, pacing and layout rules.", sourceIds: [source.sourceId] }, "tester");
  const job = await center.waitForJob(session.jobId!);
  expect(job.status, JSON.stringify(job.error)).toBe("COMPLETED");
  return center.getSession(session.sessionId);
}

async function commitAndActivate(center: TrainingCenter, sessionId: string, body: Record<string, unknown>) {
  const result = await center.commitSession(sessionId, body, "tester");
  for (const r of center.getDataset(result.datasetId).records) {
    if (r.validation.state === "NEEDS_REVIEW") center.reviewRecord(result.datasetId, r.recordId, "APPROVED", "Reviewed", "tester");
  }
  const pub = await center.waitForJob(center.publish(result.datasetId, "learned", "tester").jobId);
  expect(pub.status, JSON.stringify(pub.error ?? pub.result)).toBe("COMPLETED");
  const version = pub.result!.version as number;
  const ev = await center.waitForJob(center.evaluate(result.datasetId, version, "tester").jobId);
  expect(center.getEvaluation(ev.result!.evaluationId as string).status).toBe("PASSED");
  const act = await center.waitForJob(center.activate(result.datasetId, version, "tester").jobId);
  expect(act.status, JSON.stringify(act.error)).toBe("COMPLETED");
  return { datasetId: result.datasetId, version, act };
}

const crossModal = async (center: TrainingCenter, datasetId: string) =>
  (await center.runtimeTest(datasetId, {})).consumption.find((c) => /Cross-modal creative plan/.test(c.consumer))!;

describe("Phase 19 — runtime consumption proof (teach → activate → plan → deactivate → rollback)", () => {
  it("a taught story rule changes the real plan with provenance, stops when deactivated and returns with rollback", async () => {
    const center = await makeCenter();
    const session = await teachText(center, "PRODUCT_SLIDESHOW", "Product reveal should be followed by a short close-up.", "Phase 19 story rule");
    const records = (session.knowledge ?? []) as KnowledgeRecord[];
    const story = records.find((r) => (r.structuredData.creativePattern as CreativePattern | undefined)?.family === "STORYTELLING");
    expect(story, JSON.stringify(records.map((r) => r.title))).toBeTruthy();
    expect(story!.novelty.class).toBe("NEW");

    const v1 = await commitAndActivate(center, session.sessionId, { dataset: { key: "PHASE19_VERIFY_STORY" }, accept: [story!.id] });
    expect(JSON.stringify(v1.act.result)).toMatch(/RUNTIME_VERIFICATION/);
    const proof = await crossModal(center, v1.datasetId);
    expect(proof.usesTeaching, proof.detail).toBe(true);
    const measured = proof.measured as { with: { storySequence: string[]; storyboard: string[] }; without: { storySequence: string[] }; decisions: Array<{ applied: boolean; sources: string[]; dataset: string }>; creativeDirectorPrompt: string };
    expect(measured.with.storySequence).toEqual(["HOOK", "PRODUCT_REVEAL", "CLOSE_UP", "CTA"]);
    expect(measured.without.storySequence).toEqual(["HOOK", "PRODUCT_REVEAL", "SHOWCASE", "CTA"]);
    expect(measured.with.storyboard[2]).toMatch(/close-up/);
    expect(measured.decisions.find((d) => d.applied)).toMatchObject({ dataset: "PHASE19_VERIFY_STORY v1", sources: ["Phase 19 story rule"] });
    expect(measured.creativeDirectorPrompt).toMatch(/PRODUCT_REVEAL>CLOSE_UP/);
    expect(center.knowledgeFlow().find((f) => f.datasetId === v1.datasetId)).toMatchObject({ extracted: 1, activated: 1 });

    const repeat = await teachText(center, "PRODUCT_SLIDESHOW", "Product reveal should be followed by a short close-up.", "Phase 19 story rule again");
    const again = ((repeat.knowledge ?? []) as KnowledgeRecord[]).find((r) => (r.structuredData.creativePattern as CreativePattern | undefined)?.family === "STORYTELLING")!;
    expect(["DUPLICATE", "KNOWN"]).toContain(again.novelty.class);

    const pace = await teachText(center, "PRODUCT_SLIDESHOW", "Higher energy means faster pacing.", "Phase 19 pacing rule");
    const paceRecord = ((pace.knowledge ?? []) as KnowledgeRecord[]).find((r) => (r.structuredData.creativePattern as CreativePattern | undefined)?.family === "PACING")!;
    const v2 = await commitAndActivate(center, pace.sessionId, { datasetId: v1.datasetId, accept: [paceRecord.id] });
    expect(v2.version).toBe(2);
    const p2 = (await crossModal(center, v1.datasetId)).measured as { with: { timeline: string[] }; musicEnergy: string };
    expect(p2.musicEnergy).toBe("HIGH");
    expect(p2.with.timeline[2]).toMatch(/CLOSE_UP\/close-up/);

    const off = await center.waitForJob(center.deactivate(v1.datasetId, "tester").jobId);
    expect(off.status).toBe("COMPLETED");
    const gone = await crossModal(center, v1.datasetId);
    expect(gone.usesTeaching).toBe(false);

    const back = await center.waitForJob(center.rollback(v1.datasetId, 1, "tester").jobId);
    expect(back.status, JSON.stringify(back.error)).toBe("COMPLETED");
    const restored = (await crossModal(center, v1.datasetId)).measured as { with: { storySequence: string[]; timeline: string[] } };
    expect(restored.with.storySequence).toContain("CLOSE_UP");
    expect(center.knowledgeFlow().find((f) => f.datasetId === v1.datasetId)).toMatchObject({ activeVersion: 1, activated: 1 });
  }, 120_000);
});
