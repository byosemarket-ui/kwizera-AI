import { describe, expect, it } from "vitest";
import type { ProductIntelligenceProfile } from "../../../../ai/product-intelligence/types.ts";
import {
  buildProductIdentityLock,
  computeAssetFingerprint,
  confirmIdentityLock,
} from "../../../../desktop/product-identity-lock/index.ts";
import { allocateDurations, planStoryBeats, type StoryBeatId } from "../../../../ai/creative-planning/story-structure.ts";
import { beatPurpose } from "../../../../ai/creative-planning/story-structure.ts";
import {
  ensurePhotoCoverage,
  montageCapacity,
  montageFrameDurations,
  renderedPhotoCoverage,
} from "../../../../ai/video-production/photo-coverage.ts";
import { clipFadeFilter, parseVolumeDetect } from "../../../../ai/video-production/ffmpeg-renderer.ts";
import { validateRenderedOutput } from "../../../../ai/video-production/render-validation.ts";
import { timelineFingerprint } from "../../../../ai/video-production/output-stale.ts";
import { planAudioFit } from "../../../../ai/video-production/audio-fit.ts";
import { checkCustomerFacts, type CustomerFacts } from "../../../../ai/pmv-shared/customer-facts.ts";
import { runDeterministicPmvQa } from "../../../../ai/pmv-shared/qa.ts";
import { varyDirectedMotion } from "../../../../ai/video-production/motion-direction.ts";
import { composeTypographyDecision } from "../../../../ai/typography/typography-engine.ts";
import { TEXT_ROLES, type VerifiedFont } from "../../../../ai/typography/types.ts";
import type { VideoTimelineClip } from "../../../../ai/video-production/types.ts";

const END_CARD_MS = 5_000;

function clipsFor(photoCount: number, totalSeconds: number, platform = "tiktok"): { clips: VideoTimelineClip[]; photos: string[] } {
  const budget = totalSeconds * 1000 - END_CARD_MS;
  const beats = planStoryBeats({ durationMs: budget, platform, uniqueViewCount: photoCount, hasPrice: true, hasPromotion: true, photoCount });
  const durations = allocateDurations(budget, beats, platform);
  const photos = Array.from({ length: photoCount }, (_, i) => `photo-${i + 1}`);
  let cursor = 0;
  const clips = beats.map((beat: StoryBeatId, index) => {
    const durationMs = durations[index]!;
    const clip = {
      id: `s${index + 1}`,
      sceneId: `s${index + 1}`,
      order: index + 1,
      purpose: beatPurpose(beat),
      assetId: photos[index % photos.length]!,
      startMs: cursor,
      durationMs,
      layer: "video",
      camera: "medium",
      motion: "slow-zoom",
      lighting: "",
      background: "",
      transitionIn: "cut",
      transitionOut: "cut",
      text: beat === "CTA" ? [{ content: "Order Now", kind: "cta", startMs: cursor, durationMs, position: "bottom" }] : [],
      audioDirection: "",
    } as unknown as VideoTimelineClip;
    cursor += durationMs;
    return clip;
  });
  return { clips, photos };
}

describe("PMV photo coverage — every valid photo appears", () => {
  const feasible: Array<[number, number]> = [
    [1, 15], [5, 15], [10, 15], [20, 15], [20, 30], [50, 30], [50, 60], [100, 60], [100, 90], [100, 120], [10, 120],
  ];
  for (const [count, seconds] of feasible) {
    it(`${count} photos in ${seconds}s: omitted 0, durations unchanged`, () => {
      const { clips, photos } = clipsFor(count, seconds);
      const before = clips.map((c) => c.durationMs);
      const { clips: covered, coverage } = ensurePhotoCoverage(clips, photos);
      expect(coverage.requestedPhotoCount).toBe(count);
      expect(coverage.omittedPhotoCount).toBe(0);
      expect(coverage.usedPhotoCount).toBe(count);
      expect(covered.map((c) => c.durationMs)).toEqual(before);
      const shown = new Set(covered.flatMap((c) => [c.assetId, ...(c.montageAssetIds ?? [])]));
      for (const id of photos) expect(shown.has(id)).toBe(true);
      for (const clip of covered) {
        expect((clip.montageAssetIds ?? []).length).toBeLessThanOrEqual(montageCapacity(clip.durationMs));
      }
    });
  }

  it("5 photos in 15s get their own scene each (no montage needed)", () => {
    const { clips, photos } = clipsFor(5, 15);
    const { coverage } = ensurePhotoCoverage(clips, photos);
    expect(coverage.scenePhotoCount).toBe(5);
    expect(coverage.strategy).toBe("ONE_PHOTO_PER_SCENE");
  });

  it("10 photos in 15s use montage frames on showcase scenes, not on the CTA", () => {
    const { clips, photos } = clipsFor(10, 15);
    const { clips: covered, coverage } = ensurePhotoCoverage(clips, photos);
    expect(coverage.strategy).toBe("SCENES_AND_MONTAGE");
    const cta = covered.find((c) => c.text.some((t) => t.kind === "cta"))!;
    expect(cta.montageAssetIds ?? []).toEqual([]);
  });

  it("reports honest omission when the duration cannot hold every photo", () => {
    const { clips, photos } = clipsFor(100, 15);
    const { coverage } = ensurePhotoCoverage(clips, photos);
    expect(coverage.omittedPhotoCount).toBeGreaterThan(0);
    expect(coverage.strategy).toBe("INSUFFICIENT_DURATION");
    expect(coverage.usedPhotoCount + coverage.omittedPhotoCount).toBe(100);
  });

  it("montage frame durations sum exactly to the scene and keep the primary photo readable", () => {
    for (const [ms, n] of [[2000, 2], [2500, 6], [4000, 12], [1800, 3]] as const) {
      const parts = montageFrameDurations(ms, n);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(ms);
      expect(parts[0]).toBeGreaterThanOrEqual(1000);
      expect(parts.slice(1).every((p) => p >= 250)).toBe(true);
    }
  });

  it("rendered coverage counts only photos actually drawn", () => {
    expect(renderedPhotoCoverage(["a", "b", "c"], ["a", "c", "a"], "job")).toEqual({
      requestedPhotoCount: 3, usedPhotoCount: 2, omittedPhotoCount: 1, renderJobId: "job",
    });
  });

  it("montage photos change the output fingerprint; clips without montage keep the old fingerprint", () => {
    const { clips } = clipsFor(3, 15);
    const video = { timeline: clips, renderPlan: { aspectRatio: "9:16" }, creativePlanVersion: 1, platform: "tiktok" } as never;
    const base = timelineFingerprint(video);
    const withMontage = timelineFingerprint({ ...(video as object), timeline: clips.map((c, i) => (i === 0 ? { ...c, montageAssetIds: ["x"] } : c)) } as never);
    expect(withMontage).not.toBe(base);
    expect(timelineFingerprint({ ...(video as object), timeline: clips.map((c) => ({ ...c, montageAssetIds: [] })) } as never)).toBe(base);
  });
});

describe("PMV learned typography — consumed when product-safe", () => {
  const font = {
    id: "arial:Arial.ttf", family: "Arial", filePath: "Arial.ttf", style: "regular", weight: 400, italic: false, bold: false,
    category: "sans", personalities: ["clean-sans", "modern-sans", "neutral", "bold-display", "promotional"],
    roles: [...TEXT_ROLES], latinExtended: true, verified: true,
  } as VerifiedFont;
  const compose = (measured: Array<"left" | "right" | "top" | "bottom">) => composeTypographyDecision({
    projectId: "p-learned", width: 1080, height: 1920, aspectRatio: "9:16", platform: "tiktok", useOllama: false,
    scenes: [{ sceneId: "s1", texts: [{ role: "headline", text: "Urban Runner" }], image: { preferredTextSides: measured, productLikelyCentered: false } }],
    guidance: { learnedLayout: { textSides: ["right"], ctaPlacement: null, patternId: "p", name: "Right-side copy", dataset: "d" } },
  } as never, [font]);

  it("applies the learned text side when it is one of the product-safe sides", async () => {
    const decision = await compose(["left", "right"]);
    expect(decision.learnedLayout?.itemsPlaced).toBeGreaterThan(0);
  });

  it("never places learned text over the product (learned side not safe)", async () => {
    const decision = await compose(["left"]);
    expect(decision.learnedLayout?.itemsPlaced ?? 0).toBe(0);
  });
});

describe("PMV creative variation — within crop-safe motion", () => {
  const base = { directed: "PRODUCT_FOCUS" as const, reason: "Default.", fallbackUsed: false };
  it("variation 0 keeps the base choice", () => {
    expect(varyDirectedMotion(base, { variation: 0, order: 2 })).toBe(base);
  });
  it("successive variations change the camera sequence", () => {
    const seq = (v: number) => [1, 2, 3, 4].map((order) => varyDirectedMotion(base, { variation: v, order }).directed).join(">");
    expect(seq(1)).not.toBe(seq(2));
    expect(seq(1)).not.toBe([1, 2, 3, 4].map(() => "PRODUCT_FOCUS").join(">"));
  });
  it("never varies holds, and tight frames only get subtle push/pull", () => {
    const hold = { directed: "STABLE_HOLD" as const, reason: "CTA.", fallbackUsed: false };
    expect(varyDirectedMotion(hold, { variation: 3, order: 5 })).toBe(hold);
    const tight = { preferSafeComposition: true, maxSafeEnlargement: 1.05 } as never;
    for (let v = 1; v < 6; v += 1) {
      expect(["SUBTLE_PUSH_IN", "SUBTLE_PULL_BACK"]).toContain(varyDirectedMotion({ ...base, directed: "HERO_REVEAL" }, { variation: v, order: 1, framing: tight }).directed);
    }
  });
  it("avoids repeating the previous scene's motion", () => {
    const next = varyDirectedMotion(base, { variation: 1, order: 1, previousMotion: "zoom-out" });
    expect(next.directed).not.toBe("SUBTLE_PULL_BACK");
  });
});

describe("PMV transitions — a learned cut stays a cut", () => {
  it("fades only the edges whose transition is a fade", () => {
    expect(clipFadeFilter({ transitionIn: "cut", transitionOut: "cut", durationMs: 2000 })).toBe("");
    const outOnly = clipFadeFilter({ transitionIn: "cut", transitionOut: "fade", durationMs: 2000 });
    expect(outOnly).toContain("fade=t=out");
    expect(outOnly).not.toContain("fade=t=in");
    const inOnly = clipFadeFilter({ transitionIn: "fade", transitionOut: "cut", durationMs: 2000 });
    expect(inOnly).toContain("fade=t=in");
    expect(inOnly).not.toContain("fade=t=out");
  });
});

describe("PMV story beats — customer price and photo count", () => {
  it("a 15s TikTok with a price includes a PRICE scene", () => {
    const beats = planStoryBeats({ durationMs: 10_000, platform: "tiktok", uniqueViewCount: 3, hasPrice: true, hasPromotion: true });
    expect(beats).toContain("PRICE");
    expect(beats[beats.length - 1]).toBe("CTA");
  });

  it("without a price no PRICE scene is invented", () => {
    const beats = planStoryBeats({ durationMs: 10_000, platform: "tiktok", uniqueViewCount: 3, hasPrice: false, hasPromotion: false });
    expect(beats).not.toContain("PRICE");
  });

  it("extra photos add showcase scenes before the closing scenes, within readable scene length", () => {
    const beats = planStoryBeats({ durationMs: 25_000, platform: "tiktok", uniqueViewCount: 12, hasPrice: true, hasPromotion: false, photoCount: 12 });
    expect(beats.length).toBe(Math.min(12, Math.floor(25_000 / 1_800)));
    expect(beats.slice(-2)).toEqual(["PRICE", "CTA"]);
  });
});

const facts: CustomerFacts = {
  productName: "Urban Runner Sneakers",
  currentPrice: 25000,
  originalPrice: null,
  currency: "RWF",
  discountPercentage: null,
  discountAmount: null,
  offer: "20% OFF",
  phone: "+250 788 123 456",
  whatsapp: "",
  website: "https://urbanrunner.rw",
  cta: "Order Now",
};

describe("PMV customer facts — preserved, never invented", () => {
  it("passes when price, offer, phone, website and CTA appear as entered", () => {
    const check = checkCustomerFacts(facts, ["Urban Runner", "NOW 25,000 RWF", "20% OFF this week", "Order Now", "0788 123 456", "urbanrunner.rw"]);
    expect(check.status).toBe("PASS");
    expect(check.present).toEqual(expect.arrayContaining(["price", "offer", "phone", "website", "cta"]));
  });

  it("fails when the price is missing or changed", () => {
    const check = checkCustomerFacts(facts, ["NOW 24,000 RWF", "20% OFF", "Order Now", "0788 123 456", "urbanrunner.rw"]);
    expect(check.status).toBe("FAIL");
    expect(check.missing).toContain("price");
    expect(check.invented.some((i) => i.includes("24,000"))).toBe(true);
  });

  it("fails on an invented discount, phone or website", () => {
    const check = checkCustomerFacts(facts, ["NOW 25,000 RWF", "20% OFF", "Extra 50% today", "Order Now", "Call 0722 999 888", "urbanrunner.rw", "shop.example.com"]);
    expect(check.status).toBe("FAIL");
    expect(check.invented).toEqual(expect.arrayContaining([expect.stringMatching(/50%/), expect.stringMatching(/0722/), expect.stringMatching(/example\.com/)]));
  });

  it("contact details are only required when the contact end card was rendered", () => {
    const check = checkCustomerFacts(facts, ["NOW 25,000 RWF", "20% OFF", "Order Now"], { requireContacts: false });
    expect(check.status).toBe("PASS");
  });

  it("skips when the customer gave no commercial facts", () => {
    const empty: CustomerFacts = { ...facts, currentPrice: null, offer: "", phone: "", website: "", cta: "" };
    expect(checkCustomerFacts(empty, ["Fresh look"]).status).toBe("SKIPPED");
  });
});

describe("PMV audio reaches the final MP4", () => {
  it("parses volumedetect levels and treats -inf as silence", () => {
    expect(parseVolumeDetect("[Parsed_volumedetect_0] mean_volume: -18.2 dB\n[Parsed_volumedetect_0] max_volume: -1.0 dB")).toEqual({ meanDb: -18.2, maxDb: -1 });
    expect(parseVolumeDetect("mean_volume: -inf dB\nmax_volume: -inf dB")).toEqual({ meanDb: -120, maxDb: -120 });
    expect(parseVolumeDetect("no audio")).toBeNull();
  });

  const probed = { durationMs: 15_000, width: 1080, height: 1920, codec: "h264", sizeBytes: 3_000_000, hasAudioStream: true };
  const base = { probed, plannedDurationMs: 15_000, plannedWidth: 1080, plannedHeight: 1920, sceneCount: 5, preset: "standard" as const };

  it("fails validation when required audio is silent", () => {
    const qc = validateRenderedOutput({ ...base, audioRequired: true, audioPeakDb: -120 });
    expect(qc.valid).toBe(false);
    expect(qc.checks.audioAudible).toBe(false);
  });

  it("passes with an audible stream and reports it explicitly", () => {
    const qc = validateRenderedOutput({ ...base, audioRequired: true, audioPeakDb: -3 });
    expect(qc.valid).toBe(true);
    expect(qc.checks.hasAudioStream).toBe(true);
    expect(qc.checks.audioAudible).toBe(true);
  });

  it("an unmeasurable music length is flagged, not reported as exact coverage", () => {
    expect(planAudioFit({ sourceDurationSec: 0, targetDurationSec: 15 }).sourceDurationUnknown).toBe(true);
    expect(planAudioFit({ sourceDurationSec: 15, targetDurationSec: 15 }).sourceDurationUnknown).toBeUndefined();
  });
});

function sampleProfile(): ProductIntelligenceProfile {
  return {
    id: "profile-1", projectId: "proj-1", productId: "proj-1", productName: "Urban Runner", identifiedAs: "Sneaker",
    productType: "footwear", category: "Footwear", brand: "Urban", description: "Sneaker", imageIds: ["hero-1", "side-1"],
    viewCount: 2, materials: [], colours: [], textures: [], shapes: [], patterns: [], style: [], features: [], functions: [],
    visibleLogos: [], qualityIndicators: [], sellingPoints: [], targetAudience: "", marketingKeywords: [], sizes: [], tags: [],
    specifications: {}, quality: { score: 80, confidence: 0.8, notes: [] }, relationships: [],
    multiView: { viewCount: 2, coverage: "multi-view", views: [], missingAngles: [] },
    imageAnalysis: { imageCount: 2, boundariesDetected: 2, backgroundsClassified: 1, shadowsNoted: 0, reflectionsNoted: 0, averageQuality: 80, resolutionNotes: [], missingAngles: [], duplicateImageIds: [], viewCoverage: [] },
    missingInformation: [], photoRecommendations: [], detailRecommendations: [], readyForCreativeGeneration: true,
    originalImagesUnmodified: true, analysisState: "ready", analysisVersion: "step7-v1", metadata: {},
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", cached: false,
  } as ProductIntelligenceProfile;
}

function qaInput(overrides: Partial<Parameters<typeof runDeterministicPmvQa>[0]> = {}): Parameters<typeof runDeterministicPmvQa>[0] {
  const productAssetIds = ["hero-1", "side-1"];
  const lock = confirmIdentityLock(buildProductIdentityLock({
    projectId: "proj-1", profile: sampleProfile(), heroAssetId: "hero-1", productAssetIds,
    assetFingerprint: computeAssetFingerprint(productAssetIds, "hero-1"),
  }));
  return {
    projectId: "proj-1", lock, productAssetIds, heroAssetId: "hero-1", brandName: "Urban", website: "", phone: "", cta: "Order Now",
    logoAssetId: null, audioSelected: true, productionMode: "AI_PRODUCT_MOTION", scenes: [],
    timelineAssetIds: ["hero-1", "side-1"],
    output: {
      assetId: "out-1", url: "/v/out-1", width: 1080, height: 1920, durationMs: 15_000, sizeBytes: 2_000_000,
      validationStatus: "TECHNICALLY_VALIDATED",
      validationChecks: { fileNonEmpty: true, hasVideoStream: true, durationValid: true, durationConsistent: true, endCardPresent: true, audioPresentWhenRequired: true, hasAudioStream: true, audioAudible: true },
      renderJobId: "job-1", textOverlay: "applied", sceneCount: 5, endCardPresent: true,
    },
    visionQaAvailable: false,
    photoCoverage: { requestedPhotoCount: 2, usedPhotoCount: 2, omittedPhotoCount: 0 },
    requestedDurationMs: 15_000,
    customerFacts: { status: "PASS", present: ["price", "cta"], missing: [], invented: [] },
    learnedLocks: [{ sceneId: "s1", kept: true }],
    ...overrides,
  };
}

describe("PMV final QA — completed only when every check passes", () => {
  it("passes with coverage, facts, audible audio, duration and learned locks all confirmed", () => {
    const qa = runDeterministicPmvQa(qaInput());
    expect(qa.overallStatus).toBe("QA_PASSED");
    expect(qa.coverageStatus).toBe("PASS");
    expect(qa.factsStatus).toBe("PASS");
    expect(qa.audioStatus).toBe("PASS");
    expect(qa.learnedStatus).toBe("PASS");
  });

  it("fails when a selected track is silent or missing", () => {
    const silent = qaInput();
    silent.output!.validationChecks = { ...silent.output!.validationChecks, audioAudible: false };
    expect(runDeterministicPmvQa(silent).overallStatus).toBe("QA_FAILED");
    const missing = qaInput();
    missing.output!.validationChecks = { ...missing.output!.validationChecks, hasAudioStream: false };
    expect(runDeterministicPmvQa(missing).audioStatus).toBe("FAIL");
  });

  it("does not pass when audio loudness was never confirmed", () => {
    const input = qaInput();
    const { audioAudible: _a, ...rest } = input.output!.validationChecks!;
    input.output!.validationChecks = rest;
    expect(runDeterministicPmvQa(input).overallStatus).not.toBe("QA_PASSED");
  });

  it("fails when photos are omitted, facts are wrong, duration drifts or a learned choice was lost", () => {
    expect(runDeterministicPmvQa(qaInput({ photoCoverage: { requestedPhotoCount: 10, usedPhotoCount: 3, omittedPhotoCount: 7 } })).overallStatus).toBe("QA_FAILED");
    expect(runDeterministicPmvQa(qaInput({ customerFacts: { status: "FAIL", present: [], missing: ["price"], invented: [] } })).overallStatus).toBe("QA_FAILED");
    expect(runDeterministicPmvQa(qaInput({ requestedDurationMs: 30_000 })).overallStatus).toBe("QA_FAILED");
    expect(runDeterministicPmvQa(qaInput({ learnedLocks: [{ sceneId: "s1", kept: false }] })).overallStatus).toBe("QA_FAILED");
  });

  it("customer-facing failures carry no internal identifiers", () => {
    const qa = runDeterministicPmvQa(qaInput({ photoCoverage: { requestedPhotoCount: 10, usedPhotoCount: 3, omittedPhotoCount: 7 }, customerFacts: { status: "FAIL", present: [], missing: ["price"], invented: ["price 9 RWF"] } }));
    expect(qa.failures.join(" ")).not.toMatch(/job-1|patternId|provider|dataset/i);
  });
});
