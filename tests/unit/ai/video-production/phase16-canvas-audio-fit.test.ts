import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { buildFramingInspection } from "../../../../ai/product-asset-preparation/framing.js";
import {
  applyCanvasFitToClip,
  canvasFitFilter,
  coverWindow,
  planCanvasFit,
} from "../../../../ai/video-production/canvas-fit.js";
import { buildAudioFitFilter, MIN_LOOPABLE_SEC, planAudioFit } from "../../../../ai/video-production/audio-fit.js";
import {
  ffmpegAvailable,
  ffmpegBinary,
  ffprobeAvailable,
  muxAudioOntoVideo,
  stillFilter,
} from "../../../../ai/video-production/ffmpeg-renderer.js";
import { buildRenderPlan } from "../../../../ai/video-production/plan-to-timeline.js";
import type { VideoTimelineClip } from "../../../../ai/video-production/types.js";
import { runDeterministicPmvQa } from "../../../../ai/pmv-shared/qa.js";
import { classifyPmvQaFailure } from "../../../../ai/pmv-shared/classify-failure.js";
import { PRODUCT_IDENTITY_LOCK_VERSION, type ProductIdentityLock } from "../../../../ai/pmv-shared/identity-lock-types.js";
import { computeAssetFingerprint } from "../../../../ai/pmv-shared/build-lock.js";

const execFileAsync = promisify(execFile);
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

function clip(overrides: Partial<VideoTimelineClip> = {}): VideoTimelineClip {
  return {
    id: "s1",
    sceneId: "s1",
    order: 1,
    purpose: "HERO",
    assetId: "a1",
    startMs: 0,
    durationMs: 3000,
    layer: "video",
    camera: "hero",
    motion: "pan-left",
    lighting: "studio",
    background: "product still",
    transitionIn: "cut",
    transitionOut: "fade",
    text: [],
    audioDirection: "",
    motionParams: {
      maxZoom: 1.12,
      focusX: 0.5,
      focusY: 0.5,
      intensity: 0.6,
      directedType: "PAN",
      framingBasis: "measured-bbox",
      safetyAdjusted: false,
      fallbackUsed: false,
      cropFocusX: 0.5,
      cropFocusY: 0.5,
    },
    ...overrides,
  };
}

const square = (productBox?: { x: number; y: number; width: number; height: number }) =>
  buildFramingInspection({ width: 1000, height: 1000, productBox: productBox ?? null });

describe("Phase 16 — canvas fit (crop risk + smart canvas)", () => {
  it("computes the cover window for a square photo in a vertical frame", () => {
    const w = coverWindow(1, 9 / 16);
    expect(w.width).toBeCloseTo(0.5625, 3);
    expect(w.height).toBe(1);
    expect(w.x).toBeCloseTo((1 - 0.5625) / 2, 3);
  });

  it("keeps the cover crop when a measured narrow product fits the 9:16 window (SAFE)", () => {
    const plan = planCanvasFit({
      sceneId: "s1", assetId: "a1", sourceWidth: 1000, sourceHeight: 1000,
      frameWidth: 1080, frameHeight: 1920, targetAspect: "9:16",
      framing: square({ x: 400, y: 200, width: 200, height: 600 }),
    });
    expect(plan.basis).toBe("measured-bbox");
    expect(plan.cropRisk).toBe("SAFE");
    expect(plan.strategy).toBe("COVER_CROP");
    expect(plan.productKeptRatio).toBeGreaterThanOrEqual(0.98);
  });

  it("switches to SOFT_EXTEND when a wide measured product would be cut (UNSAFE)", () => {
    const plan = planCanvasFit({
      sceneId: "s1", assetId: "a1", sourceWidth: 1000, sourceHeight: 1000,
      frameWidth: 1080, frameHeight: 1920, targetAspect: "9:16",
      framing: square({ x: 50, y: 300, width: 900, height: 400 }),
    });
    expect(plan.cropRisk).toBe("UNSAFE");
    expect(plan.strategy).toBe("SOFT_EXTEND");
    expect(plan.background).toBe("SOURCE_BLUR");
    expect(plan.generativeExpansion).toBe(false);
    expect(plan.productKeptRatio!).toBeLessThan(0.98);
  });

  it("treats estimated bounds with a heavy crop as UNCERTAIN and protects the product", () => {
    const plan = planCanvasFit({
      sceneId: "s1", assetId: "a1", sourceWidth: 1000, sourceHeight: 1000,
      frameWidth: 1080, frameHeight: 1920, targetAspect: "9:16", framing: square(),
    });
    expect(plan.basis).toBe("estimated-center");
    expect(plan.productKeptRatio).toBeNull();
    expect(plan.cropRisk).toBe("UNCERTAIN");
    expect(plan.strategy).toBe("SOFT_EXTEND");
  });

  it("keeps the cover crop for a light crop even without measured bounds", () => {
    const plan = planCanvasFit({
      sceneId: "s1", assetId: "a1", sourceWidth: 1080, sourceHeight: 1700,
      frameWidth: 1080, frameHeight: 1920, targetAspect: "9:16", framing: null,
    });
    expect(plan.sourceCoverage).toBeGreaterThanOrEqual(0.8);
    expect(plan.strategy).toBe("COVER_CROP");
  });

  it("is platform-aware: the same photo is safe in 1:1 and extended in 9:16", () => {
    const framing = square({ x: 50, y: 300, width: 900, height: 400 });
    const base = { sceneId: "s1", assetId: "a1", sourceWidth: 1000, sourceHeight: 1000, framing };
    expect(planCanvasFit({ ...base, frameWidth: 1080, frameHeight: 1080, targetAspect: "1:1" }).strategy).toBe("COVER_CROP");
    expect(planCanvasFit({ ...base, frameWidth: 1080, frameHeight: 1920, targetAspect: "9:16" }).strategy).toBe("SOFT_EXTEND");
  });

  it("forces the safe layout for a targeted scene repair", () => {
    const plan = planCanvasFit({
      sceneId: "s1", assetId: "a1", sourceWidth: 1000, sourceHeight: 1000,
      frameWidth: 1080, frameHeight: 1080, targetAspect: "1:1",
      framing: square({ x: 400, y: 400, width: 200, height: 200 }), forceSafe: true,
    });
    expect(plan.strategy).toBe("SOFT_EXTEND");
    expect(plan.forcedByRepair).toBe(true);
  });

  it("falls back truthfully to the legacy crop when dimensions are unknown", () => {
    const plan = planCanvasFit({
      sceneId: "s1", assetId: "a1", sourceWidth: 0, sourceHeight: 0,
      frameWidth: 1080, frameHeight: 1920, targetAspect: "9:16", framing: null,
    });
    expect(plan.strategy).toBe("COVER_CROP");
    expect(plan.cropRisk).toBe("UNCERTAIN");
  });

  it("never pans across the extension and clamps zoom; holds when the product is near an edge", () => {
    const plan = planCanvasFit({
      sceneId: "s1", assetId: "a1", sourceWidth: 1000, sourceHeight: 1000,
      frameWidth: 1080, frameHeight: 1920, targetAspect: "9:16",
      framing: square({ x: 50, y: 300, width: 900, height: 400 }),
    });
    const adjusted = applyCanvasFitToClip(clip(), plan);
    expect(adjusted.motion).toBe("slow-zoom");
    expect(adjusted.motionParams!.maxZoom).toBeLessThanOrEqual(1.05);
    expect(adjusted.canvasPlan?.motionAdjusted).toBe(true);
    expect(applyCanvasFitToClip(clip(), plan, true).motion).toBe("hold");
    const safe = planCanvasFit({
      sceneId: "s1", assetId: "a1", sourceWidth: 1000, sourceHeight: 1000,
      frameWidth: 1080, frameHeight: 1080, targetAspect: "1:1", framing: square(),
    });
    expect(applyCanvasFitToClip(clip(), safe).motion).toBe("pan-left");
  });

  it("renders SOFT_EXTEND with the fitted-canvas filter; legacy clips keep the cover crop", async () => {
    const plan = buildRenderPlan("9:16", 3000, "standard");
    const legacy = await stillFilter({ clip: clip(), imagePath: "/tmp/in.png" }, plan, { motion: false, fade: false, text: false });
    expect(legacy).toContain("force_original_aspect_ratio=increase");
    expect(legacy).not.toContain("overlay");
    const canvasPlan = planCanvasFit({
      sceneId: "s1", assetId: "a1", sourceWidth: 1000, sourceHeight: 1000,
      frameWidth: plan.width, frameHeight: plan.height, targetAspect: "9:16", framing: square(),
    });
    const extended = await stillFilter(
      { clip: applyCanvasFitToClip(clip(), canvasPlan), imagePath: "/tmp/in.png" },
      plan,
      { motion: true, fade: true, text: false },
    );
    expect(extended.startsWith(canvasFitFilter(plan.width, plan.height))).toBe(true);
    expect(extended).toContain("force_original_aspect_ratio=decrease");
    expect(extended).toContain("boxblur");
    expect(extended).toContain("zoompan");
  });
});

describe("Phase 16 — audio fit (duration reconciliation)", () => {
  it("loops shorter audio on a real downbeat with a short crossfade", () => {
    const downbeats = Array.from({ length: 15 }, (_, i) => ({ time: i * 2 }));
    const plan = planAudioFit({ sourceDurationSec: 30, targetDurationSec: 60, analysis: { bpm: 120, downbeats, beats: [] } });
    expect(plan.strategy).toBe("LOOP_EXTEND");
    expect(plan.boundaryBasis).toBe("downbeat");
    expect(plan.beatAnalysisUsed).toBe(true);
    expect(plan.loopEndSec).toBe(28);
    expect(plan.crossfadeSec).toBeLessThanOrEqual(0.08);
    expect(plan.coveredDurationSec).toBeCloseTo(60, 1);
    expect(plan.fadeOutStartSec + plan.fadeOutSec).toBeCloseTo(60, 2);
  });

  it("uses tempo bars when only BPM is known and a long crossfade when nothing is known", () => {
    const tempo = planAudioFit({ sourceDurationSec: 30, targetDurationSec: 60, analysis: { bpm: 100 } });
    expect(tempo.boundaryBasis).toBe("tempo");
    const bars = tempo.loopEndSec! / 2.4;
    expect(bars).toBeCloseTo(Math.round(bars), 3);
    const blind = planAudioFit({ sourceDurationSec: 30, targetDurationSec: 60, analysis: null });
    expect(blind.boundaryBasis).toBe("duration");
    expect(blind.beatAnalysisUsed).toBe(false);
    expect(blind.crossfadeSec).toBe(1);
    expect(blind.coveredDurationSec).toBeCloseTo(60, 1);
  });

  it("fades longer audio out on a beat so it ends exactly with the video", () => {
    const beats = Array.from({ length: 120 }, (_, i) => ({ time: i * 0.5 }));
    const plan = planAudioFit({ sourceDurationSec: 60, targetDurationSec: 30, analysis: { beats } });
    expect(plan.strategy).toBe("TRIM_FADE");
    expect(plan.boundaryBasis).toBe("beat");
    expect(beats.some((b) => Math.abs(b.time - plan.fadeOutStartSec) < 1e-6)).toBe(true);
    expect(plan.fadeOutStartSec + plan.fadeOutSec).toBeCloseTo(30, 3);
    expect(planAudioFit({ sourceDurationSec: 60, targetDurationSec: 30 }).boundaryBasis).toBe("duration");
  });

  it("does not loop voice or very short clips, and treats near-equal lengths as exact", () => {
    expect(planAudioFit({ sourceDurationSec: 10, targetDurationSec: 20, allowLoop: false }).strategy).toBe("PAD_SILENCE");
    expect(planAudioFit({ sourceDurationSec: MIN_LOOPABLE_SEC - 1, targetDurationSec: 20 }).strategy).toBe("PAD_SILENCE");
    expect(planAudioFit({ sourceDurationSec: 15.1, targetDurationSec: 15 }).strategy).toBe("EXACT");
  });

  it("builds a crossfade chain for loops and a fade + pad for trims", () => {
    const loop = planAudioFit({ sourceDurationSec: 8, targetDurationSec: 20 });
    const filter = buildAudioFitFilter(loop, "[1:a]", "[a]", { volume: 0.8 });
    expect(filter).toContain(`asplit=${loop.repeats}`);
    expect(filter.match(/acrossfade/g)?.length).toBe(loop.repeats - 1);
    expect(filter).toContain("volume=0.800");
    expect(filter).toContain("apad=whole_dur=20.000[a]");
    const trim = buildAudioFitFilter(planAudioFit({ sourceDurationSec: 40, targetDurationSec: 20 }), "[1:a]", "[a]");
    expect(trim).toContain("afade=t=out");
    expect(trim).not.toContain("acrossfade");
  });

  it("produces a track as long as the video when FFmpeg is present", async () => {
    if (!(await ffmpegAvailable()) || !(await ffprobeAvailable())) return;
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "phase16-audio-"));
    roots.push(root);
    const video = path.join(root, "v.mp4");
    const audio = path.join(root, "a.wav");
    await execFileAsync(ffmpegBinary(), ["-y", "-f", "lavfi", "-i", "color=c=black:s=64x64:d=9", "-r", "10", "-pix_fmt", "yuv420p", video]);
    await execFileAsync(ffmpegBinary(), ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=5", audio]);
    const out = await muxAudioOntoVideo({ videoPath: video, audioPath: audio, outputPath: path.join(root, "o.mp4"), videoDurationMs: 9000 });
    expect(out.audioFit.strategy).toBe("LOOP_EXTEND");
    expect(out.hasAudioStream).toBe(true);
    const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=duration", "-of", "csv=p=0", path.join(root, "o.mp4")]).catch(() => ({ stdout: "" }));
    if (stdout.trim()) expect(Number(stdout.trim())).toBeGreaterThan(8.5);
  }, 60_000);
});

describe("Phase 16 — QA and targeted repair", () => {
  const lock = {
    status: "LOCKED",
    projectId: "p1",
    productAssetIds: ["a1"],
    heroAssetId: "a1",
    identityVersion: "v1",
    version: PRODUCT_IDENTITY_LOCK_VERSION,
    assetFingerprint: computeAssetFingerprint(["a1"], "a1"),
    protectedAttributes: ["shape"],
    allowedCreativeChanges: ["background"],
  } as unknown as ProductIdentityLock;

  function qa(extra: Partial<Parameters<typeof runDeterministicPmvQa>[0]> = {}) {
    return runDeterministicPmvQa({
      projectId: "p1",
      lock,
      productAssetIds: ["a1"],
      heroAssetId: "a1",
      brandName: "Brand",
      website: "",
      phone: "",
      cta: "Order now",
      logoAssetId: null,
      audioSelected: true,
      productionMode: "AI_PRODUCT_MOTION",
      scenes: [{ sceneId: "s1", order: 1, durationSeconds: 3, purpose: "HERO", visual: "", camera: "", motion: "", transition: "cut", text: "", assetId: "a1", status: "GENERATED" }],
      timelineAssetIds: ["a1"],
      output: {
        url: "/out.mp4", sizeBytes: 100, validationStatus: "TECHNICALLY_VALIDATED",
        validationChecks: { audioPresentWhenRequired: true }, renderJobId: "j1",
      },
      visionQaAvailable: false,
      ...extra,
    });
  }

  it("fails only the scene whose product was cropped and routes to scene regeneration", () => {
    const result = qa({ sceneCanvas: [{ sceneId: "s1", strategy: "COVER_CROP", cropRisk: "UNSAFE", basis: "measured-bbox" }] });
    expect(result.scenes[0]!.compositionStatus).toBe("FAIL");
    const route = classifyPmvQaFailure(result);
    expect(route.domain).toBe("scene");
    expect(route.sceneId).toBe("s1");
  });

  it("fails audio that ends before the video and warns honestly for too-short clips", () => {
    expect(qa({ audioFit: { strategy: "LOOP_EXTEND", sourceDurationSec: 30, targetDurationSec: 60, coveredDurationSec: 40 } }).audioStatus).toBe("FAIL");
    const padded = qa({ audioFit: { strategy: "PAD_SILENCE", sourceDurationSec: 2, targetDurationSec: 20, coveredDurationSec: 2 } });
    expect(padded.audioStatus).toBe("PASS");
    expect(padded.warnings.some((w) => /too short to loop/.test(w))).toBe(true);
    const fitted = qa({ audioFit: { strategy: "LOOP_EXTEND", sourceDurationSec: 30, targetDurationSec: 60, coveredDurationSec: 60 } });
    expect(fitted.evidence.some((e) => /fitted/.test(e))).toBe(true);
  });

  it("keeps legacy projects (no canvas/audio fit data) on the previous QA outcome", () => {
    const result = qa();
    expect(result.overallStatus).toBe("QA_PASSED");
    expect(result.scenes[0]!.status).toBe("PASS");
  });
});
