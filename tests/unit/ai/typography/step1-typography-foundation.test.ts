import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverVerifiedFonts, fontSupportsText, pickFallbackFont } from "../../../../ai/typography/font-registry.js";
import { personalityForContext, roleHierarchy, selectFontForRole } from "../../../../ai/typography/font-selection.js";
import { fitText, wrapText } from "../../../../ai/typography/fitting.js";
import { choosePlacement, regionOverlapsProduct, toLegacyPosition } from "../../../../ai/typography/placement.js";
import { composeTypographyDecision } from "../../../../ai/typography/typography-engine.js";
import { applyTypographyDecisionToTimeline, publicTypographyDecision, typographySceneToLayers } from "../../../../ai/typography/to-video-layers.js";
import { sanitizeAiTypographyDecision, validateTypographyDecision } from "../../../../ai/typography/validator.js";
import { getTypographyDiagnostics } from "../../../../ai/typography/diagnostics.js";
import type { TypographyDecision, TypographyItem, VerifiedFont } from "../../../../ai/typography/types.js";
import { TEXT_ROLES } from "../../../../ai/typography/types.js";
import type { VideoTimelineClip } from "../../../../ai/video-production/types.js";

const temps: string[] = [];

afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

function makeFont(overrides: Partial<VerifiedFont> & Pick<VerifiedFont, "id" | "family">): VerifiedFont {
  return {
    filePath: overrides.filePath ?? `${overrides.family}.ttf`,
    style: "regular",
    weight: 400,
    italic: false,
    bold: false,
    category: "sans",
    personalities: ["clean-sans", "tech", "modern-sans"],
    roles: [...TEXT_ROLES],
    latinExtended: true,
    verified: true,
    ...overrides,
  };
}

const catalog: VerifiedFont[] = [
  makeFont({ id: "arial:Arial.ttf", family: "Arial", personalities: ["clean-sans", "tech", "modern-sans", "minimal", "neutral"] }),
  makeFont({
    id: "georgia:Georgia.ttf",
    family: "Georgia",
    category: "serif",
    personalities: ["serif", "editorial-serif", "luxury-serif", "premium", "fashion", "cinematic"],
    roles: ["title", "headline", "productName", "brand", "sceneCaption", "hook"],
  }),
  makeFont({
    id: "impact:Impact.ttf",
    family: "Impact",
    category: "display",
    personalities: ["bold-display", "promotional", "condensed-display"],
    roles: ["hook", "promotion", "discount", "cta", "price"],
    latinExtended: false,
  }),
];

function baseInput(projectId: string, scenes: Parameters<typeof composeTypographyDecision>[0]["scenes"]) {
  return {
    projectId,
    width: 1080,
    height: 1920,
    aspectRatio: "9:16" as const,
    platform: "tiktok",
    scenes,
    useOllama: false,
  };
}

function clip(sceneId: string): VideoTimelineClip {
  return {
    id: sceneId,
    sceneId,
    order: 1,
    purpose: "hero",
    assetId: "asset-1",
    startMs: 0,
    durationMs: 2000,
    layer: "video",
    camera: "front",
    motion: "hold",
    lighting: "studio",
    background: "product still",
    transitionIn: "cut",
    transitionOut: "cut",
    text: [{ content: "fallback", kind: "headline", startMs: 0, durationMs: 2000, position: "top" }],
    audioDirection: "none",
  };
}

describe("STEP 1 typography foundation", () => {
  it("TEST A — discovers verified font files that exist on disk", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-fonts-"));
    temps.push(dir);
    const extra = path.join(dir, "DejaVuSans.ttf");
    await fs.writeFile(extra, Buffer.from("ok"));
    const fonts = await discoverVerifiedFonts({ extraFiles: [extra] });
    expect(fonts.some((font) => font.filePath === extra || font.filePath.endsWith("DejaVuSans.ttf"))).toBe(true);
    expect(fonts.every((font) => font.verified)).toBe(true);
    expect(pickFallbackFont(fonts)?.family).toBeTruthy();
  });

  it("TEST B — technology products prefer precise sans/tech personality, not script", async () => {
    const personality = personalityForContext({ category: "consumer electronics", goal: "launch", role: "headline" });
    expect(personality).toBe("tech");
    const font = selectFontForRole(catalog, "headline", "Galaxy Phone", personality);
    expect(font.category).not.toBe("script");
    expect(font.personalities.some((item) => item === "tech" || item === "clean-sans")).toBe(true);
    const decision = await composeTypographyDecision({
      ...baseInput("proj-tech", [{
        sceneId: "scene-tech",
        texts: [{ role: "headline", text: "Precision. Power." }],
      }]),
      productCategory: "technology gadgets",
    }, catalog);
    expect(decision.projectId).toBe("proj-tech");
    expect(decision.scenes[0]?.items[0]?.font.personality).toBe("tech");
    expect(decision.scenes[0]?.items[0]?.font.family.toLowerCase()).not.toMatch(/script|comic|brush/);
  });

  it("TEST C — fashion products can select a different personality than technology", async () => {
    const tech = personalityForContext({ category: "software", role: "headline" });
    const fashion = personalityForContext({ category: "fashion apparel", role: "headline" });
    expect(fashion).toBe("fashion");
    expect(fashion).not.toBe(tech);
    const decision = await composeTypographyDecision({
      ...baseInput("proj-fashion", [{
        sceneId: "scene-fashion",
        texts: [{ role: "headline", text: "Autumn Atelier" }],
      }]),
      productCategory: "fashion clothing",
    }, catalog);
    expect(decision.scenes[0]?.items[0]?.font.personality).toBe("fashion");
    expect(decision.scenes[0]?.items[0]?.font.family).toBe("Georgia");
  });

  it("TEST D — price and discount text receive stronger promotional hierarchy", async () => {
    expect(roleHierarchy("price")).toBeLessThan(roleHierarchy("supporting"));
    expect(roleHierarchy("discount")).toBeLessThan(roleHierarchy("subtitle"));
    const decision = await composeTypographyDecision({
      ...baseInput("proj-price", [{
        sceneId: "scene-price",
        purpose: "PRICE OFFER",
        texts: [
          { role: "previousPrice", text: "WAS 50,000 RWF" },
          { role: "price", text: "NOW 35,000 RWF" },
          { role: "discount", text: "SAVE 30%" },
        ],
        image: { productLikelyCentered: true },
      }]),
      productCategory: "retail",
    }, catalog);
    const items = decision.scenes[0]!.items;
    const price = items.find((item) => item.role === "price")!;
    const was = items.find((item) => item.role === "previousPrice")!;
    expect(price.font.personality).toBe("promotional");
    expect(price.hierarchy).toBeLessThan(was.hierarchy);
    expect(toLegacyPosition(price.layout.region)).toBe("bottom");
    expect(price.size.fontSizePx).toBeGreaterThanOrEqual(was.size.fontSizePx);
  });

  it("TEST E — primary text does not cover a centered product", async () => {
    expect(regionOverlapsProduct("center", true)).toBe(true);
    expect(regionOverlapsProduct("top-center", true)).toBe(false);
    const region = choosePlacement({ role: "headline", productCentered: true, hierarchy: 1 });
    expect(regionOverlapsProduct(region, true)).toBe(false);
    const decision = await composeTypographyDecision({
      ...baseInput("proj-protect", [{
        sceneId: "scene-hero",
        texts: [{ role: "headline", text: "Keep the product visible" }],
        image: { productLikelyCentered: true, composition: "centered product on studio backdrop" },
      }]),
    }, catalog);
    const item = decision.scenes[0]!.items[0]!;
    expect(item.layout.region).not.toBe("center");
    expect(regionOverlapsProduct(item.layout.region, true)).toBe(false);
    expect(toLegacyPosition(item.layout.region)).not.toBe("center");
  });

  it("TEST F — different scenes can receive different placements", async () => {
    const decision = await composeTypographyDecision({
      ...baseInput("proj-place", [
        {
          sceneId: "scene-a",
          texts: [{ role: "headline", text: "Top safe headline" }],
          image: { productLikelyCentered: true },
        },
        {
          sceneId: "scene-b",
          texts: [{ role: "cta", text: "Shop now" }],
          image: { productLikelyCentered: true },
        },
        {
          sceneId: "scene-c",
          texts: [{ role: "headline", text: "Side composition" }],
          image: { productLikelyCentered: false, composition: "product on the left edge" },
        },
      ]),
    }, catalog);
    const regions = decision.scenes.map((scene) => scene.items[0]!.layout.region);
    expect(new Set(regions).size).toBeGreaterThan(1);
  });

  it("TEST G — long text wraps and is fitted instead of overflowing unchecked", () => {
    const long = "This promotional message is intentionally long so the fitting engine must wrap words onto multiple lines and reduce size if needed for the frame.";
    const fitted = fitText({ text: long, width: 1080, height: 1920, hierarchy: 1, roleMaxLines: 3 });
    expect(fitted.lines.length).toBeGreaterThan(1);
    expect(fitted.lines.length).toBeLessThanOrEqual(3);
    expect(fitted.lines.every((line) => line.length > 0)).toBe(true);
    expect(wrapText(long, 400, 48, 3).length).toBeGreaterThan(1);
  });

  it("TEST H — Kinyarwanda / Latin-extended text stays valid on a supporting font", async () => {
    const text = "Muraho neza. Igicuruzwa gishya kiri hano — ubuzima bwîza.";
    expect(fontSupportsText(catalog[0]!, text)).toBe(true);
    const decision = await composeTypographyDecision({
      ...baseInput("proj-rw", [{
        sceneId: "scene-rw",
        texts: [{ role: "headline", text }],
      }]),
      language: "rw",
    }, catalog);
    const item = decision.scenes[0]!.items[0]!;
    expect(item.lines.join(" ")).toContain("Muraho");
    expect(fontSupportsText(catalog.find((font) => font.id === item.font.id)!, text)).toBe(true);
    const checked = validateTypographyDecision(decision, catalog);
    expect(checked.valid).toBe(true);
  });

  it("TEST I — invalid AI font names and positions are rejected safely", () => {
    const item: TypographyItem = {
      id: "t1",
      role: "headline",
      text: "Hello",
      lines: ["Hello"],
      font: {
        id: "not-installed:FakeScript.ttf",
        family: "FakeScript",
        filePath: "/no/such/font.ttf",
        style: "regular",
        weight: 400,
        personality: "script",
      },
      layout: { region: "center" as TypographyItem["layout"]["region"], normalizedX: 9, normalizedY: -2, alignment: "center" },
      size: { fontSizePx: 999, maxLines: 2 },
      visual: { color: "white", contrastStrategy: "outline" },
      hierarchy: 1,
      confidence: 0.2,
    };
    const unsafe: TypographyDecision = {
      projectId: "proj-ai",
      width: 1080,
      height: 1920,
      aspectRatio: "9:16",
      source: "ai-validated",
      fallbackUsed: false,
      scenes: [{ sceneId: "scene-ai", items: [item] }],
      warnings: [],
      createdAt: new Date().toISOString(),
    };
    expect(validateTypographyDecision(unsafe, catalog).valid).toBe(false);
    const safe = sanitizeAiTypographyDecision({
      ...unsafe,
      scenes: [{
        sceneId: "scene-ai",
        items: [{ ...item, layout: { ...item.layout, region: "not-a-place" as TypographyItem["layout"]["region"] } }],
      }],
    }, catalog);
    expect(safe.fallbackUsed).toBe(true);
    expect(catalog.some((font) => font.id === safe.scenes[0]!.items[0]!.font.id)).toBe(true);
    expect(safe.scenes[0]!.items[0]!.layout.region).toBe("top-center");
    expect(safe.scenes[0]!.items[0]!.layout.normalizedX).toBeGreaterThanOrEqual(0);
    expect(safe.scenes[0]!.items[0]!.layout.normalizedX).toBeLessThanOrEqual(1);
    expect(validateTypographyDecision(safe, catalog).valid).toBe(true);
  });

  it("TEST J — Ollama unavailable still yields a deterministic plan", async () => {
    const previous = process.env.KWIZERA_OLLAMA_DISABLED;
    process.env.KWIZERA_OLLAMA_DISABLED = "1";
    try {
      const decision = await composeTypographyDecision({
        ...baseInput("proj-offline", [{
          sceneId: "scene-offline",
          texts: [{ role: "headline", text: "Still ships" }],
        }]),
        useOllama: true,
      }, catalog);
      expect(decision.scenes[0]?.items[0]?.text).toBe("Still ships");
      expect(decision.source).toBe("deterministic");
      expect(decision.fallbackUsed).toBe(true);
      expect(validateTypographyDecision(decision, catalog).valid).toBe(true);
    } finally {
      if (previous == null) delete process.env.KWIZERA_OLLAMA_DISABLED;
      else process.env.KWIZERA_OLLAMA_DISABLED = previous;
    }
  });

  it("TEST K — typography decisions stay isolated per project id", async () => {
    const a = await composeTypographyDecision({
      ...baseInput("project-a", [{ sceneId: "scene-a", texts: [{ role: "headline", text: "Project A only" }] }]),
      productCategory: "technology",
    }, catalog);
    const b = await composeTypographyDecision({
      ...baseInput("project-b", [{ sceneId: "scene-b", texts: [{ role: "headline", text: "Project B only" }] }]),
      productCategory: "fashion",
    }, catalog);
    expect(a.projectId).toBe("project-a");
    expect(b.projectId).toBe("project-b");
    expect(a.scenes[0]?.sceneId).toBe("scene-a");
    expect(b.scenes[0]?.sceneId).toBe("scene-b");
    expect(a.scenes[0]?.items[0]?.text).toContain("Project A");
    expect(b.scenes[0]?.items[0]?.text).toContain("Project B");
    const layersB = typographySceneToLayers(a, "scene-b", 0, 1000);
    expect(layersB).toEqual([]);
  });

  it("TEST L — validated plans map onto existing renderer text layers", async () => {
    const decision = await composeTypographyDecision({
      ...baseInput("proj-render", [{
        sceneId: "clip-1",
        texts: [{ role: "headline", text: "Ready for FFmpeg" }, { role: "cta", text: "Buy now" }],
        image: { productLikelyCentered: true },
      }]),
    }, catalog);
    const layers = typographySceneToLayers(decision, "clip-1", 0, 1500);
    expect(layers.length).toBeGreaterThan(0);
    expect(layers.every((layer) => ["top", "bottom", "center"].includes(layer.position))).toBe(true);
    const timeline = applyTypographyDecisionToTimeline([clip("clip-1")], decision);
    expect(timeline[0]!.text[0]!.content).not.toBe("fallback");
    const published = publicTypographyDecision(decision);
    expect(published.scenes[0]!.items[0]!.font.filePath).toBeUndefined();
    const diagnostics = await getTypographyDiagnostics();
    expect(diagnostics.deterministicFallback).toBe(true);
    expect(diagnostics.textMeasurementReady).toBe(true);
    expect(diagnostics.placementValidationReady).toBe(true);
    expect(JSON.stringify(diagnostics)).not.toMatch(/C:\\Windows\\Fonts|\/usr\/share\/fonts/);
  });
});
