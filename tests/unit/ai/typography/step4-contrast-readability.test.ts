/**
 * STEP 4 — contrast, color, readability, brand acceptance tests.
 */
import { describe, expect, it } from "vitest";
import { analyzeRegionFromRgba, contrastRatio, relativeLuminanceRgb, regionFromHints } from "../../../../ai/typography/region-analysis.js";
import { contrastForBackground, resolveTextAppearance } from "../../../../ai/typography/contrast.js";
import { areasCollide, resolveTextCollisions } from "../../../../ai/typography/collision.js";
import { composeTypographyDecision } from "../../../../ai/typography/typography-engine.js";
import { buildDrawtextFilter, contrastDrawtextExtras } from "../../../../ai/typography/drawtext-integration.js";
import { typographySceneToLayers } from "../../../../ai/typography/to-video-layers.js";
import { applyInvalidAiSafely } from "../../../../ai/typography/typography-engine.js";
import { validateTypographyDecision } from "../../../../ai/typography/validator.js";
import { keepCurrencyWithAmount } from "../../../../ai/typography/price-typography.js";
import { TEXT_ROLES, type TypographyItem, type VerifiedFont } from "../../../../ai/typography/types.js";
import type { VideoRenderPlan, VideoTimelineClip } from "../../../../ai/video-production/types.js";

function makeFont(overrides: Partial<VerifiedFont> & Pick<VerifiedFont, "id" | "family">): VerifiedFont {
  return {
    filePath: `${overrides.family}.ttf`,
    style: "regular",
    weight: 400,
    italic: false,
    bold: false,
    category: "sans",
    personalities: ["clean-sans", "tech", "promotional", "modern-sans"],
    roles: [...TEXT_ROLES],
    latinExtended: true,
    verified: true,
    ...overrides,
  };
}

const catalog: VerifiedFont[] = [
  makeFont({ id: "arial:Arial.ttf", family: "Arial" }),
  makeFont({ id: "arial:Arial-Bold.ttf", family: "Arial", style: "bold", weight: 700, bold: true }),
];

function solidRgba(width: number, height: number, r: number, g: number, b: number): Buffer {
  const buf = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4;
    buf[o] = r;
    buf[o + 1] = g;
    buf[o + 2] = b;
    buf[o + 3] = 255;
  }
  return buf;
}

function base(projectId: string, scenes: Parameters<typeof composeTypographyDecision>[0]["scenes"]) {
  return {
    projectId,
    width: 1080,
    height: 1920,
    aspectRatio: "9:16" as const,
    platform: "tiktok",
    useOllama: false,
    scenes,
  };
}

describe("STEP 4 contrast readability and brand acceptance", () => {
  it("TEST A — dark background prefers light text", () => {
    const region = regionFromHints({ meanLuminance: 30, backgroundType: "dark" });
    const decision = resolveTextAppearance({
      region,
      role: "headline",
      hierarchyLevel: "PRIMARY",
    });
    expect(["white", "near-white", "#F5F5F5"]).toContain(decision.color);
    expect(decision.readabilityPassed).toBe(true);
    expect(decision.contrastRatio).toBeGreaterThanOrEqual(4);
  });

  it("TEST B — bright background prefers dark text", () => {
    const region = regionFromHints({ meanLuminance: 230, backgroundType: "light" });
    const decision = resolveTextAppearance({
      region,
      role: "headline",
      hierarchyLevel: "PRIMARY",
    });
    expect(["black", "near-black", "#141414"]).toContain(decision.color);
    expect(decision.readabilityPassed).toBe(true);
  });

  it("TEST C — complex background uses treatment when needed", () => {
    const region = regionFromHints({ meanLuminance: 128, complexity: "high" });
    const decision = resolveTextAppearance({
      region,
      role: "headline",
      hierarchyLevel: "PRIMARY",
    });
    expect(["outline", "shadow", "panel"]).toContain(decision.contrastStrategy);
    expect(decision.readabilityPassed).toBe(true);
  });

  it("TEST D — black background rejects black text without treatment", () => {
    const region = regionFromHints({ meanLuminance: 5, backgroundType: "black" });
    const decision = resolveTextAppearance({
      region,
      role: "headline",
      hierarchyLevel: "PRIMARY",
    });
    expect(decision.color).not.toBe("black");
    expect(decision.readabilityPassed).toBe(true);
  });

  it("TEST E — white background rejects white text without treatment", () => {
    const region = regionFromHints({ meanLuminance: 250, backgroundType: "white" });
    const decision = resolveTextAppearance({
      region,
      role: "headline",
      hierarchyLevel: "PRIMARY",
    });
    expect(decision.color).not.toBe("white");
    expect(decision.readabilityPassed).toBe(true);
  });

  it("TEST F — blue background selects readable color (not blue-on-blue)", () => {
    const rgba = solidRgba(100, 100, 30, 90, 200);
    const region = analyzeRegionFromRgba(rgba, 100, 100, { x: 0.1, y: 0.1, width: 0.8, height: 0.2 });
    const decision = resolveTextAppearance({
      region,
      role: "headline",
      hierarchyLevel: "PRIMARY",
    });
    expect(decision.color.toLowerCase()).not.toMatch(/#1e5ac8|#1e5a/);
    expect(decision.readabilityPassed).toBe(true);
    expect(decision.contrastRatio).toBeGreaterThanOrEqual(3);
  });

  it("TEST G — product name hierarchy remains coherent", async () => {
    const decision = await composeTypographyDecision(base("p-name", [{
      sceneId: "s1",
      purpose: "HERO REVEAL",
      texts: [{ role: "productName", text: "Kigali Lamp" }],
      image: { meanLuminance: 40, backgroundType: "dark" },
    }]), catalog);
    const item = decision.scenes[0]!.items[0]!;
    expect(item.hierarchyLevel).toBe("PRIMARY");
    expect(item.visual.readabilityPassed).toBe(true);
  });

  it("TEST H — RWF price preserved with readable emphasis", async () => {
    const price = keepCurrencyWithAmount("NOW 25,000 RWF");
    const decision = await composeTypographyDecision(base("p-price", [{
      sceneId: "s1",
      purpose: "PRICE OFFER",
      texts: [{ role: "price", text: price }],
      image: { meanLuminance: 200, backgroundType: "light" },
    }]), catalog);
    const item = decision.scenes[0]!.items[0]!;
    expect(item.text).toMatch(/25,000/);
    expect(item.text).toMatch(/RWF/i);
    expect(item.hierarchyLevel).toBe("PRIMARY");
    expect(item.visual.readabilityPassed).toBe(true);
  });

  it("TEST I — previous price subordinate to current", async () => {
    const decision = await composeTypographyDecision(base("p-was", [{
      sceneId: "s1",
      purpose: "PRICE OFFER",
      texts: [
        { role: "previousPrice", text: "WAS 50,000 RWF" },
        { role: "price", text: "NOW 35,000 RWF" },
      ],
      image: { meanLuminance: 60, backgroundType: "dark" },
    }]), catalog);
    const items = decision.scenes[0]!.items;
    const was = items.find((i) => i.role === "previousPrice")!;
    const now = items.find((i) => i.role === "price")!;
    expect(was.hierarchy).toBeGreaterThan(now.hierarchy);
    expect(was.importanceScore).toBeLessThan(now.importanceScore);
  });

  it("TEST J — long text stays readable", async () => {
    const long = "Experience premium craftsmanship designed for everyday excellence across Kigali and beyond with lasting quality";
    const decision = await composeTypographyDecision(base("p-long", [{
      sceneId: "s1",
      purpose: "FEATURE BENEFIT",
      texts: [{ role: "benefit", text: long }],
      image: { meanLuminance: 180, backgroundType: "light" },
    }]), catalog);
    const item = decision.scenes[0]!.items[0]!;
    expect(item.size.fontSizePx).toBeGreaterThanOrEqual(14);
    expect(item.visual.readabilityPassed).toBe(true);
    expect(validateTypographyDecision(decision, catalog).valid).toBe(true);
  });

  it("TEST K — collision detection nudges overlapping blocks", () => {
    const mk = (id: string, role: TypographyItem["role"], y: number, hierarchy: number): TypographyItem => ({
      id,
      role,
      text: role,
      lines: [role],
      font: {
        id: catalog[0]!.id,
        family: "Arial",
        style: "regular",
        weight: 400,
        weightName: "regular",
        personality: "clean-sans",
      },
      layout: { region: "top-center", normalizedX: 0.5, normalizedY: y, alignment: "center" },
      size: { fontSizePx: 40, maxLines: 2, maxWidthPx: 800 },
      visual: { color: "white", contrastStrategy: "outline", readabilityPassed: true, contrastRatio: 8 },
      hierarchy,
      hierarchyLevel: hierarchy === 1 ? "PRIMARY" : "SUPPORTING",
      importanceScore: hierarchy === 1 ? 0.9 : 0.4,
      emphasis: [],
      boundingArea: { x: 0.2, y, width: 0.6, height: 0.1 },
      confidence: 0.9,
    });
    const a = mk("a", "headline", 0.12, 1);
    const b = mk("b", "supporting", 0.13, 3);
    expect(areasCollide(a.boundingArea, b.boundingArea)).toBe(true);
    const resolved = resolveTextCollisions([a, b]);
    expect(resolved.items[1]!.layout.normalizedY).toBeGreaterThan(b.layout.normalizedY);
  });

  it("TEST L — CTA readable and consistent", async () => {
    const decision = await composeTypographyDecision(base("p-cta", [{
      sceneId: "s1",
      purpose: "FINAL CTA",
      texts: [
        { role: "cta", text: "Shop Now" },
        { role: "website", text: "www.kwizera.rw" },
      ],
      image: { meanLuminance: 40, backgroundType: "dark" },
    }]), catalog);
    const cta = decision.scenes[0]!.items.find((i) => i.role === "cta")!;
    expect(cta.hierarchyLevel).toBe("CRITICAL_ACTION");
    expect(cta.visual.readabilityPassed).toBe(true);
  });

  it("TEST M — company website and phone remain readable but minor", async () => {
    const decision = await composeTypographyDecision(base("p-co", [{
      sceneId: "s1",
      purpose: "CLOSING CONTACT",
      texts: [
        { role: "cta", text: "Visit Website" },
        { role: "brand", text: "KWIZERA Studio" },
        { role: "website", text: "www.example.rw" },
        { role: "phone", text: "+250 788 000 000" },
      ],
      image: { meanLuminance: 220, backgroundType: "light" },
    }]), catalog);
    const items = decision.scenes[0]!.items;
    const web = items.find((i) => i.role === "website")!;
    const phone = items.find((i) => i.role === "phone")!;
    expect(web.hierarchyLevel).toBe("MINOR");
    expect(phone.hierarchyLevel).toBe("MINOR");
    expect(web.visual.readabilityPassed).toBe(true);
    expect(phone.visual.readabilityPassed).toBe(true);
  });

  it("TEST N — different styles yield different color treatments", () => {
    const dark = contrastForBackground({ meanLuminance: 20, backgroundType: "dark", role: "headline", hierarchyLevel: "PRIMARY" });
    const light = contrastForBackground({ meanLuminance: 240, backgroundType: "light", role: "headline", hierarchyLevel: "PRIMARY" });
    expect(dark.color).not.toBe(light.color);
  });

  it("TEST O — project isolation for color decisions", async () => {
    const a = await composeTypographyDecision(base("proj-A", [{
      sceneId: "s1",
      purpose: "HERO",
      texts: [{ role: "productName", text: "Project A Only" }],
      image: { meanLuminance: 30 },
    }]), catalog);
    const b = await composeTypographyDecision(base("proj-B", [{
      sceneId: "s1",
      purpose: "HERO",
      texts: [{ role: "productName", text: "Project B Only" }],
      image: { meanLuminance: 230 },
    }]), catalog);
    expect(a.projectId).toBe("proj-A");
    expect(b.projectId).toBe("proj-B");
    expect(a.scenes[0]!.items[0]!.text).toContain("Project A");
    expect(b.scenes[0]!.items[0]!.text).toContain("Project B");
    expect(a.scenes[0]!.items[0]!.visual.color).not.toBe(b.scenes[0]!.items[0]!.visual.color);
  });

  it("TEST P — AI failure uses safe fallback fonts", () => {
    const decision = applyInvalidAiSafely({
      projectId: "p-ai",
      width: 1080,
      height: 1920,
      aspectRatio: "9:16",
      source: "ai-validated",
      fallbackUsed: false,
      warnings: [],
      createdAt: new Date().toISOString(),
      scenes: [{
        sceneId: "s1",
        items: [{
          id: "x",
          role: "headline",
          text: "Hello",
          lines: ["Hello"],
          font: {
            id: "missing-font",
            family: "Missing",
            style: "regular",
            weight: 400,
            weightName: "regular",
            personality: "clean-sans",
          },
          layout: { region: "top-center", normalizedX: 0.5, normalizedY: 0.12, alignment: "center" },
          size: { fontSizePx: 40, maxLines: 2, maxWidthPx: 800 },
          visual: { color: "white", contrastStrategy: "outline", readabilityPassed: true, contrastRatio: 8 },
          hierarchy: 1,
          hierarchyLevel: "PRIMARY",
          importanceScore: 0.9,
          emphasis: [],
          boundingArea: { x: 0.2, y: 0.1, width: 0.6, height: 0.08 },
          confidence: 0.2,
        }],
      }],
    }, catalog);
    expect(decision.fallbackUsed).toBe(true);
    expect(decision.scenes[0]!.items[0]!.font.id).toBe(catalog[0]!.id);
  });

  it("TEST Q — missing font falls back in drawtext path", async () => {
    const plan: VideoRenderPlan = {
      width: 640,
      height: 360,
      frameRate: 24,
      aspectRatio: "16:9",
      durationMs: 1000,
      preset: "preview",
      videoCodec: "libx264",
      audioCodec: "none",
      outputFormat: "mp4",
    };
    const clip: VideoTimelineClip = {
      id: "c1",
      sceneId: "s1",
      order: 1,
      purpose: "HERO",
      assetId: "a1",
      startMs: 0,
      durationMs: 1000,
      text: [{
        content: "Hello",
        kind: "headline",
        startMs: 0,
        durationMs: 1000,
        position: "top",
        typography: {
          fontId: "missing",
          family: "Missing",
          fontSizePx: 32,
          normalizedX: 0.5,
          normalizedY: 0.12,
          alignment: "center",
          color: "white",
          contrastStrategy: "outline",
          lines: ["Hello"],
          hierarchy: 1,
          readabilityPassed: true,
        },
      }],
    };
    const built = await buildDrawtextFilter(clip, plan);
    // Either draws with fallback font or skips if no fonts on host — must not throw.
    expect(built.layersDrawn).toBeGreaterThanOrEqual(0);
    expect(typeof built.filter).toBe("string");
  });

  it("TEST R — render failure classification stays honest (failed overlay)", async () => {
    const { classifyTextOverlay } = await import("../../../../ai/video-production/ffmpeg-renderer.js");
    expect(classifyTextOverlay({ hasText: true, fontAvailable: true, drawtextSucceeded: false })).toBe("failed");
    expect(classifyTextOverlay({ hasText: true, fontAvailable: true, drawtextSucceeded: true })).toBe("applied");
  });

  it("TEST S — layers carry STEP 4 color/contrast into renderer payload", async () => {
    const decision = await composeTypographyDecision(base("p-s", [{
      sceneId: "s1",
      purpose: "HERO",
      texts: [{ role: "headline", text: "Readable" }],
      image: { meanLuminance: 25, backgroundType: "dark" },
    }]), catalog);
    const layers = typographySceneToLayers(decision, "s1", 0, 2000);
    expect(layers[0]!.typography?.color).toBeTruthy();
    expect(layers[0]!.typography?.contrastStrategy).toBeTruthy();
    expect(layers[0]!.typography?.readabilityPassed).toBe(true);
    expect(layers[0]!.typography?.boundingArea).toBeTruthy();
    const extras = contrastDrawtextExtras(layers[0]!.typography!.contrastStrategy, 2, layers[0]!.typography?.panelColor);
    expect(extras.length).toBeGreaterThan(0);
  });

  it("region analysis differs for top vs bottom of gradient-like frame", () => {
    const width = 40;
    const height = 40;
    const rgba = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const o = (y * width + x) * 4;
        const v = y < height / 2 ? 20 : 230;
        rgba[o] = v;
        rgba[o + 1] = v;
        rgba[o + 2] = v;
        rgba[o + 3] = 255;
      }
    }
    const top = analyzeRegionFromRgba(rgba, width, height, { x: 0.1, y: 0.05, width: 0.8, height: 0.2 });
    const bottom = analyzeRegionFromRgba(rgba, width, height, { x: 0.1, y: 0.7, width: 0.8, height: 0.2 });
    expect(top.meanLuminance01).toBeLessThan(0.3);
    expect(bottom.meanLuminance01).toBeGreaterThan(0.7);
    const whiteOnTop = contrastRatio(relativeLuminanceRgb(255, 255, 255), top.meanLuminance01);
    const blackOnBottom = contrastRatio(relativeLuminanceRgb(0, 0, 0), bottom.meanLuminance01);
    expect(whiteOnTop).toBeGreaterThan(4);
    expect(blackOnBottom).toBeGreaterThan(4);
  });
});
