import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PMV_DURATION_PRESETS,
  PMV_PLATFORMS,
  durationFromParts,
  formatDuration,
  isPmvPlatform,
  legacyPlatformFor,
  maxDurationSeconds,
  minDurationSeconds,
  resolvePmvDestination,
  sceneBudgetSeconds,
  validateDuration,
} from "../../../../ai/pmv-shared/destination.js";
import { VIDEO_PLATFORM_PROFILES, resolvePlatformId } from "../../../../ai/video-production/platform-profiles.js";
import { END_CARD_DURATION_MS, I2V_MAX_CLIP_SECONDS } from "../../../../ai/video-production/duration-limits.js";
import { allocateDurations, planStoryBeats } from "../../../../ai/creative-planning/story-structure.js";
import { planProductScenes } from "../../../../ai/creative-planning/scene-planner.js";
import { fitScenesToDuration } from "../../../../ai/creative-planning/ai-creative-planner.js";
import { computeStepFingerprints, type FingerprintInputs } from "../../../../ai/pmv-orchestrator/fingerprints.js";
import type { CreativeProject } from "../../../../ai/creative-workspace/creative-workspace-manager.js";

const read = (file: string) => fs.readFileSync(path.resolve(file), "utf8");

function project(platform: string, images = 3): CreativeProject {
  const now = new Date().toISOString();
  return {
    id: "p9-duration", name: "Duration", createdAt: now, modifiedAt: now,
    productImages: Array.from({ length: images }, (_, i) => ({
      id: `image-${i + 1}`, fileName: `shoe-${i + 1}.png`, mimeType: "image/png", sizeBytes: 24, uploadedAt: now, url: `/p${i}.png`,
    })),
    productInformation: { name: "Red Sneakers", category: "Footwear", description: "Lightweight running shoes" },
    brandInformation: { name: "KWIZERA" },
    campaignInformation: { name: "Launch", objective: "Sell", callToAction: "Shop Now" },
    targetAudience: "Runners", language: "en", platform, workspaceSettings: {},
  };
}

function fingerprintInput(extra: Partial<FingerprintInputs> = {}): FingerprintInputs {
  return {
    assetFingerprint: "a", lockVersion: "1", lockStatus: "CONFIRMED", mode: "EXACT_PRODUCT", creativeTone: "Premium",
    durationSeconds: 30, aspectRatio: "9:16", creativeRequest: "",
    text: { brandName: "", cta: "", website: "", phone: "", logoAssetId: null, language: "en" },
    audio: { selectedAudioAssetId: null, beatSyncMode: "SMART", audioVolume: null },
    planId: null, planVersion: null,
    ...extra,
  };
}

describe("Phase 9 Step 2 — platform destination → render output", () => {
  it("offers TikTok, Instagram, Facebook and YouTube, each mapped to a real render profile", () => {
    expect(PMV_PLATFORMS.map((p) => p.id)).toEqual(["tiktok", "instagram", "facebook", "youtube"]);
    for (const platform of PMV_PLATFORMS) {
      expect(platform.formats.length).toBeGreaterThan(0);
      for (const format of platform.formats) {
        const profile = VIDEO_PLATFORM_PROFILES[format.profileId];
        expect(profile, format.profileId).toBeDefined();
        expect(profile.aspectRatio).toBe(format.aspectRatio);
      }
    }
  });

  it("uses the platform default format and honours supported overrides", () => {
    const cases: Array<[Parameters<typeof resolvePmvDestination>[0], string, string, number, number]> = [
      ["tiktok", "", "tiktok", 1080, 1920],
      ["instagram", "", "instagram_reels", 1080, 1920],
      ["instagram", "4:5", "instagram_portrait", 1080, 1350],
      ["instagram", "1:1", "instagram_feed", 1080, 1080],
      ["facebook", "", "facebook_feed", 1080, 1080],
      ["facebook", "9:16", "facebook_reels", 1080, 1920],
      ["youtube", "", "youtube", 1920, 1080],
      ["youtube", "9:16", "youtube_shorts", 1080, 1920],
    ];
    for (const [platform, aspect, profileId, width, height] of cases) {
      const d = resolvePmvDestination(platform, aspect);
      expect(d.profile.id, `${platform} ${aspect}`).toBe(profileId);
      expect([d.profile.width, d.profile.height]).toEqual([width, height]);
    }
    const adjusted = resolvePmvDestination("tiktok", "16:9");
    expect(adjusted.format.aspectRatio).toBe("9:16");
    expect(adjusted.formatAdjusted).toBe(true);
  });

  it("render profile resolution recognises the stored platform ids", () => {
    expect(resolvePlatformId("facebook_reels")).toBe("facebook_reels");
    expect(resolvePlatformId("facebook_feed")).toBe("facebook_feed");
    expect(resolvePlatformId("instagram_reels")).toBe("instagram_reels");
    expect(resolvePlatformId("instagram_portrait")).toBe("instagram_portrait");
    expect(resolvePlatformId("youtube_shorts")).toBe("youtube_shorts");
    for (const id of Object.keys(VIDEO_PLATFORM_PROFILES)) expect(resolvePlatformId(id)).toBe(id);
  });

  it("legacy projects without a platform keep the profile they rendered with", () => {
    expect(resolvePmvDestination(null, "9:16").profile.id).toBe("tiktok");
    expect(resolvePmvDestination(null, "1:1").profile.id).toBe("instagram_feed");
    expect(resolvePmvDestination(null, "16:9").profile.id).toBe("youtube");
    expect(resolvePmvDestination(undefined, undefined).profile.id).toBe("tiktok");
    expect(legacyPlatformFor("facebook_feed", "1:1")).toBe("facebook");
    expect(isPmvPlatform("snapchat")).toBe(false);
    expect(isPmvPlatform("youtube")).toBe(true);
  });

  it("plan fingerprints are unchanged for legacy projects and change with an explicit platform", () => {
    const legacy = computeStepFingerprints(fingerprintInput());
    expect(computeStepFingerprints(fingerprintInput({ platform: null })).CREATIVE_PLANNING).toBe(legacy.CREATIVE_PLANNING);
    const youtube = computeStepFingerprints(fingerprintInput({ platform: "youtube:youtube" }));
    expect(youtube.CREATIVE_PLANNING).not.toBe(legacy.CREATIVE_PLANNING);
    const longer = computeStepFingerprints(fingerprintInput({ durationSeconds: 150 }));
    expect(longer.CREATIVE_PLANNING).not.toBe(legacy.CREATIVE_PLANNING);
  });
});

describe("Phase 9 Step 2 — duration presets and custom validation", () => {
  it("exposes the requested presets", () => {
    expect([...PMV_DURATION_PRESETS]).toEqual([15, 30, 45, 60, 90, 120]);
  });

  it("parses custom minutes + seconds with clear rejections", () => {
    expect(durationFromParts("2", "30")).toEqual({ total: 150, error: null });
    expect(durationFromParts("0", "45")).toEqual({ total: 45, error: null });
    expect(durationFromParts("", "20").total).toBe(20);
    expect(durationFromParts(1, 0).total).toBe(60);
    expect(durationFromParts("1", "60").error).toMatch(/0 to 59/);
    expect(durationFromParts("1", "-1").error).toMatch(/0 to 59/);
    expect(durationFromParts("1", "2.5").error).toMatch(/0 to 59/);
    expect(durationFromParts("-1", "0").error).toMatch(/Minutes/);
    expect(durationFromParts("abc", "0").error).toMatch(/Minutes/);
    expect(durationFromParts("0", "0").error).toMatch(/longer than 0/);
    expect(formatDuration(150)).toBe("2:30");
    expect(formatDuration(45)).toBe("0:45");
  });

  it("enforces the real render maximum of the chosen destination, not an invented one", () => {
    const youtube = resolvePmvDestination("youtube", "16:9");
    expect(maxDurationSeconds(youtube)).toBe(VIDEO_PLATFORM_PROFILES.youtube.maxDurationMs / 1000);
    expect(validateDuration(150, youtube, "EXACT_PRODUCT")).toBeNull();
    const tiktok = resolvePmvDestination("tiktok", "9:16");
    expect(validateDuration(60, tiktok, "EXACT_PRODUCT")).toBeNull();
    expect(validateDuration(90, tiktok, "EXACT_PRODUCT")).toMatch(/TikTok .* up to 1:00/);
    expect(validateDuration(120, resolvePmvDestination("facebook", "1:1"), "EXACT_PRODUCT")).toBeNull();
    expect(validateDuration(0, youtube, "EXACT_PRODUCT")).toMatch(/choose how long/);
    expect(validateDuration(3, youtube, "EXACT_PRODUCT")).toMatch(/at least/);
    expect(minDurationSeconds("EXACT_PRODUCT")).toBeLessThanOrEqual(15);
  });

  it("every preset is valid on at least one destination and every destination accepts 15–60s", () => {
    const destinations = PMV_PLATFORMS.flatMap((p) => p.formats.map((f) => resolvePmvDestination(p.id, f.aspectRatio)));
    for (const preset of PMV_DURATION_PRESETS) {
      expect(destinations.some((d) => validateDuration(preset, d, "EXACT_PRODUCT") === null), `${preset}s`).toBe(true);
    }
    for (const d of destinations) {
      for (const seconds of [15, 30, 45, 60]) expect(validateDuration(seconds, d, "CINEMATIC")).toBeNull();
    }
  });
});

describe("Phase 9 Step 2 — duration → plan → timeline", () => {
  it("scene budget + end card equals the requested total for Slideshow; Cinematic uses the full total", () => {
    for (const total of [15, 30, 45, 60, 90, 120, 150]) {
      expect(sceneBudgetSeconds(total, "EXACT_PRODUCT") + END_CARD_DURATION_MS / 1000).toBe(total);
      expect(sceneBudgetSeconds(total, "CINEMATIC")).toBe(total);
    }
  });

  it("story beats scale with long durations and keep scenes within the cinematic clip limit", () => {
    for (const seconds of [15, 30, 45, 60, 90, 120, 150]) {
      const ms = seconds * 1000;
      for (const platform of ["tiktok", "instagram_reels", "facebook_feed", "youtube"]) {
        const beats = planStoryBeats({ durationMs: ms, platform, uniqueViewCount: 3, hasPrice: true, hasPromotion: false });
        const durations = allocateDurations(ms, beats, platform);
        expect(durations.reduce((a, b) => a + b, 0), `${seconds}s ${platform}`).toBeGreaterThanOrEqual(ms - 50);
        expect(durations.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(ms + 50);
        expect(Math.max(...durations), `${seconds}s ${platform}`).toBeLessThanOrEqual(I2V_MAX_CLIP_SECONDS * 1000);
        expect(beats[beats.length - 1]).toBe("CTA");
      }
    }
  });

  it("a 2:30 request plans about 150 seconds of scenes (Cinematic) / 145 + end card (Slideshow)", () => {
    for (const [mode, expected] of [["CINEMATIC", 150], ["EXACT_PRODUCT", 145]] as const) {
      const targetMs = sceneBudgetSeconds(150, mode) * 1000;
      const scenes = planProductScenes(project("youtube"), null, [], [], { targetDurationMs: targetMs });
      const total = scenes.reduce((sum, s) => sum + (s.durationMs ?? s.durationSeconds * 1000), 0);
      expect(Math.abs(total - expected * 1000), mode).toBeLessThanOrEqual(1000);
      expect(scenes.length).toBeGreaterThan(8);
      expect(Math.max(...scenes.map((s) => s.durationMs ?? s.durationSeconds * 1000))).toBeLessThanOrEqual(10_000);
      for (let i = 1; i < scenes.length; i += 1) {
        expect(scenes[i]!.startMs).toBe(scenes[i - 1]!.startMs + (scenes[i - 1]!.durationMs ?? 0));
      }
      expect(new Set(scenes.map((s) => s.assetId)).size).toBe(3);
    }
  });

  it("short presets still produce a single-pass plan matching the request", () => {
    for (const seconds of [15, 30, 60]) {
      const scenes = planProductScenes(project("tiktok"), null, [], [], { targetDurationMs: seconds * 1000 });
      const total = scenes.reduce((sum, s) => sum + (s.durationMs ?? s.durationSeconds * 1000), 0);
      expect(Math.abs(total - seconds * 1000)).toBeLessThanOrEqual(1000);
    }
  });

  it("AI-proposed scene timings are fitted to the requested total, keeping customer-edited scenes", () => {
    const scenes = [
      { durationSeconds: 5, durationMs: 5000, userEdited: false, startMs: 0 },
      { durationSeconds: 5, durationMs: 5000, userEdited: true, startMs: 5000 },
      { durationSeconds: 5, durationMs: 5000, userEdited: false, startMs: 10000 },
    ];
    const fitted = fitScenesToDuration(scenes, 45);
    expect(fitted.reduce((s, x) => s + x.durationMs!, 0)).toBeGreaterThanOrEqual(44_900);
    expect(fitted[1]!.durationMs).toBe(5000);
    expect(fitted[2]!.startMs).toBe(fitted[0]!.durationMs! + 5000);
    expect(fitScenesToDuration(scenes, 15)).toBe(scenes);
  });
});

describe("Phase 9 Step 2 — persistence and wiring", () => {
  const engine = read("desktop/product-setup/product-setup-engine.ts");
  const executors = read("ai/pmv-orchestrator/executors.ts");
  const style = read("desktop/customer-platform/workspace/pmv/PmvStyleStep.tsx");

  it("saves platform, format, duration and the custom flag, and restores them on reopen", () => {
    expect(engine).toMatch(/durationCustom: this\.videoSettings\.durationCustom/);
    expect(engine).toMatch(/\.\.\.\(this\.videoSettings\.platform \? \{ platform: this\.videoSettings\.platform \} : \{\}\)/);
    expect(engine).toMatch(/aspectRatio: destination\.format\.aspectRatio/);
    expect(engine).toMatch(/const platform = destination\.profile\.id;/);
    expect(engine).toMatch(/platforms: \[platform\]/);
    expect(engine).toMatch(/customDurationSeconds: this\.videoSettings\.durationSeconds/);
    expect(engine).toMatch(/durationCustom: stored\?\.durationCustom === true/);
    expect(engine).toMatch(/platform: isPmvPlatform\(stored\?\.platform\) \? stored\.platform : null/);
    expect(engine).toMatch(/if \(typeof stored\.durationCustom === "boolean"\) this\.videoSettings\.durationCustom = stored\.durationCustom;/);
    expect(engine).toMatch(/if \(isPmvPlatform\(stored\.platform\)\) this\.videoSettings\.platform = stored\.platform;/);
  });

  it("legacy settings default safely (no platform, not custom, 9:16)", () => {
    expect(engine).toMatch(/durationCustom: false,\s*aspectRatio: "9:16",\s*platform: null/);
    expect(engine).toMatch(/return platform\?\.trim\(\) \? profileForPlatform\(platform\)\.aspectRatio : "9:16"/);
  });

  it("the workflow plans the scene budget and rejects unsupported durations server-side", () => {
    expect(executors).toMatch(/durationSeconds: sceneBudgetSeconds\(s\.durationSeconds, s\.generationMode\)/);
    expect(executors).toMatch(/"DURATION_NOT_SUPPORTED"/);
    expect(executors).toMatch(/resolvePmvDestination\(/);
    expect(engine).toMatch(/sceneBudgetSeconds\(snap\.videoSettings\.durationSeconds \|\| 15, this\.creativeDirection\.generationMode\)/);
  });

  it("the Style step offers platform chips, presets and custom minutes/seconds", () => {
    expect(style).toContain("Where will this video be used?");
    expect(style).toContain("PMV_PLATFORMS.map");
    expect(style).toContain("PMV_DURATION_PRESETS.map");
    expect(style).toContain('data-duration="custom"');
    expect(style).toContain("<span>Minutes</span>");
    expect(style).toContain("<span>Seconds</span>");
    expect(style).toMatch(/validateStyle\(\{[\s\S]*platform: destination\.platform[\s\S]*durationSeconds: settings\.durationSeconds/);
    expect(style).toMatch(/setVideoSettingsField\("aspectRatio", next\.formats\[0\]!\.aspectRatio\)/);
    expect(style).toMatch(/if \(id === destination\.platform\) return;/);
  });
});
