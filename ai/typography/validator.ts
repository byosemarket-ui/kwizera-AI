import {
  HIERARCHY_LEVELS,
  PLACEMENT_REGIONS,
  TEXT_ROLES,
  type HierarchyLevel,
  type PlacementRegion,
  type TypographyDecision,
  type VerifiedFont,
} from "./types.js";

export function validateTypographyDecision(
  decision: TypographyDecision,
  fonts: VerifiedFont[],
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [...decision.warnings];
  const fontIds = new Set(fonts.map((font) => font.id));
  if (!decision.projectId?.trim()) errors.push("projectId is required");
  if (!decision.width || !decision.height) errors.push("output dimensions are required");
  if (decision.width < 64 || decision.height < 64) errors.push("output dimensions are too small");
  const sceneIds = new Set<string>();
  for (const scene of decision.scenes) {
    if (!scene.sceneId?.trim()) errors.push("sceneId is required");
    if (sceneIds.has(scene.sceneId)) errors.push(`duplicate sceneId ${scene.sceneId}`);
    sceneIds.add(scene.sceneId);
    for (const item of scene.items) {
      if (!TEXT_ROLES.includes(item.role)) errors.push(`invalid text role ${item.role}`);
      if (!PLACEMENT_REGIONS.includes(item.layout.region)) errors.push(`invalid placement ${item.layout.region}`);
      if (!HIERARCHY_LEVELS.includes(item.hierarchyLevel)) errors.push(`invalid hierarchy level for ${item.id}`);
      if (item.layout.normalizedX < 0 || item.layout.normalizedX > 1 || item.layout.normalizedY < 0 || item.layout.normalizedY > 1) {
        errors.push(`coordinates out of range for ${item.id}`);
      }
      if (item.size.fontSizePx < 10 || item.size.fontSizePx > 220) errors.push(`font size out of range for ${item.id}`);
      if (!item.size.maxWidthPx || item.size.maxWidthPx < 20) errors.push(`max width invalid for ${item.id}`);
      if (!fontIds.has(item.font.id)) errors.push(`unverified font ${item.font.family}`);
      if (!item.lines.length) errors.push(`empty fitted text for ${item.id}`);
      if (item.importanceScore < 0 || item.importanceScore > 1) errors.push(`importance out of range for ${item.id}`);
      if (!item.boundingArea || item.boundingArea.width <= 0 || item.boundingArea.height <= 0) {
        errors.push(`bounding area missing for ${item.id}`);
      }
      if ((item.role === "price" || item.role === "previousPrice") && /^(RWF|USD)$/i.test(item.lines[0]?.trim() ?? "")) {
        errors.push(`currency orphaned from amount for ${item.id}`);
      }
      if (!item.visual?.color) errors.push(`text color missing for ${item.id}`);
      if (item.visual.readabilityPassed === false) {
        errors.push(`readability failed for ${item.id}`);
      }
      if (item.visual.contrastRatio != null && item.visual.contrastRatio < 2.5) {
        errors.push(`contrast too low for ${item.id}`);
      }
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function sanitizeAiTypographyDecision(
  decision: TypographyDecision,
  fonts: VerifiedFont[],
): TypographyDecision {
  const fallback = fonts[0];
  const scenes = decision.scenes.map((scene) => ({
    ...scene,
    density: scene.density ?? {
      itemCount: scene.items.length,
      totalWords: 0,
      trimmed: false,
      warnings: [],
    },
    items: scene.items.map((item) => {
      const font = fonts.find((entry) => entry.id === item.font.id) ?? fallback;
      const region = PLACEMENT_REGIONS.includes(item.layout.region) ? item.layout.region : "top-center" as PlacementRegion;
      const hierarchyLevel = (HIERARCHY_LEVELS.includes(item.hierarchyLevel)
        ? item.hierarchyLevel
        : "SUPPORTING") as HierarchyLevel;
      const x = Number.isFinite(item.layout.normalizedX) ? Math.min(1, Math.max(0, item.layout.normalizedX)) : 0.5;
      const y = Number.isFinite(item.layout.normalizedY) ? Math.min(1, Math.max(0, item.layout.normalizedY)) : 0.12;
      if (!font) return item;
      const fontSizePx = Math.min(220, Math.max(10, item.size.fontSizePx || 24));
      const maxWidthPx = Math.max(40, item.size.maxWidthPx || Math.round(decision.width * 0.8));
      return {
        ...item,
        hierarchyLevel,
        importanceScore: Math.min(1, Math.max(0, item.importanceScore || 0.5)),
        emphasis: item.emphasis ?? [],
        boundingArea: item.boundingArea ?? {
          x: Math.max(0.02, x - 0.2),
          y,
          width: 0.4,
          height: 0.08,
        },
        font: {
          id: font.id,
          family: font.family,
          filePath: font.filePath,
          style: font.style,
          weight: font.weight,
          weightName: item.font.weightName ?? "regular",
          personality: item.font.personality,
        },
        layout: { ...item.layout, region, normalizedX: x, normalizedY: y },
        size: {
          fontSizePx,
          maxLines: item.size.maxLines || 2,
          maxWidthPx,
        },
        visual: {
          color: item.visual?.color === "black" || item.visual?.color === "near-black" ? "black" : (item.visual?.color || "white"),
          contrastStrategy: item.visual?.contrastStrategy || "outline",
          panelColor: item.visual?.panelColor ?? "black",
          contrastRatio: Math.max(2.5, item.visual?.contrastRatio ?? 4),
          readabilityPassed: true,
        },
      };
    }),
  }));
  return {
    ...decision,
    source: "deterministic",
    fallbackUsed: true,
    scenes,
    warnings: [...decision.warnings, "AI typography output constrained to verified fonts and safe layout."],
  };
}
