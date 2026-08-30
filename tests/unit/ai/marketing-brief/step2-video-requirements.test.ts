import { describe, expect, it } from "vitest";
import { VIDEO_PLATFORM_PROFILES } from "../../../../ai/video-production/platform-profiles.js";
import {
  durationToSeconds,
  platformPreview,
  resolvePlatformId,
} from "../../../../desktop/video-requirements/platform-map.ts";
import {
  calculateDiscount,
  computeReadiness,
} from "../../../../desktop/video-requirements/readiness.ts";

describe("STEP 2 platform profiles", () => {
  it("maps TikTok to 9:16 1080x1920", () => {
    const p = platformPreview("tiktok");
    expect(p.aspectRatio).toBe("9:16");
    expect(p.width).toBe(1080);
    expect(p.height).toBe(1920);
  });

  it("maps YouTube to 16:9 1920x1080", () => {
    const p = platformPreview("youtube");
    expect(p.aspectRatio).toBe("16:9");
    expect(p.width).toBe(1920);
    expect(p.height).toBe(1080);
  });

  it("resolves platform labels from brief strings", () => {
    expect(resolvePlatformId("Instagram Reels")).toBe("instagram_reels");
    expect(resolvePlatformId("YouTube Shorts")).toBe("youtube_shorts");
  });

  it("uses authoritative video platform profiles without duplicate dimensions", () => {
    expect(VIDEO_PLATFORM_PROFILES.instagram_feed.width).toBe(1080);
    expect(VIDEO_PLATFORM_PROFILES.instagram_feed.height).toBe(1080);
  });
});

describe("STEP 2 commercial discount", () => {
  it("calculates discount when previous price is greater", () => {
    const d = calculateDiscount(20000, 16000);
    expect(d.valid).toBe(true);
    expect(d.percent).toBe(20);
  });

  it("does not generate discount without previous price", () => {
    expect(calculateDiscount(null, 16000).valid).toBe(false);
    expect(calculateDiscount(16000, 20000).valid).toBe(false);
  });
});

describe("STEP 2 readiness", () => {
  it("allows continue without price", () => {
    const r = computeReadiness({
      projectId: "p1",
      product: {
        productId: "prod-1",
        name: "Oxford",
        category: "Shoes",
        imageCount: 3,
        heroAssetId: "a1",
        heroUrl: null,
        statusLabel: "ready",
      },
      commercial: {
        productName: "Oxford",
        currentPrice: null,
        previousPrice: null,
        currency: "RWF",
        website: "",
        contact: "",
      },
      platformId: "tiktok",
      duration: "30s",
      customDurationSeconds: null,
      objective: "Product Showcase",
      language: "English",
    });
    expect(r.ready).toBe(true);
  });

  it("blocks when product name missing", () => {
    const r = computeReadiness({
      projectId: "p1",
      product: {
        productId: "prod-1",
        name: "",
        category: "Shoes",
        imageCount: 1,
        heroAssetId: null,
        heroUrl: null,
        statusLabel: "",
      },
      commercial: {
        productName: "",
        currentPrice: null,
        previousPrice: null,
        currency: "RWF",
        website: "",
        contact: "",
      },
      platformId: "tiktok",
      duration: "30s",
      customDurationSeconds: null,
      objective: "Product Showcase",
      language: "English",
    });
    expect(r.ready).toBe(false);
  });
});

describe("STEP 2 duration", () => {
  it("converts preset durations to seconds", () => {
    expect(durationToSeconds("15s", null)).toBe(15);
    expect(durationToSeconds("60s", null)).toBe(60);
    expect(durationToSeconds("custom", 45)).toBe(45);
  });
});
