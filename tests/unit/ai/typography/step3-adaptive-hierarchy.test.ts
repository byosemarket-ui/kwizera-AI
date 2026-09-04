import { describe, expect, it } from "vitest";
import { adaptiveFitText } from "../../../../ai/typography/adaptive-sizing.js";
import { classifyTextImportance } from "../../../../ai/typography/hierarchy.js";
import { findEmphasisSpans } from "../../../../ai/typography/emphasis.js";
import { keepCurrencyWithAmount, parsePriceFragments, preferPriceSafeWrap } from "../../../../ai/typography/price-typography.js";
import { mapWeightToInstalled, preferredWeightName } from "../../../../ai/typography/weight-selection.js";
import { controlSceneDensity } from "../../../../ai/typography/density.js";
import { composeTypographyDecision } from "../../../../ai/typography/typography-engine.js";
import { typographySceneToLayers } from "../../../../ai/typography/to-video-layers.js";
import { validateTypographyDecision } from "../../../../ai/typography/validator.js";
import { TEXT_ROLES, type TypographyItem, type VerifiedFont } from "../../../../ai/typography/types.js";

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
  makeFont({
    id: "georgia:Georgia.ttf",
    family: "Georgia",
    category: "serif",
    personalities: ["serif", "fashion", "luxury-serif"],
  }),
];

function base(projectId: string, scenes: Parameters<typeof composeTypographyDecision>[0]["scenes"], aspect: "9:16" | "16:9" | "1:1" = "9:16") {
  const size = aspect === "16:9"
    ? { width: 1920, height: 1080 }
    : aspect === "1:1"
      ? { width: 1080, height: 1080 }
      : { width: 1080, height: 1920 };
  return {
    projectId,
    ...size,
    aspectRatio: aspect,
    platform: aspect === "9:16" ? "tiktok" : "youtube",
    useOllama: false,
    scenes,
  };
}

describe("STEP 3 adaptive typography hierarchy", () => {
  it("TEST A — short product name stays large without unnecessary wrapping", async () => {
    const decision = await composeTypographyDecision(base("p-short", [{
      sceneId: "s1",
      purpose: "HERO REVEAL",
      texts: [{ role: "productName", text: "Aurora" }],
    }]), catalog);
    const item = decision.scenes[0]!.items[0]!;
    expect(item.hierarchyLevel).toBe("PRIMARY");
    expect(item.lines.length).toBe(1);
    expect(item.size.fontSizePx).toBeGreaterThan(40);
  });

  it("TEST B — long product name wraps safely without overflow", async () => {
    const long = "Premium Ultra Lightweight Professional Studio Capture System";
    const decision = await composeTypographyDecision(base("p-long", [{
      sceneId: "s1",
      purpose: "HERO REVEAL",
      texts: [{ role: "productName", text: long }],
    }]), catalog);
    const item = decision.scenes[0]!.items[0]!;
    expect(item.lines.length).toBeGreaterThan(1);
    expect(item.lines.every((line) => line.length > 0)).toBe(true);
    expect(item.size.fontSizePx).toBeGreaterThanOrEqual(14);
    expect(validateTypographyDecision(decision, catalog).valid).toBe(true);
  });

  it("TEST C — price scene: current price primary, previous subordinate, discount emphasis", async () => {
    const decision = await composeTypographyDecision(base("p-price", [{
      sceneId: "s-price",
      purpose: "PRICE OFFER",
      texts: [
        { role: "previousPrice", text: "WAS 50,000 RWF" },
        { role: "price", text: "NOW 35,000 RWF" },
        { role: "discount", text: "SAVE 30%" },
      ],
    }]), catalog);
    const items = decision.scenes[0]!.items;
    const price = items.find((item) => item.role === "price")!;
    const was = items.find((item) => item.role === "previousPrice")!;
    const discount = items.find((item) => item.role === "discount")!;
    expect(price.hierarchyLevel).toBe("PRIMARY");
    expect(was.hierarchyLevel).toBe("SUPPORTING");
    expect(was.importanceScore).toBeLessThan(price.importanceScore);
    expect(discount.emphasis.some((span) => span.kind === "discount" && span.text.includes("30%"))).toBe(true);
    expect(price.emphasis.some((span) => span.kind === "currency_amount")).toBe(true);
    expect(keepCurrencyWithAmount("RWF   25000")).toContain("RWF");
    expect(parsePriceFragments("NOW 35,000 RWF").length).toBeGreaterThan(0);
    expect(preferPriceSafeWrap(["RWF", "25,000"]).join(" ")).toMatch(/RWF/);
  });

  it("TEST D — marketing scene: benefit primary over supporting", async () => {
    const decision = await composeTypographyDecision(base("p-mkt", [{
      sceneId: "s-mkt",
      purpose: "FEATURE BENEFIT",
      texts: [
        { role: "benefit", text: "All-day battery" },
        { role: "supporting", text: "Engineered for creators on the move" },
      ],
    }]), catalog);
    const benefit = decision.scenes[0]!.items.find((item) => item.role === "benefit")!;
    const support = decision.scenes[0]!.items.find((item) => item.role === "supporting")!;
    expect(benefit.hierarchy).toBeLessThan(support.hierarchy);
    expect(benefit.size.fontSizePx).toBeGreaterThanOrEqual(support.size.fontSizePx);
  });

  it("TEST E — CTA scene recognizes critical action", async () => {
    const decision = await composeTypographyDecision(base("p-cta", [{
      sceneId: "s-cta",
      purpose: "CTA CLOSING",
      texts: [
        { role: "cta", text: "Shop Now" },
        { role: "website", text: "www.example.com" },
      ],
    }]), catalog);
    const cta = decision.scenes[0]!.items.find((item) => item.role === "cta")!;
    const web = decision.scenes[0]!.items.find((item) => item.role === "website");
    expect(cta.hierarchyLevel).toBe("CRITICAL_ACTION");
    expect(cta.font.weightName === "bold" || cta.font.weight === 700).toBe(true);
    if (web) {
      expect(web.hierarchyLevel).toBe("MINOR");
      expect(web.importanceScore).toBeLessThan(cta.importanceScore);
    }
  });

  it("TEST F — final company information hierarchy", () => {
    const cta = classifyTextImportance({ role: "cta", text: "Buy Now", purpose: "FINAL CTA" });
    const brand = classifyTextImportance({ role: "brand", text: "KWIZERA", purpose: "FINAL CTA" });
    const website = classifyTextImportance({ role: "website", text: "example.com", purpose: "FINAL CTA" });
    const phone = classifyTextImportance({ role: "phone", text: "+250 788 000 000", purpose: "FINAL CTA" });
    expect(cta.hierarchyLevel).toBe("CRITICAL_ACTION");
    expect(brand.importanceScore).toBeGreaterThan(website.importanceScore);
    expect(website.hierarchyLevel).toBe("MINOR");
    expect(phone.hierarchyLevel).toBe("MINOR");
  });

  it("TEST G — responsive sizing differs across 9:16, 16:9, 1:1", async () => {
    const text = [{ role: "headline" as const, text: "Precision Power" }];
    const portrait = await composeTypographyDecision(base("p-916", [{ sceneId: "a", texts: text }], "9:16"), catalog);
    const landscape = await composeTypographyDecision(base("p-169", [{ sceneId: "a", texts: text }], "16:9"), catalog);
    const square = await composeTypographyDecision(base("p-11", [{ sceneId: "a", texts: text }], "1:1"), catalog);
    const sizes = [
      portrait.scenes[0]!.items[0]!.size.fontSizePx,
      landscape.scenes[0]!.items[0]!.size.fontSizePx,
      square.scenes[0]!.items[0]!.size.fontSizePx,
    ];
    expect(new Set(sizes).size).toBeGreaterThan(1);
    const fitted = adaptiveFitText({
      text: "Precision Power",
      role: "headline",
      hierarchyLevel: "PRIMARY",
      width: 1920,
      height: 1080,
      aspectRatio: "16:9",
      region: "top-center",
      alignment: "center",
    });
    expect(fitted.maxWidthPx).toBeGreaterThan(100);
  });

  it("TEST H — long text stays readable and clipped safely", async () => {
    const long = "This promotional message is intentionally long so adaptive sizing must wrap and reduce size while keeping hierarchy and never falling below the readability floor for primary marketing copy on screen";
    const decision = await composeTypographyDecision(base("p-longtext", [{
      sceneId: "s1",
      purpose: "HOOK",
      texts: [{ role: "headline", text: long }],
    }]), catalog);
    const item = decision.scenes[0]!.items[0]!;
    expect(item.lines.length).toBeGreaterThan(1);
    expect(item.size.fontSizePx).toBeGreaterThanOrEqual(14);
    expect(item.boundingArea.width).toBeGreaterThan(0);
  });

  it("TEST I — font weight maps to installed bold when available", () => {
    expect(preferredWeightName({ hierarchyLevel: "PRIMARY", role: "headline" })).toBe("bold");
    expect(preferredWeightName({ hierarchyLevel: "CRITICAL_ACTION", role: "cta" })).toBe("bold");
    expect(preferredWeightName({ hierarchyLevel: "SUPPORTING", role: "previousPrice" })).toBe("regular");
    const mapped = mapWeightToInstalled("extrabold", catalog[0]!, catalog);
    expect(mapped.font.bold || mapped.weight === 700).toBe(true);
  });

  it("TEST J — project isolation preserved on hierarchy decisions", async () => {
    const a = await composeTypographyDecision(base("project-a", [{
      sceneId: "sa",
      texts: [{ role: "headline", text: "Project A headline" }],
    }]), catalog);
    const b = await composeTypographyDecision(base("project-b", [{
      sceneId: "sb",
      texts: [{ role: "headline", text: "Project B headline" }],
    }]), catalog);
    expect(a.projectId).toBe("project-a");
    expect(b.projectId).toBe("project-b");
    expect(typographySceneToLayers(a, "sb", 0, 1000)).toEqual([]);
    expect(a.scenes[0]!.items[0]!.text).toContain("Project A");
  });

  it("TEST K — Ollama unavailable still yields validated hierarchy", async () => {
    const previous = process.env.KWIZERA_OLLAMA_DISABLED;
    process.env.KWIZERA_OLLAMA_DISABLED = "1";
    try {
      const decision = await composeTypographyDecision({
        ...base("p-ollama", [{
          sceneId: "s1",
          texts: [{ role: "headline", text: "Still ships" }, { role: "cta", text: "Buy now" }],
        }]),
        useOllama: true,
      }, catalog);
      expect(decision.fallbackUsed).toBe(true);
      expect(decision.scenes[0]!.items.some((item) => item.hierarchyLevel === "CRITICAL_ACTION")).toBe(true);
      expect(validateTypographyDecision(decision, catalog).valid).toBe(true);
    } finally {
      if (previous == null) delete process.env.KWIZERA_OLLAMA_DISABLED;
      else process.env.KWIZERA_OLLAMA_DISABLED = previous;
    }
  });

  it("TEST L — renderer layers carry STEP 3 hierarchy metadata for STEP 4", async () => {
    const decision = await composeTypographyDecision(base("p-render", [{
      sceneId: "clip-1",
      purpose: "PRICE OFFER",
      texts: [
        { role: "price", text: "RWF 25,000" },
        { role: "cta", text: "Shop Now" },
      ],
    }]), catalog);
    const layers = typographySceneToLayers(decision, "clip-1", 0, 1500);
    expect(layers[0]?.typography?.hierarchyLevel).toBeTruthy();
    expect(layers[0]?.typography?.boundingArea).toBeTruthy();
    expect(layers[0]?.typography?.emphasis?.length).toBeGreaterThan(0);
    expect(layers.every((layer) => ["top", "bottom", "center"].includes(layer.position))).toBe(true);
  });

  it("controls density by dropping lower-importance items first", () => {
    const mk = (role: TypographyItem["role"], score: number, level: TypographyItem["hierarchyLevel"]): TypographyItem => ({
      id: role,
      role,
      text: role,
      lines: [role],
      font: {
        id: "arial:Arial.ttf",
        family: "Arial",
        style: "regular",
        weight: 400,
        weightName: "regular",
        personality: "clean-sans",
      },
      layout: { region: "top-center", normalizedX: 0.5, normalizedY: 0.12, alignment: "center" },
      size: { fontSizePx: 24, maxLines: 2, maxWidthPx: 800 },
      visual: { color: "white", contrastStrategy: "outline" },
      hierarchy: level === "PRIMARY" || level === "CRITICAL_ACTION" ? 1 : 3,
      hierarchyLevel: level,
      importanceScore: score,
      emphasis: [],
      boundingArea: { x: 0.2, y: 0.1, width: 0.3, height: 0.05 },
      confidence: 0.9,
    });
    const result = controlSceneDensity([
      mk("headline", 0.9, "PRIMARY"),
      mk("supporting", 0.4, "SUPPORTING"),
      mk("website", 0.3, "MINOR"),
      mk("phone", 0.3, "MINOR"),
    ], 3);
    expect(result.trimmed).toBe(true);
    expect(result.items.length).toBeLessThanOrEqual(3);
    expect(result.items.some((item) => item.role === "headline")).toBe(true);
  });

  it("finds emphasis for CTA and numeric discount phrases", () => {
    expect(findEmphasisSpans({ text: "Shop Now", role: "cta" })[0]?.kind).toBe("cta");
    expect(findEmphasisSpans({ text: "Save 30% Today", role: "discount" }).some((span) => span.text.includes("30%"))).toBe(true);
  });
});
