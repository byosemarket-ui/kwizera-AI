/**
 * STEP 11 — Professional end card for ENGINE 1 (AI Product Motion).
 * Builds a ~5s closing clip from existing project/brand/commercial data.
 * Does not hard-code company contacts. Reuses timeline text + FFmpeg drawtext.
 * STEP 2A — optional brand logo overlay when logoAssetId resolves.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { encodeRgbaPng } from "../creative-workspace/png-pixels.js";
import type { CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import {
  extractBrandIdentity,
  validateBrandIdentityForEndCard,
} from "../creative-workspace/brand-identity.js";
import { ffmpegBinary } from "./ffmpeg-renderer.js";
import type { VideoRenderPlan, VideoTextLayer, VideoTimelineClip } from "./types.js";

const execFileAsync = promisify(execFile);

export const END_CARD_VERSION = "step2a-end-card-v1";
export const END_CARD_DURATION_MS = 5000;
export const END_CARD_SCENE_ID = "__engine1-end-card__";

export interface EndCardPlan {
  projectId: string;
  version: typeof END_CARD_VERSION;
  durationMs: number;
  companyName: string;
  website: string;
  phone: string;
  cta: string;
  hasLogo: boolean;
  logoAssetId?: string;
  background: "dark-brand";
  required: boolean;
  lines: Array<{ role: "brand" | "website" | "phone" | "cta"; content: string }>;
  issues: string[];
  warnings: string[];
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Prefer brand identity, then product commercial fields. Never invent contacts. */
export function buildEndCardPlan(input: {
  project: CreativeProject;
  preset: "preview" | "standard";
  productionMode?: string | null;
  logoFileExists?: boolean;
}): EndCardPlan {
  const project = input.project;
  const identity = extractBrandIdentity(project);
  const logoCheck = validateBrandIdentityForEndCard(
    identity,
    input.logoFileExists !== false || !identity.logoAssetId,
  );

  const companyName = identity.brandName || asText(project.productInformation?.name);
  const website = identity.websiteUrl;
  const phone = identity.phone;
  // Empty CTA ("None") must stay empty — do not invent fallback CTAs when user cleared it.
  const ctaExplicit = asText(project.campaignInformation?.callToAction)
    || asText(project.productInformation?.callToAction)
    || asText(project.productInformation?.cta);
  const cta = ctaExplicit;

  const lines: EndCardPlan["lines"] = [];
  // Hierarchy: brand → CTA → website → phone (logo is visual, not a text line)
  if (companyName) lines.push({ role: "brand", content: companyName });
  if (cta) lines.push({ role: "cta", content: cta });
  if (website) lines.push({ role: "website", content: website.replace(/^https?:\/\//i, "") });
  if (phone) lines.push({ role: "phone", content: phone });

  const warnings: string[] = [...logoCheck.warnings];
  const issues: string[] = [...logoCheck.issues];
  if (!companyName && !website && !phone && !cta) {
    warnings.push("End card has no brand or contact lines — using minimal brand hold.");
  }
  const required = input.preset === "standard"
    && (input.productionMode == null || input.productionMode === "AI_PRODUCT_MOTION");
  if (required && lines.length === 0) {
    lines.push({ role: "brand", content: asText(project.name) || "Thank you" });
    warnings.push("End card fell back to project name / thank-you line.");
  }

  const logoAssetId = identity.logoAssetId || undefined;
  const hasLogo = Boolean(logoAssetId) && input.logoFileExists !== false;

  return {
    projectId: project.id,
    version: END_CARD_VERSION,
    durationMs: input.preset === "preview" ? 2000 : END_CARD_DURATION_MS,
    companyName,
    website,
    phone,
    cta,
    hasLogo,
    logoAssetId: hasLogo ? logoAssetId : undefined,
    background: "dark-brand",
    required,
    lines,
    issues,
    warnings,
  };
}

export function validateEndCardPlan(plan: EndCardPlan): { valid: boolean; issues: string[] } {
  const issues = [...plan.issues];
  if (plan.projectId.trim() === "") issues.push("End card missing projectId.");
  if (plan.required && plan.durationMs < 1500) issues.push("End card duration is too short.");
  if (plan.required && !plan.lines.some((l) => l.content.trim())) {
    issues.push("Required end card has no visible text lines.");
  }
  return { valid: issues.length === 0, issues };
}

/** Dark professional background PNG (absolute path required by FFmpeg). */
export async function writeEndCardBackground(outputPath: string, width: number, height: number): Promise<string> {
  if (!path.isAbsolute(outputPath)) throw new Error("End card background path must be absolute");
  const w = Math.max(64, Math.round(width));
  const h = Math.max(64, Math.round(height));
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1);
    const r = Math.round(10 + t * 18);
    const g = Math.round(12 + t * 16);
    const b = Math.round(18 + t * 22);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, encodeRgbaPng(w, h, rgba));
  return outputPath;
}

/**
 * Composite brand logo onto end-card background (preserve aspect ratio + alpha).
 * Falls back to background-only if logo is missing/unreadable.
 */
export async function composeEndCardBackground(input: {
  backgroundPath: string;
  outputPath: string;
  logoPath?: string | null;
  width: number;
  height: number;
}): Promise<{ path: string; logoComposited: boolean }> {
  if (!input.logoPath) {
    if (input.backgroundPath !== input.outputPath) {
      await fs.copyFile(input.backgroundPath, input.outputPath);
    }
    return { path: input.outputPath, logoComposited: false };
  }
  try {
    await fs.access(input.logoPath);
  } catch {
    if (input.backgroundPath !== input.outputPath) {
      await fs.copyFile(input.backgroundPath, input.outputPath);
    }
    return { path: input.outputPath, logoComposited: false };
  }

  const maxLogoW = Math.max(48, Math.round(input.width * 0.28));
  const maxLogoH = Math.max(48, Math.round(input.height * 0.16));
  const y = Math.round(input.height * 0.08);
  const filter = [
    `[1:v]scale=${maxLogoW}:${maxLogoH}:force_original_aspect_ratio=decrease,format=rgba[logo]`,
    `[0:v][logo]overlay=(main_w-overlay_w)/2:${y}:format=auto`,
  ].join(";");

  try {
    await execFileAsync(ffmpegBinary(), [
      "-y",
      "-i", input.backgroundPath,
      "-i", input.logoPath,
      "-filter_complex", filter,
      "-frames:v", "1",
      input.outputPath,
    ], { timeout: 60_000, windowsHide: true });
    const stat = await fs.stat(input.outputPath).catch(() => null);
    if (!stat?.size) throw new Error("empty composed background");
    return { path: input.outputPath, logoComposited: true };
  } catch {
    if (input.backgroundPath !== input.outputPath) {
      await fs.copyFile(input.backgroundPath, input.outputPath);
    }
    return { path: input.outputPath, logoComposited: false };
  }
}

function textLayer(content: string, kind: VideoTextLayer["kind"], position: VideoTextLayer["position"], durationMs: number, role?: string): VideoTextLayer {
  return {
    content,
    kind,
    startMs: 0,
    durationMs,
    position,
    typographyRole: role,
  };
}

/** Timeline clip consumed by existing renderStillClip / drawtext path. */
export function buildEndCardClip(plan: EndCardPlan, renderPlan: VideoRenderPlan): VideoTimelineClip {
  const durationMs = plan.durationMs;
  const text: VideoTextLayer[] = [];
  // With logo: brand lower; without: brand centered. CTA/website/phone stay bottom.
  const brandPosition: VideoTextLayer["position"] = plan.hasLogo ? "bottom" : "center";
  for (const line of plan.lines) {
    if (line.role === "brand") {
      text.push(textLayer(line.content, "headline", brandPosition, durationMs, "brand"));
    } else if (line.role === "cta") {
      text.push(textLayer(line.content, "cta", "bottom", durationMs, "cta"));
    } else if (line.role === "website") {
      text.push(textLayer(line.content, "supporting", "bottom", durationMs, "website"));
    } else if (line.role === "phone") {
      text.push(textLayer(line.content, "supporting", "bottom", durationMs, "phone"));
    }
  }
  const assetId = `end-card-bg:${plan.projectId}`;
  return {
    id: `clip-end-card-${plan.projectId.slice(0, 8)}`,
    sceneId: END_CARD_SCENE_ID,
    order: 9999,
    purpose: "END_CARD|BRAND|CLOSING",
    assetId,
    startMs: 0,
    durationMs,
    layer: "video",
    camera: "medium",
    motion: "hold",
    lighting: "studio",
    background: "dark-brand",
    transitionIn: "fade",
    transitionOut: "fade",
    text,
    audioDirection: "none",
    userEdited: false,
    motionPlan: {
      sceneId: END_CARD_SCENE_ID,
      projectId: plan.projectId,
      assetId,
      directedType: "STABLE_HOLD",
      motionId: "hold",
      maxZoom: 1,
      focusX: 0.5,
      focusY: 0.5,
      intensity: 0.2,
      transitionOut: "fade",
      framingBasis: "end-card",
      safetyAdjusted: false,
      fallbackUsed: false,
      reason: "Professional brand end card hold",
    },
    motionParams: {
      maxZoom: 1,
      focusX: 0.5,
      focusY: 0.5,
      intensity: 0.2,
      directedType: "STABLE_HOLD",
      framingBasis: "end-card",
      cropFocusX: 0.5,
      cropFocusY: 0.5,
      safetyAdjusted: false,
      fallbackUsed: false,
    },
    cameraPlan: {
      projectId: plan.projectId,
      sceneId: END_CARD_SCENE_ID,
      assetId,
      mode: "FULL_PRODUCT",
      targetFormat: renderPlan.aspectRatio,
      cropFocusX: 0.5,
      cropFocusY: 0.5,
      zoomStart: 1,
      zoomEnd: 1,
      focusPoint: { x: 0.5, y: 0.5 },
      productVisibilityRequired: false,
      occupancyTarget: 0,
      validationStatus: "valid",
      fallbackUsed: false,
      reason: "End card full-frame brand treatment",
    },
  };
}

export function getEndCardDiagnostics(input?: {
  rendered?: boolean;
  durationMs?: number;
  hasCompany?: boolean;
}) {
  return {
    endCardAvailable: true,
    version: END_CARD_VERSION,
    engine: "AI_PRODUCT_MOTION",
    durationMsDefault: END_CARD_DURATION_MS,
    lastRendered: input?.rendered === true,
    lastDurationMs: input?.durationMs,
    companyDataDriven: true,
    notes: [
      "STEP 11/2A appends a professional dark brand end card from project brand identity.",
      "Company name, website, phone, CTA, and logo come from existing project data — never hard-coded.",
      "Rendered via the existing FFmpeg still-clip + drawtext path before concat.",
    ],
  };
}
