/**
 * Phase 6 — Product Identity vision QA via Admin-routed VISION_ANALYSIS.
 * Never claims online PASS when vision is unavailable or unparsable.
 */
import type { CapabilityRuntime } from "../admin-control-plane/capability-runtime.js";
import type { ProductIdentityLock } from "../pmv-shared/identity-lock-types.js";

export type VisionIdentityQaStatus = "PASS" | "FAIL" | "UNCERTAIN" | "UNAVAILABLE";

export interface VisionIdentityQaResult {
  available: boolean;
  status: VisionIdentityQaStatus;
  confidence: number;
  failures: string[];
  warnings: string[];
  evidence: string[];
  /** True only when a real online VISION_ANALYSIS execution occurred. */
  onlineExecuted: boolean;
}

function stripSecrets(text: string): string {
  return text
    .replace(/sk-[a-zA-Z0-9_-]{8,}/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/api[_-]?key["']?\s*[:=]\s*["']?[^"',\s]+/gi, "api_key=[redacted]");
}

export function buildVisionIdentityQaPrompt(lock: ProductIdentityLock): string {
  const lines: string[] = [
    `productType: ${lock.productType || "unknown"}`,
    `shape: ${lock.shape?.value ?? "unknown"}`,
    `silhouette: ${lock.silhouette?.value ?? "unknown"}`,
    `colors: ${(lock.colors ?? []).map((c) => c.value).filter(Boolean).join(", ") || "unknown"}`,
    `logo: ${lock.logo?.value ?? "unknown"}`,
    `branding: ${lock.branding?.value ?? "unknown"}`,
    `material: ${lock.material?.value ?? "unknown"}`,
    `texture: ${lock.texture?.value ?? "unknown"}`,
    `pattern: ${lock.pattern?.value ?? "unknown"}`,
    `sole: ${lock.sole?.value ?? "unknown"}`,
    `laces: ${lock.laces?.value ?? "unknown"}`,
    `structure: ${lock.structure?.value ?? "unknown"}`,
    `design: ${lock.design?.value ?? "unknown"}`,
    `proportions: ${lock.proportions?.value ?? "unknown"}`,
    `distinctiveDetails: ${(lock.distinctiveDetails ?? []).map((d) => d.value).filter(Boolean).join("; ") || "none"}`,
  ];
  const allowed = (lock.allowedCreativeChanges ?? []).join(", ");
  return [
    "You are verifying Product Identity Lock fidelity for a marketing video QA gate.",
    "Compare the provided product image against the protected attributes.",
    "Allowed creative changes (do NOT treat as failures): background, lighting, camera, motion, atmosphere, composition, typography, marketing presentation.",
    `Allowed list: ${allowed || "background, lighting, camera, motion, atmosphere, composition"}`,
    "Protected product attributes (failures only if clearly changed/missing):",
    ...lines.map((l) => `- ${l}`),
    "Respond with JSON only:",
    '{"identityMatch":true|false,"criticalFailures":["..."],"allowedCreativeOk":true|false,"confidence":0-1,"notes":["..."]}',
    "identityMatch=true only when critical protected product identity appears preserved.",
    "Do not invent product details. Uncertainty → identityMatch=false with notes explaining uncertainty is preferred over false confidence.",
  ].join("\n");
}

function parseIdentityOutput(text: string | null | undefined): {
  identityMatch: boolean | null;
  criticalFailures: string[];
  notes: string[];
  confidence: number;
} {
  if (!text?.trim()) {
    return { identityMatch: null, criticalFailures: [], notes: ["Empty vision output"], confidence: 0 };
  }
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const raw = start >= 0 && end > start ? text.slice(start, end + 1) : text;
    const parsed = JSON.parse(raw) as {
      identityMatch?: unknown;
      criticalFailures?: unknown;
      notes?: unknown;
      confidence?: unknown;
    };
    const criticalFailures = Array.isArray(parsed.criticalFailures)
      ? parsed.criticalFailures.map((x) => stripSecrets(String(x))).filter(Boolean).slice(0, 8)
      : [];
    const notes = Array.isArray(parsed.notes)
      ? parsed.notes.map((x) => stripSecrets(String(x))).filter(Boolean).slice(0, 8)
      : [];
    const confidence = typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.5;
    const identityMatch = typeof parsed.identityMatch === "boolean" ? parsed.identityMatch : null;
    return { identityMatch, criticalFailures, notes, confidence };
  } catch {
    return {
      identityMatch: null,
      criticalFailures: [],
      notes: ["Vision QA response was not valid JSON"],
      confidence: 0.2,
    };
  }
}

export async function probeVisionQaAvailable(runtime: CapabilityRuntime | null): Promise<boolean> {
  if (!runtime) return false;
  try {
    const view = runtime.describe("VISION_ANALYSIS");
    return (view.status === "READY" || view.status === "FALLBACK") && view.source === "ONLINE";
  } catch {
    return false;
  }
}

export async function runVisionIdentityCheck(input: {
  runtime: CapabilityRuntime | null;
  lock: ProductIdentityLock;
  projectId: string;
  imageBase64: string;
  mimeType?: string;
}): Promise<VisionIdentityQaResult> {
  const { runtime, lock, projectId, imageBase64 } = input;
  if (!runtime) {
    return {
      available: false,
      status: "UNAVAILABLE",
      confidence: 0,
      failures: [],
      warnings: ["Admin capability runtime is not available for vision QA."],
      evidence: [],
      onlineExecuted: false,
    };
  }

  const available = await probeVisionQaAvailable(runtime);
  if (!available) {
    return {
      available: false,
      status: "UNAVAILABLE",
      confidence: 0,
      failures: [],
      warnings: ["Online VISION_ANALYSIS is not configured for identity QA."],
      evidence: [],
      onlineExecuted: false,
    };
  }

  if (!imageBase64) {
    return {
      available: true,
      status: "UNCERTAIN",
      confidence: 0.2,
      failures: [],
      warnings: ["No product image bytes available for vision identity QA."],
      evidence: [],
      onlineExecuted: false,
    };
  }

  const view = runtime.describe("VISION_ANALYSIS");
  const result = await runtime.execute("VISION_ANALYSIS", {
    mode: "vision",
    prompt: buildVisionIdentityQaPrompt(lock),
    images: [
      {
        mimeType: input.mimeType || "image/jpeg",
        base64: imageBase64,
      },
    ],
    projectId,
    timeoutMs: Math.min(90_000, Math.max(15_000, view.timeoutMs ?? 60_000)),
  });

  if (!result.ok) {
    return {
      available: true,
      status: "UNCERTAIN",
      confidence: 0.2,
      failures: [],
      warnings: [
        stripSecrets(
          result.errorMessage
            ? `Online vision QA failed: ${result.errorMessage}`
            : `Online vision QA failed (${result.errorCode ?? "UNKNOWN"})`,
        ),
      ],
      evidence: ["VISION_ANALYSIS executed but did not return a usable identity verdict."],
      onlineExecuted: true,
    };
  }

  const parsed = parseIdentityOutput(result.outputText);
  if (parsed.identityMatch === null) {
    return {
      available: true,
      status: "UNCERTAIN",
      confidence: parsed.confidence,
      failures: [],
      warnings: parsed.notes.length ? parsed.notes : ["Vision identity QA could not be interpreted confidently."],
      evidence: ["Online VISION_ANALYSIS executed for identity QA."],
      onlineExecuted: true,
    };
  }

  if (parsed.identityMatch === false || parsed.criticalFailures.length > 0) {
    return {
      available: true,
      status: "FAIL",
      confidence: parsed.confidence,
      failures: parsed.criticalFailures.length
        ? parsed.criticalFailures
        : ["Vision QA reported product identity mismatch."],
      warnings: parsed.notes,
      evidence: ["Online VISION_ANALYSIS reported a critical identity issue."],
      onlineExecuted: true,
    };
  }

  return {
    available: true,
    status: "PASS",
    confidence: Math.max(0.55, parsed.confidence),
    failures: [],
    warnings: parsed.notes,
    evidence: ["Online VISION_ANALYSIS confirmed protected product identity attributes."],
    onlineExecuted: true,
  };
}

export interface HeroVisionIdentityEvidence {
  status: VisionIdentityQaStatus;
  onlineExecuted: boolean;
  failures: string[];
  warnings: string[];
  evidence: string[];
  confidence: number;
}

interface HeroVisionWorkspace {
  getProject(projectId: string): Promise<{
    productImages: Array<{ id: string; mimeType?: string }>;
    workspaceSettings?: Record<string, unknown>;
  } | null>;
  getOriginalImagePath(projectId: string, imageId: string): Promise<string | null>;
  getAssetImagePath(projectId: string, imageId: string): Promise<string | null>;
}

function uncertain(warning: string): HeroVisionIdentityEvidence {
  return { status: "UNCERTAIN", onlineExecuted: false, failures: [], warnings: [warning], evidence: [], confidence: 0.2 };
}

/**
 * Vision identity QA for a project's locked hero image (used by the QA route and the PMV workflow).
 * Returns customer-safe evidence only; never raw provider output.
 */
export async function checkProjectHeroVisionIdentity(input: {
  runtime: CapabilityRuntime | null;
  workspace: HeroVisionWorkspace;
  projectId: string;
  lockKey: string;
}): Promise<{ visionQaAvailable: boolean; visionIdentity: HeroVisionIdentityEvidence }> {
  const { runtime, workspace, projectId } = input;
  if (!(await probeVisionQaAvailable(runtime))) {
    return {
      visionQaAvailable: false,
      visionIdentity: {
        status: "UNAVAILABLE",
        onlineExecuted: false,
        failures: [],
        warnings: ["Online VISION_ANALYSIS is not configured for identity QA."],
        evidence: [],
        confidence: 0,
      },
    };
  }
  const project = await workspace.getProject(projectId);
  if (!project) throw new Error("Project not found");
  const lock = project.workspaceSettings?.[input.lockKey] as ProductIdentityLock | undefined;
  if (!lock || lock.status !== "LOCKED") {
    return { visionQaAvailable: true, visionIdentity: uncertain("Product Identity Lock is not LOCKED for vision QA.") };
  }
  const heroId = lock.heroAssetId || project.productImages[0]?.id || null;
  if (!heroId) {
    return { visionQaAvailable: true, visionIdentity: uncertain("No hero product image available for vision identity QA.") };
  }
  const imagePath = await workspace.getOriginalImagePath(projectId, heroId)
    ?? await workspace.getAssetImagePath(projectId, heroId);
  if (!imagePath) {
    return { visionQaAvailable: true, visionIdentity: uncertain("Hero product image file could not be resolved for vision QA.") };
  }
  const [{ readFile }, { extname }] = await Promise.all([import("node:fs/promises"), import("node:path")]);
  const bytes = await readFile(imagePath);
  const ext = extname(imagePath).toLowerCase();
  const mimeType = project.productImages.find((img) => img.id === heroId)?.mimeType
    || (ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg");
  const result = await runVisionIdentityCheck({
    runtime,
    lock,
    projectId,
    imageBase64: bytes.toString("base64"),
    mimeType,
  });
  const visionIdentity: HeroVisionIdentityEvidence = {
    status: result.status,
    onlineExecuted: result.onlineExecuted,
    failures: result.failures,
    warnings: result.warnings,
    evidence: result.evidence,
    confidence: result.confidence,
  };
  if (/sk-[a-zA-Z0-9]|api[_-]?key|Bearer\s+\S+/i.test(JSON.stringify(visionIdentity))) {
    throw new Error("Vision QA response rejected for safety");
  }
  return { visionQaAvailable: true, visionIdentity };
}
