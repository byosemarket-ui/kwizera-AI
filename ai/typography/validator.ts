import { PLACEMENT_REGIONS, TEXT_ROLES, type PlacementRegion, type TypographyDecision, type VerifiedFont } from "./types.js";

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
      if (item.layout.normalizedX < 0 || item.layout.normalizedX > 1 || item.layout.normalizedY < 0 || item.layout.normalizedY > 1) {
        errors.push(`coordinates out of range for ${item.id}`);
      }
      if (item.size.fontSizePx < 10 || item.size.fontSizePx > 220) errors.push(`font size out of range for ${item.id}`);
      if (!fontIds.has(item.font.id)) errors.push(`unverified font ${item.font.family}`);
      if (!item.lines.length) errors.push(`empty fitted text for ${item.id}`);
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
    items: scene.items.map((item) => {
      const font = fonts.find((entry) => entry.id === item.font.id) ?? fallback;
      const region = PLACEMENT_REGIONS.includes(item.layout.region) ? item.layout.region : "top-center" as PlacementRegion;
      const x = Number.isFinite(item.layout.normalizedX) ? Math.min(1, Math.max(0, item.layout.normalizedX)) : 0.5;
      const y = Number.isFinite(item.layout.normalizedY) ? Math.min(1, Math.max(0, item.layout.normalizedY)) : 0.12;
      if (!font) return item;
      return {
        ...item,
        font: {
          id: font.id,
          family: font.family,
          filePath: font.filePath,
          style: font.style,
          weight: font.weight,
          personality: item.font.personality,
        },
        layout: { ...item.layout, region, normalizedX: x, normalizedY: y },
        size: {
          ...item.size,
          fontSizePx: Math.min(220, Math.max(10, item.size.fontSizePx || 24)),
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
