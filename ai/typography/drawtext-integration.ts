/**
 * Build FFmpeg drawtext filters from validated timeline typography.
 * Extends the existing drawtext path — does not create a second renderer.
 */
import fs from "node:fs/promises";
import type { ContrastStrategy } from "./types.js";
import type { VideoRenderPlan, VideoTextLayer, VideoTimelineClip } from "../video-production/types.js";
import { sanitizeRenderText } from "../video-production/ffmpeg-sanitize.js";
import { getVerifiedFonts, pickFallbackFont } from "./font-registry.js";

export function escapeFontFileForDrawtext(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:");
}

export function drawtextX(alignment: "left" | "center" | "right", normalizedX: number): string {
  const nx = Math.min(0.98, Math.max(0.02, normalizedX));
  if (alignment === "left") return `w*${nx.toFixed(4)}`;
  if (alignment === "right") return `w*${nx.toFixed(4)}-text_w`;
  return `w*${nx.toFixed(4)}-(text_w/2)`;
}

export function contrastDrawtextExtras(
  strategy: ContrastStrategy,
  scale: number,
  panelColor: "black" | "white" = "black",
): string {
  const border = Math.max(1, scale);
  if (strategy === "panel") {
    const fill = panelColor === "white" ? "white@0.55" : "black@0.55";
    const borderCol = panelColor === "white" ? "white@0.35" : "black@0.35";
    return `box=1:boxcolor=${fill}:boxborderw=${Math.max(6, border * 4)}:borderw=${border}:bordercolor=${borderCol}`;
  }
  if (strategy === "shadow") {
    return `shadowx=${border}:shadowy=${border}:shadowcolor=black@0.75:borderw=${border}:bordercolor=black@0.35`;
  }
  if (strategy === "none") {
    return `borderw=0`;
  }
  return `borderw=${Math.max(1, border)}:bordercolor=black@0.65`;
}

export async function resolveFontPathForId(
  fontId: string | undefined,
  fallbackFontFile?: string,
): Promise<{ path: string; usedFallback: boolean; family?: string } | null> {
  const fonts = await getVerifiedFonts();
  const match = fontId ? fonts.find((font) => font.id === fontId) : undefined;
  if (match) {
    try {
      await fs.access(match.filePath);
      return { path: match.filePath, usedFallback: false, family: match.family };
    } catch {
      /* fall through */
    }
  }
  const fallback = pickFallbackFont(fonts);
  if (fallback) {
    try {
      await fs.access(fallback.filePath);
      return { path: fallback.filePath, usedFallback: true, family: fallback.family };
    } catch {
      /* fall through */
    }
  }
  if (fallbackFontFile) {
    try {
      await fs.access(fallbackFontFile);
      return { path: fallbackFontFile, usedFallback: true };
    } catch {
      return null;
    }
  }
  return null;
}

function layerFontSize(layer: VideoTextLayer, plan: VideoRenderPlan): number {
  const typed = layer.typography?.fontSizePx;
  if (typed && Number.isFinite(typed)) {
    const minDim = Math.min(plan.width, plan.height);
    // Typography sizes are absolute px for the compose frame; clamp for preview/standard.
    return Math.max(12, Math.min(Math.round(minDim * 0.12), Math.round(typed)));
  }
  const scale = Math.max(1, Math.round(Math.min(plan.width, plan.height) / 480));
  if (layer.kind === "price_was") return 16 * scale;
  if (layer.kind === "price_save") return 18 * scale;
  if (layer.kind === "price") return 26 * scale;
  if (layer.kind === "headline") return 22 * scale;
  return 20 * scale;
}

function layerColor(layer: VideoTextLayer): string {
  if (layer.typography?.color && /^#[0-9a-f]{6}$/i.test(layer.typography.color)) {
    return `0x${layer.typography.color.slice(1)}`;
  }
  if (layer.typography?.color && /^0x[0-9a-f]+$/i.test(layer.typography.color)) {
    return layer.typography.color;
  }
  if (layer.typography?.color === "black" || layer.typography?.color === "near-black") return "black";
  if (layer.typography?.color === "white" || layer.typography?.color === "near-white") return "white";
  if (layer.kind === "price_save") return "0xFFD966";
  return "white";
}

function legacyY(layer: VideoTextLayer, plan: VideoRenderPlan, bottomIndex: number): string {
  if (layer.position === "center") return "(h-text_h)/2";
  if (layer.position === "top") return `h*${plan.aspectRatio === "9:16" ? "0.12" : "0.08"}`;
  const baseY = plan.aspectRatio === "9:16" ? 0.82 : 0.86;
  const offset = bottomIndex * (plan.aspectRatio === "9:16" ? 0.06 : 0.05);
  return `h*${Math.max(0.55, baseY - offset)}`;
}

/**
 * Prefer validated typography coordinates/fonts; fall back to legacy top/bottom/center.
 */
export async function buildDrawtextFilter(
  clip: VideoTimelineClip,
  plan: VideoRenderPlan,
  fallbackFontFile?: string,
): Promise<{ filter: string; usedFallbackFont: boolean; layersDrawn: number }> {
  if (!clip.text.length) return { filter: "", usedFallbackFont: false, layersDrawn: 0 };
  const scale = Math.max(1, Math.round(Math.min(plan.width, plan.height) / 480));
  const filters: string[] = [];
  let usedFallbackFont = false;
  let layersDrawn = 0;
  const layers = [...clip.text]
    .sort((a, b) => (a.typography?.hierarchy ?? 99) - (b.typography?.hierarchy ?? 99))
    .slice(0, 4);

  let bottomIndex = 0;
  for (const layer of layers) {
    const resolved = await resolveFontPathForId(layer.typography?.fontId, fallbackFontFile);
    if (!resolved) continue;
    if (resolved.usedFallback) usedFallbackFont = true;
    const font = escapeFontFileForDrawtext(resolved.path);
    const fontSize = layerFontSize(layer, plan);
    const color = layerColor(layer);
    const lines = (layer.typography?.lines?.length
      ? layer.typography.lines
      : [layer.content])
      .map((line) => sanitizeRenderText(line))
      .filter(Boolean)
      .slice(0, layer.typography?.lines?.length ? 4 : 1);
    if (!lines.length) continue;

    const hasTypography = Boolean(layer.typography);
    const alignment = layer.typography?.alignment ?? "center";
    const nx = layer.typography?.normalizedX ?? 0.5;
    const ny = layer.typography?.normalizedY
      ?? (layer.position === "bottom" ? 0.86 : layer.position === "center" ? 0.5 : 0.12);
    const contrast = contrastDrawtextExtras(
      layer.typography?.contrastStrategy ?? "outline",
      scale,
      layer.typography?.panelColor ?? "black",
    );
    const xExpr = hasTypography ? drawtextX(alignment, nx) : "(w-text_w)/2";
    const lineGap = Math.max(2, Math.round(fontSize * 1.22));

    lines.forEach((line, lineIndex) => {
      const yExpr = hasTypography
        ? `h*${ny.toFixed(4)}+${lineIndex * lineGap}`
        : legacyY(layer, plan, bottomIndex);
      filters.push(
        `drawtext=fontfile='${font}':text='${line}':fontsize=${fontSize}:fontcolor=${color}:${contrast}:x=${xExpr}:y=${yExpr}`,
      );
    });
    layersDrawn += 1;
    if (!hasTypography && layer.position === "bottom") bottomIndex += 1;
  }

  return {
    filter: filters.join(","),
    usedFallbackFont,
    layersDrawn,
  };
}
