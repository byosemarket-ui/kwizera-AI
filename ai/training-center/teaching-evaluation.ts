/**
 * Phase 18 — evaluation of a dataset version before activation.
 * Every check runs real code: the package is chunked and validated like the pipeline does, retrieved against
 * a copy of the live index with the runtime query of its task, guidance is resolved exactly as the planners
 * resolve it, and the deterministic planners (canvas fit, audio fit, typography) run with the candidate values.
 * Checks that cannot be measured on this server are SKIPPED with the reason — never scored.
 */
import { chunkDocument } from "../knowledge-processing-engine/knowledge-chunker.js";
import { validateKnowledgeChunk, type KnowledgeGuidance } from "../knowledge-validation-engine/knowledge-evidence.js";
import { HybridKnowledgeIndex, type KnowledgeIndexDoc } from "../knowledge-retrieval-engine/hybrid-knowledge-index.js";
import { buildTaskKnowledgeContext } from "../knowledge-retrieval-engine/knowledge-context-builder.js";
import type { KnowledgeTask } from "../knowledge-retrieval-engine/knowledge-taxonomy.js";
import { planCanvasFit } from "../video-production/canvas-fit.js";
import { planAudioFit } from "../video-production/audio-fit.js";
import type { VerifiedFont } from "../typography/types.js";
import { capabilityById, TASK_RUNTIME_QUERY, TASK_RUNTIME_SPECS, type CapabilityDefinition } from "./training-catalog.js";
import type { TeachingPackage } from "./teaching-package.js";
import { aspectLabel } from "./teaching-media.js";
import type { DatasetVersion, EvaluationCase, EvaluationCheck, TeachingDataset, TeachingRecord } from "./training-types.js";

export interface EvaluationInput {
  dataset: TeachingDataset;
  version: DatasetVersion;
  pkg: TeachingPackage;
  /** Active docs of the live index, excluding every source of this dataset. */
  liveDocs: KnowledgeIndexDoc[];
  supersedes: string[];
  loadFonts: () => Promise<VerifiedFont[]>;
  now: Date;
}

const FRAME: Record<string, { w: number; h: number }> = {
  "9:16": { w: 1080, h: 1920 }, "16:9": { w: 1920, h: 1080 }, "1:1": { w: 1080, h: 1080 }, "4:5": { w: 1080, h: 1350 },
};

const CANDIDATE_SOURCE = "candidate-package";

function candidateDocs(input: EvaluationInput): { docs: KnowledgeIndexDoc[]; rejectedBySection: Map<string, number>; keptBySection: Map<string, number> } {
  const { pkg, dataset, now } = input;
  const docs: KnowledgeIndexDoc[] = [];
  const rejectedBySection = new Map<string, number>();
  const keptBySection = new Map<string, number>();
  chunkDocument(pkg.markdown).forEach((chunk, index) => {
    const section = chunk.headingPath[1] ?? chunk.headingPath[0] ?? "";
    const evidence = validateKnowledgeChunk({
      text: chunk.text,
      provenance: { sourceId: CANDIDATE_SOURCE, title: pkg.title, retrievedAt: now.toISOString(), sourceType: "INTERNAL_DOCUMENT" },
      now,
    });
    if (evidence.status === "REJECTED") {
      rejectedBySection.set(section, (rejectedBySection.get(section) ?? 0) + 1);
      return;
    }
    keptBySection.set(section, (keptBySection.get(section) ?? 0) + 1);
    const guidance: KnowledgeGuidance[] = chunk.headingPath.flatMap((h) => pkg.guidanceBySection[h] ?? []);
    docs.push({
      id: `candidate-${index}`,
      sourceId: CANDIDATE_SOURCE,
      title: pkg.title,
      text: chunk.text,
      domain: pkg.domain,
      topics: pkg.topics,
      sourceType: "INTERNAL_DOCUMENT",
      trust: "TRUSTED",
      validationStatus: evidence.status,
      tenantId: null,
      projectId: dataset.scope === "PROJECT" ? dataset.projectId : null,
      observedAt: now.toISOString(),
      headingPath: chunk.headingPath,
      citation: { sourceId: CANDIDATE_SOURCE, title: pkg.title, section: chunk.headingPath[chunk.headingPath.length - 1] },
      guidance,
      supersedes: input.supersedes,
      guidanceTasks: [capabilityById(dataset.capability)?.task ?? "GENERAL"],
      active: true,
    });
  });
  return { docs, rejectedBySection, keptBySection };
}

async function retrieveWithCandidate(index: HybridKnowledgeIndex, task: KnowledgeTask, query: string, projectId: string | null, now: Date) {
  const result = await index.search({ query, task, projectId, tenantId: null });
  const specs = (TASK_RUNTIME_SPECS[task] ?? []).map((s) => ({ key: s.key, min: s.min, max: s.max, default: s.default }));
  return buildTaskKnowledgeContext({ task, query, result, guidanceSpecs: specs, now });
}

const isCandidate = (id: string) => id.startsWith("candidate-");

const CLAIM_WORDS = /\b(best|#1|number one|guaranteed?|clinically proven|certified|award[- ]winning|cheapest|fastest|100% natural|miracle|cure[sd]?)\b/gi;
const NUMBER_TOKEN = /[$€£¥]?\d+(?:[.,]\d+)?\s?(?:%|x\b|mah\b|gb\b|tb\b|kg\b|g\b|ml\b|l\b|cm\b|mm\b|inch(?:es)?\b|hrs?\b|hours?\b|days?\b|years?\b|w\b)?/gi;

/** Values and strong claims in the output that are not supported by the input. */
export function inventedClaims(input: string, output: string): string[] {
  const haystack = input.toLowerCase().replace(/\s+/g, " ");
  const numbersIn = new Set((input.match(NUMBER_TOKEN) ?? []).map((t) => t.replace(/[^\d.,]/g, "").replace(",", ".")));
  const invented: string[] = [];
  for (const token of output.match(NUMBER_TOKEN) ?? []) {
    const n = token.replace(/[^\d.,]/g, "").replace(",", ".");
    if (n && !numbersIn.has(n)) invented.push(token.trim());
  }
  for (const word of output.match(CLAIM_WORDS) ?? []) {
    if (!haystack.includes(word.toLowerCase())) invented.push(word);
  }
  return [...new Set(invented)];
}

function guidanceValue(version: DatasetVersion, key: string): number | undefined {
  return version.guidance.find((g) => g.key === key)?.value;
}

function check(partial: EvaluationCheck): EvaluationCheck {
  return partial;
}

function compositionChecks(minSafe: number | undefined, cases: Array<{ record?: TeachingRecord; c: Extract<EvaluationCase, { check: "PRODUCT_VISIBILITY" }> }>): EvaluationCheck[] {
  const out: EvaluationCheck[] = [];
  const run = (w: number, h: number, aspect: string) => {
    const frame = FRAME[aspect] ?? FRAME["9:16"]!;
    return planCanvasFit({ sceneId: "eval", assetId: "eval", sourceWidth: w, sourceHeight: h, frameWidth: frame.w, frameHeight: frame.h, targetAspect: aspect, framing: null, minSafeCoverage: minSafe ?? null });
  };
  const square = run(1080, 1080, "9:16");
  out.push(check({
    id: "REGRESSION_SQUARE_TO_VERTICAL", label: "Square product photo in a vertical video keeps the whole product", category: "REGRESSION",
    status: square.strategy === "SOFT_EXTEND" ? "PASSED" : "FAILED",
    detail: `${square.strategy}: a cover crop would keep ${(square.sourceCoverage * 100).toFixed(0)}% of the photo. ${square.reason}`,
    measured: { strategy: square.strategy, sourceCoverage: square.sourceCoverage, minSafeCoverage: minSafe ?? 0.8 },
  }));
  const native = run(1080, 1920, "9:16");
  out.push(check({
    id: "REGRESSION_NATIVE_VERTICAL", label: "Vertical photo in a vertical video is not needlessly extended", category: "REGRESSION",
    status: native.strategy === "COVER_CROP" ? "PASSED" : "FAILED",
    detail: `${native.strategy}. ${native.reason}`,
    measured: { strategy: native.strategy, sourceCoverage: native.sourceCoverage },
  }));
  for (const { record, c } of cases) {
    const plan = run(c.sourceWidth, c.sourceHeight, c.aspect);
    const kept = plan.strategy === "SOFT_EXTEND" || plan.sourceCoverage >= (minSafe ?? 0.8);
    out.push(check({
      id: "PRODUCT_VISIBILITY", label: `Product stays visible: ${c.sourceWidth}×${c.sourceHeight} → ${c.aspect}`, category: "VIDEO",
      status: kept ? "PASSED" : "FAILED", recordId: record?.recordId,
      detail: `${plan.strategy}, cover crop would keep ${(plan.sourceCoverage * 100).toFixed(0)}% of the photo.`,
      measured: { strategy: plan.strategy, sourceCoverage: plan.sourceCoverage },
    }));
  }
  return out;
}

function audioChecks(version: DatasetVersion, cases: Array<{ record?: TeachingRecord; c: Extract<EvaluationCase, { check: "AUDIO_COVERAGE" }> }>): EvaluationCheck[] {
  const guidance = { loopCrossfadeSec: guidanceValue(version, "audio.loopCrossfadeSec"), fadeOutSec: guidanceValue(version, "audio.fadeOutSec") };
  const out: EvaluationCheck[] = [];
  const loop = planAudioFit({ sourceDurationSec: 20, targetDurationSec: 45, analysis: { bpm: 120 }, guidance });
  out.push(check({
    id: "REGRESSION_AUDIO_LOOP", label: "Short music covers a longer video on a musical boundary", category: "REGRESSION",
    status: loop.strategy === "LOOP_EXTEND" && loop.coveredDurationSec >= 44.95 && loop.crossfadeSec <= 0.25 && loop.beatAnalysisUsed ? "PASSED" : "FAILED",
    detail: `${loop.strategy}, covers ${loop.coveredDurationSec}s of 45s, crossfade ${loop.crossfadeSec}s on a ${loop.boundaryBasis} boundary.`,
    measured: { strategy: loop.strategy, coveredDurationSec: loop.coveredDurationSec, crossfadeSec: loop.crossfadeSec, boundaryBasis: loop.boundaryBasis },
  }));
  const voice = planAudioFit({ sourceDurationSec: 20, targetDurationSec: 45, allowLoop: false, guidance });
  out.push(check({
    id: "REGRESSION_VOICE_NO_LOOP", label: "Voice audio is never repeated", category: "REGRESSION",
    status: voice.strategy === "PAD_SILENCE" && voice.repeats === 1 ? "PASSED" : "FAILED",
    detail: `${voice.strategy}, repeats ${voice.repeats}.`,
  }));
  const trim = planAudioFit({ sourceDurationSec: 90, targetDurationSec: 30, guidance });
  const endsWithVideo = Math.abs(trim.fadeOutStartSec + trim.fadeOutSec - 30) < 0.01;
  out.push(check({
    id: "REGRESSION_AUDIO_TRIM", label: "Long music fades out and ends exactly with the video", category: "REGRESSION",
    status: trim.strategy === "TRIM_FADE" && endsWithVideo && trim.fadeOutSec <= 3 ? "PASSED" : "FAILED",
    detail: `${trim.strategy}, fade ${trim.fadeOutSec}s from ${trim.fadeOutStartSec}s.`,
    measured: { fadeOutSec: trim.fadeOutSec, fadeOutStartSec: trim.fadeOutStartSec },
  }));
  for (const { record, c } of cases) {
    const plan = planAudioFit({ sourceDurationSec: c.sourceDurationSec, targetDurationSec: c.targetDurationSec, analysis: c.bpm ? { bpm: c.bpm } : null, allowLoop: !c.voice, guidance });
    const ok = c.voice ? plan.repeats === 1 : plan.coveredDurationSec >= Math.min(c.targetDurationSec, c.sourceDurationSec >= 4 ? c.targetDurationSec : c.sourceDurationSec) - 0.05;
    out.push(check({
      id: "AUDIO_COVERAGE", label: `Audio ${c.sourceDurationSec}s fitted to ${c.targetDurationSec}s video`, category: "AUDIO",
      status: ok ? "PASSED" : "FAILED", recordId: record?.recordId,
      detail: `${plan.strategy}, covers ${plan.coveredDurationSec}s, fade-out ${plan.fadeOutSec}s. ${plan.reason}`,
      measured: { strategy: plan.strategy, coveredDurationSec: plan.coveredDurationSec },
    }));
  }
  return out;
}

async function typographyChecks(version: DatasetVersion, loadFonts: () => Promise<VerifiedFont[]>, cases: Array<{ record?: TeachingRecord; c: Extract<EvaluationCase, { check: "TYPOGRAPHY_HIERARCHY" }> }>): Promise<EvaluationCheck[]> {
  const fonts = await loadFonts().catch(() => [] as VerifiedFont[]);
  if (!fonts.length) {
    return [check({ id: "TYPOGRAPHY_REGRESSION", label: "Typography planner regression", category: "TYPOGRAPHY", status: "SKIPPED", detail: "No verified fonts are installed on this server, so the typography planner cannot run." })];
  }
  const { composeTypographyDecision } = await import("../typography/typography-engine.js");
  const maxItems = guidanceValue(version, "typography.maxItemsPerScene");
  const maxCta = guidanceValue(version, "typography.maxItemsCtaScene");
  const guidance = { maxItemsPerScene: maxItems, maxItemsCtaScene: maxCta };
  const compose = (aspect: "9:16" | "16:9" | "1:1" | "4:5", scenes: Parameters<typeof composeTypographyDecision>[0]["scenes"], productName: string) => {
    const frame = FRAME[aspect]!;
    return composeTypographyDecision({ projectId: "training-evaluation", productName, width: frame.w, height: frame.h, aspectRatio: aspect, platform: "tiktok", scenes, guidance }, fonts);
  };
  const out: EvaluationCheck[] = [];
  const decision = await compose("9:16", [
    { sceneId: "hook", purpose: "hook", texts: [{ role: "headline", text: "Aurora Wireless Earbuds" }, { role: "subtitle", text: "All-day comfort" }, { role: "benefit", text: "Clear calls anywhere" }, { role: "supporting", text: "Water resistant design" }] },
    { sceneId: "cta", purpose: "cta", texts: [{ role: "productName", text: "Aurora Earbuds" }, { role: "price", text: "$49" }, { role: "cta", text: "Shop now" }, { role: "supporting", text: "Free delivery" }] },
  ], "Aurora Wireless Earbuds");
  const hook = decision.scenes.find((s) => s.sceneId === "hook");
  const cta = decision.scenes.find((s) => s.sceneId === "cta");
  const limit = maxItems ?? 3;
  const ctaLimit = maxCta ?? 4;
  const validationErrors = decision.warnings.filter((w) => w.startsWith("validation:"));
  out.push(check({
    id: "REGRESSION_TYPOGRAPHY_DENSITY", label: "Text density respects the per-scene limit and keeps the headline", category: "REGRESSION",
    status: hook && hook.items.length <= limit && hook.items.some((i) => i.role === "headline") && validationErrors.length === 0 ? "PASSED" : "FAILED",
    detail: `Hook scene: ${hook?.items.length ?? 0} items (limit ${limit}); headline ${hook?.items.some((i) => i.role === "headline") ? "kept" : "missing"}.${validationErrors.length ? ` ${validationErrors.join("; ")}` : ""}`,
    measured: { items: hook?.items.map((i) => i.role), limit },
  }));
  out.push(check({
    id: "REGRESSION_TYPOGRAPHY_CTA", label: "Closing scene keeps the call to action", category: "REGRESSION",
    status: cta && cta.items.length <= ctaLimit && cta.items.some((i) => i.role === "cta") ? "PASSED" : "FAILED",
    detail: `CTA scene: ${cta?.items.map((i) => i.role).join(", ") || "no items"} (limit ${ctaLimit}).`,
    measured: { items: cta?.items.map((i) => i.role), limit: ctaLimit },
  }));
  for (const { record, c } of cases) {
    const texts: Array<{ role: "headline" | "price" | "cta"; text: string }> = [{ role: "headline", text: c.productName }];
    if (c.price) texts.push({ role: "price", text: c.price });
    if (c.cta) texts.push({ role: "cta", text: c.cta });
    const d = await compose(c.aspect, [{ sceneId: "case", purpose: c.cta ? "cta" : "hook", texts }], c.productName);
    const items = d.scenes[0]?.items ?? [];
    const head = items.find((i) => i.role === "headline");
    const largest = Math.max(0, ...items.map((i) => i.size.fontSizePx));
    const missing = texts.filter((t) => !items.some((i) => i.role === t.role)).map((t) => t.role);
    out.push(check({
      id: "TYPOGRAPHY_HIERARCHY", label: `Hierarchy: ${c.productName}`, category: "TYPOGRAPHY", recordId: record?.recordId,
      status: head && head.size.fontSizePx >= largest - 0.5 && !missing.length ? "PASSED" : "FAILED",
      detail: head ? `Product name ${head.size.fontSizePx}px (largest ${largest}px)${missing.length ? `; missing ${missing.join(", ")}` : ""}.` : "Product name was not placed.",
      measured: { items: items.map((i) => ({ role: i.role, fontSizePx: i.size.fontSizePx, readable: i.visual.readabilityPassed })) },
    }));
  }
  return out;
}

function mediaChecks(record: TeachingRecord): EvaluationCheck[] {
  const out: EvaluationCheck[] = [];
  const declared = record.declared ?? {};
  for (const media of record.media) {
    const a = media.analysis;
    if (!a) continue;
    if (media.kind === "VIDEO" || media.kind === "IMAGE") {
      if (declared.aspectRatio && a.width && a.height) {
        const measured = aspectLabel(a.width, a.height);
        out.push(check({
          id: "DECLARED_ASPECT", label: `${media.fileName}: aspect ratio`, category: "MEDIA", recordId: record.recordId,
          status: measured === declared.aspectRatio ? "PASSED" : "FAILED",
          detail: `Declared ${declared.aspectRatio}, measured ${measured} (${a.width}×${a.height}). Measured values are authoritative.`,
        }));
      }
      if (media.kind === "IMAGE" && a.width && a.height) {
        const plan = planCanvasFit({ sceneId: "eval", assetId: media.mediaId, sourceWidth: a.width, sourceHeight: a.height, frameWidth: 1080, frameHeight: 1920, targetAspect: "9:16", framing: null });
        out.push(check({
          id: "IMAGE_VERTICAL_FIT", label: `${media.fileName}: vertical video layout`, category: "VIDEO", recordId: record.recordId, status: "PASSED",
          detail: `${plan.strategy} in 9:16 (cover crop would keep ${(plan.sourceCoverage * 100).toFixed(0)}% of the image).`,
          measured: { strategy: plan.strategy, sourceCoverage: plan.sourceCoverage },
        }));
      }
    }
    if (media.kind === "VIDEO") {
      if (declared.durationSec && a.durationSec) {
        const tolerance = Math.max(0.5, declared.durationSec * 0.03);
        out.push(check({
          id: "DECLARED_DURATION", label: `${media.fileName}: duration`, category: "VIDEO", recordId: record.recordId,
          status: Math.abs(a.durationSec - declared.durationSec) <= tolerance ? "PASSED" : "FAILED",
          detail: `Declared ${declared.durationSec}s, measured ${a.durationSec}s.`,
        }));
      }
      out.push(check({
        id: "VIDEO_PRODUCT_VISIBILITY", label: `${media.fileName}: product visibility in frames`, category: "VIDEO", recordId: record.recordId, status: "SKIPPED",
        detail: "Product visibility inside video frames is not measured: no product detector runs on teaching videos.",
      }));
    }
    const audio = a.audio;
    if (audio) {
      out.push(check({
        id: "AUDIO_SIGNAL", label: `${media.fileName}: audio signal`, category: "AUDIO", recordId: record.recordId,
        status: !audio.silent && audio.clippedRatio <= 0.001 ? "PASSED" : "FAILED",
        detail: audio.silent ? "The audio is silent." : `Loudness ${audio.rmsDbfs ?? "?"} dBFS RMS, peak ${audio.peakDbfs ?? "?"} dBFS, clipped samples ${(audio.clippedRatio * 100).toFixed(3)}%.`,
        measured: { rmsDbfs: audio.rmsDbfs, peakDbfs: audio.peakDbfs, clippedRatio: audio.clippedRatio },
      }));
      if (declared.bpm) {
        const bpm = audio.bpm;
        const matches = bpm !== null && [1, 2, 0.5].some((m) => Math.abs(bpm * m - declared.bpm!) <= 3);
        out.push(check({
          id: "DECLARED_BPM", label: `${media.fileName}: tempo`, category: "AUDIO", recordId: record.recordId,
          status: matches ? "PASSED" : "FAILED",
          detail: `Declared ${declared.bpm} BPM, measured ${bpm ? Math.round(bpm) : "no reliable tempo"} (${audio.tempoStatus}). Measured values are authoritative.`,
        }));
      }
    }
  }
  if (record.kind === "AUDIO_VIDEO_PAIR") {
    const video = record.media.find((m) => m.kind === "VIDEO")?.analysis;
    const audio = record.media.find((m) => m.kind === "AUDIO")?.analysis?.audio;
    if (video?.durationSec && audio) {
      const plan = planAudioFit({ sourceDurationSec: audio.durationSec, targetDurationSec: video.durationSec, analysis: { bpm: audio.bpm, beats: audio.firstBeats.map((time) => ({ time })) } });
      out.push(check({
        id: "AUDIO_VIDEO_SYNC", label: "Audio fitted to the paired video", category: "AUDIO", recordId: record.recordId,
        status: plan.coveredDurationSec >= Math.min(video.durationSec, audio.durationSec >= 4 ? video.durationSec : audio.durationSec) - 0.05 ? "PASSED" : "FAILED",
        detail: `Audio ${audio.durationSec}s, video ${video.durationSec}s → ${plan.strategy}. ${plan.reason}`,
        measured: { strategy: plan.strategy, coveredDurationSec: plan.coveredDurationSec },
      }));
      if (audio.bpm && video.sceneChanges?.length) {
        const beat = 60 / audio.bpm;
        const offset = audio.firstBeats[0] ?? 0;
        const near = video.sceneChanges.filter((t) => {
          const phase = Math.abs(((t - offset) % beat + beat) % beat);
          return Math.min(phase, beat - phase) <= 0.08;
        }).length;
        out.push(check({
          id: "BEAT_ALIGNMENT", label: "Reference cuts measured against the beat grid", category: "AUDIO", recordId: record.recordId, status: "PASSED",
          detail: `${near} of ${video.sceneChanges.length} scene cuts fall within ±80 ms of the measured ${Math.round(audio.bpm)} BPM grid (measurement, not a score).`,
          measured: { cuts: video.sceneChanges.length, onBeat: near, bpm: audio.bpm },
        }));
      }
    }
  }
  return out;
}

export async function evaluateVersion(input: EvaluationInput): Promise<EvaluationCheck[]> {
  const { dataset, version } = input;
  const capability = capabilityById(dataset.capability) as CapabilityDefinition;
  const checks: EvaluationCheck[] = [];

  checks.push(check({
    id: "VERSION_VALID", label: "Dataset version passed validation", category: "STRUCTURE",
    status: version.status === "VALID" ? "PASSED" : "FAILED",
    detail: version.status === "VALID" ? `${version.recordCount} records validated.` : `Version status is ${version.status}.`,
  }));

  const { docs, rejectedBySection, keptBySection } = candidateDocs(input);
  const unindexable = input.pkg.sections.filter((s) => !keptBySection.get(s.heading));
  checks.push(check({
    id: "PACKAGE_INDEXABLE", label: "Every record produces indexable knowledge", category: "STRUCTURE",
    status: unindexable.length || !docs.length ? "FAILED" : "PASSED",
    detail: unindexable.length
      ? `${unindexable.length} record(s) produced no indexable text: ${unindexable.map((s) => s.heading).join("; ")}.`
      : `${docs.length} chunks from ${input.pkg.sections.length} records${[...rejectedBySection.values()].reduce((a, b) => a + b, 0) ? `; ${[...rejectedBySection.values()].reduce((a, b) => a + b, 0)} low-quality chunks would be rejected` : ""}.`,
  }));

  const outside = version.guidance.filter((g) => !capability.guidanceKeys.includes(g.key));
  checks.push(check({
    id: "GUIDANCE_ISOLATION", label: "Guidance only targets this capability", category: "ISOLATION",
    status: outside.length ? "FAILED" : "PASSED",
    detail: outside.length ? `Not allowed: ${outside.map((g) => g.key).join(", ")}.` : version.guidance.length ? `Guidance: ${version.guidance.map((g) => `${g.key}=${g.value}`).join(", ")}.` : "No planner guidance in this version.",
  }));

  const index = new HybridKnowledgeIndex(null, () => input.now);
  for (const doc of input.liveDocs) index.upsert(doc);
  for (const doc of docs) index.upsert(doc);
  const projectId = dataset.scope === "PROJECT" ? dataset.projectId : null;

  const task = capability.task;
  const topic = version.records.slice(0, 3).map((r) => r.title).join(" ");
  const runtime = await retrieveWithCandidate(index, task, TASK_RUNTIME_QUERY[task], projectId, input.now);
  const retrievedRuntime = runtime.items.filter((i) => isCandidate(i.id)).length;
  const topical = await retrieveWithCandidate(index, task, `${topic} ${TASK_RUNTIME_QUERY[task]}`.slice(0, 480), projectId, input.now);
  const retrievedTopical = topical.items.filter((i) => isCandidate(i.id)).length;
  checks.push(check({
    id: "RETRIEVED_FOR_TASK", label: `Retrieved by the ${task} runtime query`, category: "RETRIEVAL",
    status: retrievedRuntime + retrievedTopical > 0 ? "PASSED" : "FAILED",
    detail: `${retrievedRuntime} of ${runtime.items.length} items for the generic runtime query and ${retrievedTopical} of ${topical.items.length} for a topical query come from this version.`,
    measured: { runtimeItems: runtime.items.map((i) => i.title), topicalItems: topical.items.map((i) => i.title) },
  }));

  for (const g of version.guidance) {
    const resolved = runtime.guidance.find((r) => r.key === g.key) ?? topical.guidance.find((r) => r.key === g.key);
    const fromCandidate = resolved?.basis === "KNOWLEDGE" && resolved.sourceItemIds.some(isCandidate);
    checks.push(check({
      id: "GUIDANCE_APPLIED", label: `${g.key} reaches the planner`, category: "GUIDANCE",
      status: fromCandidate && resolved?.value === g.value ? "PASSED" : "FAILED",
      detail: !resolved
        ? "The runtime does not resolve this key for this task."
        : fromCandidate
          ? `Planner would use ${resolved.value} from this version.`
          : `Planner would use ${resolved.value} (${resolved.basis}); this version's value ${g.value} does not win${resolved.basis === "DISPUTED_DEFAULT" ? " because equally trusted sources disagree" : ""}.`,
      measured: resolved ? { value: resolved.value, basis: resolved.basis } : undefined,
    }));
  }

  const baseline = new HybridKnowledgeIndex(null, () => input.now);
  for (const doc of input.liveDocs) baseline.upsert(doc);
  const otherTasks = (Object.keys(TASK_RUNTIME_SPECS) as KnowledgeTask[]).filter((t) => t !== task);
  const leaks: string[] = [];
  for (const other of otherTasks) {
    const query = `${topic} ${TASK_RUNTIME_QUERY[other]}`.slice(0, 480);
    const withCandidate = await retrieveWithCandidate(index, other, query, projectId, input.now);
    const without = await retrieveWithCandidate(baseline, other, query, projectId, input.now);
    for (const g of withCandidate.guidance) {
      const before = without.guidance.find((b) => b.key === g.key);
      const fromCandidate = g.basis === "KNOWLEDGE" && g.sourceItemIds.some(isCandidate);
      if (fromCandidate || before?.value !== g.value || before?.basis !== g.basis) leaks.push(`${other}:${g.key}`);
    }
  }
  checks.push(check({
    id: "UNRELATED_CAPABILITIES_UNCHANGED", label: "Other capabilities' planner settings are unchanged", category: "ISOLATION",
    status: leaks.length ? "FAILED" : "PASSED",
    detail: leaks.length ? `This version would change: ${leaks.join(", ")}.` : `Checked ${otherTasks.join(", ")}.`,
  }));

  if (dataset.scope === "PROJECT") {
    const foreign = await index.search({ query: `${topic} ${TASK_RUNTIME_QUERY[task]}`, task, projectId: "evaluation-other-project", tenantId: null });
    const visible = foreign.hits.filter((h) => isCandidate(h.doc.id)).length;
    checks.push(check({
      id: "PROJECT_ISOLATION", label: "Invisible to other projects", category: "ISOLATION",
      status: visible ? "FAILED" : "PASSED",
      detail: visible ? `${visible} items were visible from another project.` : "No items are visible from another project.",
    }));
  }

  const evalCases = version.records.filter((r) => r.kind === "EVALUATION_CASE" && r.evalCase).map((r) => ({ record: r, c: r.evalCase! }));
  const pick = <K extends EvaluationCase["check"]>(k: K) => evalCases.filter((e) => e.c.check === k) as Array<{ record: TeachingRecord; c: Extract<EvaluationCase, { check: K }> }>;

  const keys = new Set(capability.guidanceKeys);
  if ([...keys].some((k) => k.startsWith("composition.")) || pick("PRODUCT_VISIBILITY").length) {
    checks.push(...compositionChecks(guidanceValue(version, "composition.minSafeCoverage"), pick("PRODUCT_VISIBILITY")));
  }
  if ([...keys].some((k) => k.startsWith("audio.")) || pick("AUDIO_COVERAGE").length) checks.push(...audioChecks(version, pick("AUDIO_COVERAGE")));
  if ([...keys].some((k) => k.startsWith("typography.")) || pick("TYPOGRAPHY_HIERARCHY").length) {
    checks.push(...await typographyChecks(version, input.loadFonts, pick("TYPOGRAPHY_HIERARCHY")));
  }

  for (const { record, c } of pick("RETRIEVAL")) {
    const ctx = await retrieveWithCandidate(index, task, c.query, projectId, input.now);
    const hit = ctx.items.some((i) => isCandidate(i.id));
    checks.push(check({
      id: "RETRIEVAL_CASE", label: `Retrieval: "${c.query.slice(0, 60)}"`, category: "RETRIEVAL", recordId: record.recordId,
      status: hit ? "PASSED" : "FAILED", detail: hit ? "This version is retrieved for the query." : `Retrieved instead: ${ctx.items.map((i) => i.title).slice(0, 3).join("; ") || "nothing"}.`,
    }));
  }
  for (const { record, c } of pick("TEXT_GROUNDING")) {
    const invented = inventedClaims(c.input, c.output);
    checks.push(check({
      id: "TEXT_GROUNDING", label: "Output only uses facts from the input", category: "TEXT", recordId: record.recordId,
      status: invented.length ? "FAILED" : "PASSED", detail: invented.length ? `Unsupported values or claims: ${invented.join(", ")}.` : "No unsupported values or claims.",
    }));
  }

  const learned = version.records.filter((r) => r.knowledge);
  if (learned.length) {
    const noProvenance = learned.filter((r) => !r.knowledge!.sourceLocations.length);
    checks.push(check({
      id: "KNOWLEDGE_PROVENANCE", label: "Learned knowledge keeps its source provenance", category: "KNOWLEDGE",
      status: noProvenance.length ? "FAILED" : "PASSED",
      detail: noProvenance.length ? `${noProvenance.length} learned record(s) have no source location.` : `${learned.length} learned record(s), ${learned.reduce((a, r) => a + r.knowledge!.sourceLocations.length, 0)} source locations.`,
    }));
    const unresolved = learned.filter((r) => r.knowledge!.conflictAccepted && r.review?.decision !== "APPROVED");
    checks.push(check({
      id: "KNOWLEDGE_CONFLICTS_REVIEWED", label: "Contradictions were reviewed before publishing", category: "KNOWLEDGE",
      status: unresolved.length ? "FAILED" : "PASSED",
      detail: unresolved.length ? `${unresolved.length} contradictory item(s) lack reviewer approval.` : `${learned.filter((r) => r.knowledge!.conflictAccepted).length} accepted contradiction(s), all approved.`,
    }));
    const missed: string[] = [];
    for (const r of learned.slice(0, 25)) {
      const ctx = await retrieveWithCandidate(index, task, `${r.title} ${r.knowledge!.statement}`.slice(0, 480), projectId, input.now);
      const own = input.pkg.sections.find((s) => s.recordId === r.recordId)?.heading;
      if (!ctx.items.some((i) => isCandidate(i.id) && (!own || i.citation.section === own || i.title.includes(own)))) missed.push(r.title);
    }
    const probed = Math.min(25, learned.length);
    checks.push(check({
      id: "KNOWLEDGE_RETRIEVABLE", label: "Learned statements are retrievable by their own content", category: "RETRIEVAL",
      // Retrieval returns at most two items per source, so near-duplicates can shadow each other; ≥80% is required.
      status: probed - missed.length >= Math.ceil(probed * 0.8) ? "PASSED" : "FAILED",
      detail: missed.length ? `Not retrieved: ${missed.slice(0, 5).join("; ")}${missed.length > 5 ? ` and ${missed.length - 5} more` : ""}.` : `${Math.min(25, learned.length)} learned statement(s) retrieved for their own queries.`,
    }));
    const measured = learned.filter((r) => r.knowledge!.method === "MEASURED");
    const unsupported = measured.filter((r) => !r.knowledge!.evidence.some((e) => e.kind === "MEASUREMENT"));
    if (measured.length) {
      checks.push(check({
        id: "KNOWLEDGE_MEASURED_EVIDENCE", label: "Media knowledge is backed by measurements", category: "KNOWLEDGE",
        status: unsupported.length ? "FAILED" : "PASSED",
        detail: unsupported.length ? `${unsupported.length} media-derived item(s) have no measurement evidence.` : `${measured.length} media-derived item(s) carry measurement evidence.`,
      }));
    }
  }

  for (const record of version.records) {
    if ((record.kind === "EXAMPLE" || record.kind === "INSTRUCTION") && record.expectedOutput.trim() && (record.input.trim() || record.instruction.trim())) {
      const invented = inventedClaims(`${record.input}\n${record.instruction}`, record.expectedOutput);
      checks.push(check({
        id: "EXAMPLE_GROUNDING", label: `${record.title}: expected output is grounded in the input`, category: "TEXT", recordId: record.recordId,
        status: invented.length ? "FAILED" : "PASSED",
        detail: invented.length ? `Expected output introduces values or claims not in the input: ${invented.join(", ")}.` : "No invented values or claims.",
      }));
    }
    if (record.kind === "CODE") {
      checks.push(check({
        id: "CODE_METADATA", label: `${record.title}: code metadata`, category: "CODE", recordId: record.recordId,
        status: record.code?.language ? "PASSED" : "FAILED", detail: `Language ${record.code?.language || "missing"}${record.code?.framework ? `, ${record.code.framework}` : ""}.`,
      }));
      checks.push(check({
        id: "CODE_EXECUTION", label: `${record.title}: behaviour test`, category: "CODE", recordId: record.recordId, status: "SKIPPED",
        detail: "Not executed: uploaded code is never run on this server.",
      }));
    }
    checks.push(...mediaChecks(record));
  }
  return checks;
}

export function summarizeChecks(checks: EvaluationCheck[]): { status: "PASSED" | "FAILED"; summary: { passed: number; failed: number; skipped: number } } {
  const summary = {
    passed: checks.filter((c) => c.status === "PASSED").length,
    failed: checks.filter((c) => c.status === "FAILED").length,
    skipped: checks.filter((c) => c.status === "SKIPPED").length,
  };
  const retrieval = checks.some((c) => c.category === "RETRIEVAL" && c.status === "PASSED");
  return { status: summary.failed === 0 && retrieval ? "PASSED" : "FAILED", summary };
}
