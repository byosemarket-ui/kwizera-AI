import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminControlPlaneManager } from "../../../../ai/admin-control-plane/admin-control-plane-manager.js";
import { AdminCredentialManager } from "../../../../ai/admin-control-plane/credential-manager.js";
import { createCapabilityRuntime } from "../../../../ai/admin-control-plane/capability-runtime.js";
import { buildFalImageBody, extractFalImageUrl } from "../../../../ai/admin-control-plane/fal-image-adapter.js";
import { AiSecretsManager } from "../../../../ai/connector-management/secrets-manager.js";
import {
  decideImagePreparation,
  imagePrepFingerprint,
  needsImagePreparation,
  sanitizeCreativeRequest,
} from "../../../../ai/image-preparation/decision.js";
import { buildImageEditPrompt } from "../../../../ai/image-preparation/edit-prompt.js";
import {
  describeImagePrepAvailability,
  runImagePreparation,
  type ImagePrepDeps,
} from "../../../../ai/image-preparation/pipeline.js";
import { prepareSceneImage, readCreativeRequest } from "../../../../ai/image-preparation/scene-preparation.js";
import { imagePrepMaxAttempts, type ImagePreparationRecord } from "../../../../ai/image-preparation/types.js";
import { RASTER_SIZE, validateDerivedImage, validateMask } from "../../../../ai/image-preparation/validation.js";
import { resolveProductionRenderProfile } from "../../../../ai/video-production/production-render-profile.js";
import { setAdminOnlineImageToVideoAvailable } from "../../../../ai/video-production/production-mode-types.js";
import { mapPmvModeToProduction, DEFAULT_PMV_CREATIVE_DIRECTION } from "../../../../desktop/pmv-creative/types.js";

const roots: string[] = [];

afterEach(async () => {
  setAdminOnlineImageToVideoAvailable(false);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function tempDir(prefix = "kwizera-phase7-"): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  roots.push(dir);
  return dir;
}

/** Minimal PNG header (dimensions only) padded so size checks pass. */
function fakePng(width: number, height: number, fill = 0): Buffer {
  const buf = Buffer.alloc(2_048, fill);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

const N = RASTER_SIZE;

function raster(fn: (x: number, y: number) => number): Uint8Array {
  const out = new Uint8Array(N * N);
  for (let y = 0; y < N; y += 1) for (let x = 0; x < N; x += 1) out[y * N + x] = fn(x, y);
  return out;
}

const inCenter = (x: number, y: number) => x >= 16 && x < 48 && y >= 16 && y < 48;
const PRODUCT_MASK = raster((x, y) => (inCenter(x, y) ? 255 : 0));
const SOURCE_RASTER = raster(() => 100);
/** Background changed, product pixels untouched. */
const GOOD_EDIT_RASTER = raster((x, y) => (inCenter(x, y) ? 100 : 220));
/** Product pixels repainted. */
const BAD_EDIT_RASTER = raster(() => 220);

type Feature = "IMAGE_SEGMENTATION" | "IMAGE_EDITING" | "IMAGE_UPSCALE";
type Behavior = (input: Record<string, unknown>, call: number) => { ok: true; bytes: Buffer } | { ok: false; message: string; code?: string };

function mockRuntime(opts: {
  online?: Partial<Record<Feature, boolean>>;
  acceptsMask?: boolean;
  behavior: Partial<Record<Feature, Behavior>>;
}) {
  const calls: Array<{ feature: Feature; input: Record<string, unknown> }> = [];
  const counts: Record<string, number> = {};
  const runtime = {
    describe: (feature: string) => {
      const on = opts.online?.[feature as Feature] ?? true;
      return {
        feature,
        status: on ? "READY" : "UNAVAILABLE",
        source: on ? "ONLINE" : "LOCAL",
        acceptsMask: feature === "IMAGE_EDITING" ? opts.acceptsMask ?? true : false,
      };
    },
    execute: vi.fn(async (feature: Feature, input: Record<string, unknown>) => {
      calls.push({ feature, input });
      counts[feature] = (counts[feature] ?? 0) + 1;
      const behavior = opts.behavior[feature];
      if (!behavior) return { ok: false, errorCode: "NOT_IMPLEMENTED", errorMessage: "no behavior" };
      const result = behavior(input, counts[feature]!);
      if (!result.ok) return { ok: false, errorCode: result.code ?? "PROVIDER_UNAVAILABLE", errorMessage: result.message };
      await fs.writeFile(String(input.outputPath), result.bytes);
      return { ok: true, output: { imagePath: input.outputPath }, providerId: "provider-fal", modelId: "fal-ai/x" };
    }),
  };
  return { runtime: runtime as never, calls };
}

function depsFor(runtime: unknown, rasters: { edit?: Uint8Array; enhance?: Uint8Array; mask?: Uint8Array } = {}): ImagePrepDeps {
  return {
    runtime: runtime as never,
    readRaster: async (file) => {
      const name = path.basename(file);
      if (name.includes("segmentation")) return rasters.mask ?? PRODUCT_MASK;
      if (name.includes("enhancement")) return rasters.enhance ?? SOURCE_RASTER;
      if (name.includes("editing")) return rasters.edit ?? GOOD_EDIT_RASTER;
      return SOURCE_RASTER;
    },
    writeEditMask: async (_mask, out) => {
      await fs.writeFile(out, fakePng(1200, 1200));
      return true;
    },
    reencodeJpeg: async () => false,
  };
}

async function setupSource(width = 1200, height = 1200) {
  const dir = await tempDir();
  const sourcePath = path.join(dir, "original-asset-1.png");
  const bytes = fakePng(width, height, 7);
  await fs.writeFile(sourcePath, bytes);
  const outDir = path.join(dir, "image-prep", "proj-1");
  return { dir, sourcePath, outDir, sourceHash: createHash("sha256").update(bytes).digest("hex") };
}

function baseInput(sourcePath: string, outDir: string, decision: ReturnType<typeof decideImagePreparation>, prior?: ImagePreparationRecord | null) {
  const fingerprint = imagePrepFingerprint(decision, true);
  return {
    key: `asset-1:${fingerprint}`,
    fingerprint,
    projectId: "proj-1",
    sourceAssetId: "asset-1",
    sourcePath,
    outDir,
    decision,
    identity: { productName: "Trail Runner", protectedAttributes: ["logo", "sole", "color"], colors: ["navy"] },
    targetPoint: { x: 0.5, y: 0.5 },
    prior: prior ?? null,
    maxAttempts: 2,
  };
}

const BG_REQUEST = "Put the shoes in a luxury studio environment with cinematic lighting";

async function boot() {
  const storageRoot = await tempDir("kwizera-phase7-admin-");
  const secrets = new AiSecretsManager();
  await secrets.initialize(storageRoot, "test-passphrase-phase7");
  const credentials = new AdminCredentialManager();
  credentials.attach(secrets);
  const manager = new AdminControlPlaneManager();
  await manager.initialize(storageRoot, { credentials });
  return { manager, credentials };
}

describe("Phase 7 — A. Admin routing", () => {
  it("routes IMAGE_SEGMENTATION / IMAGE_EDITING / IMAGE_UPSCALE through Admin mappings to fal", async () => {
    const { manager, credentials } = await boot();
    await manager.setProviderSecret("provider-fal", "fal-phase7-key-not-real", { enable: true });
    const runtime = createCapabilityRuntime(manager, credentials);
    const expected: Record<Feature, string> = {
      IMAGE_SEGMENTATION: "fal-ai/sam2/image",
      IMAGE_EDITING: "fal-ai/flux-pro/v1/fill",
      IMAGE_UPSCALE: "fal-ai/esrgan",
    };
    for (const feature of Object.keys(expected) as Feature[]) {
      const resolution = manager.resolveFeatureExecution(feature);
      expect(resolution.status).toBe("READY");
      expect(resolution.providerId).toBe("provider-fal");
      expect(resolution.selectedModel?.modelId).toBe(expected[feature]);
      const view = runtime.describe(feature);
      expect(view.source).toBe("ONLINE");
      expect(view.adapterId).toBe("fal");
      expect(JSON.stringify(view)).not.toContain("fal-phase7-key-not-real");
    }
    expect(runtime.describe("IMAGE_EDITING").acceptsMask).toBe(true);
    const availability = describeImagePrepAvailability(runtime);
    expect(availability).toEqual({ segmentation: true, editing: true, enhancement: true, editorAcceptsMask: true });
  });

  it("reports unavailable without a credential (no fake online claim)", async () => {
    const { manager, credentials } = await boot();
    const runtime = createCapabilityRuntime(manager, credentials);
    const availability = describeImagePrepAvailability(runtime);
    expect(availability.editing).toBe(false);
    expect(availability.segmentation).toBe(false);
    expect(availability.enhancement).toBe(false);
  });

  it("builds provider bodies per model family; mask only sent to fill/inpaint models", () => {
    const image = { mimeType: "image/png", base64: "aGVsbG8=" };
    const mask = { mimeType: "image/png", base64: "bWFzaw==" };
    const seg = buildFalImageBody("image-segmentation", "fal-ai/sam2/image", {
      images: [image],
      targetPoint: { x: 600.4, y: 300.6 },
    });
    expect(seg.prompts).toEqual([{ x: 600, y: 301, label: 1 }]);
    const fill = buildFalImageBody("image-editing", "fal-ai/flux-pro/v1/fill", { images: [image], maskImage: mask, prompt: "p" });
    expect(String(fill.mask_url)).toContain("data:image/png;base64,");
    const kontext = buildFalImageBody("image-editing", "fal-ai/flux-pro/kontext", { images: [image], maskImage: mask, prompt: "p" });
    expect(kontext.mask_url).toBeUndefined();
    const up = buildFalImageBody("image-enhancement", "fal-ai/esrgan", { images: [image], upscaleFactor: 4 });
    expect(up.scale).toBe(4);
    expect(extractFalImageUrl({ images: [{ url: "https://x/y.jpg" }] })).toBe("https://x/y.jpg");
    expect(extractFalImageUrl({ image: { url: "https://x/m.png" } })).toBe("https://x/m.png");
  });
});

describe("Phase 7 — B. Conditional execution", () => {
  it("simple high-res project with no request → no image operations", async () => {
    const { dir, sourcePath } = await setupSource(1600, 1600);
    const { runtime, calls } = mockRuntime({ behavior: {} });
    const result = await prepareSceneImage({
      root: dir,
      projectId: "proj-1",
      sourceAssetId: "asset-1",
      sourcePath,
      workspaceSettings: {},
      identity: null,
      runtime,
      ops: depsFor(runtime),
    });
    expect(result.imagePath).toBe(sourcePath);
    expect(result.record).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("decides enhancement only for low resolution, editing+segmentation only for background requests", () => {
    const low = decideImagePreparation({ generativeVideo: true, sourceWidth: 500, sourceHeight: 400, editorAcceptsMask: true });
    expect(low).toMatchObject({ enhancementRequired: true, imageEditingRequired: false, segmentationRequired: false, upscaleFactor: 2 });
    const tiny = decideImagePreparation({ generativeVideo: true, sourceWidth: 300, sourceHeight: 300, editorAcceptsMask: true });
    expect(tiny.upscaleFactor).toBe(4);
    const bg = decideImagePreparation({ generativeVideo: true, creativeRequest: BG_REQUEST, sourceWidth: 1600, sourceHeight: 1600, editorAcceptsMask: true });
    expect(bg).toMatchObject({ imageEditingRequired: true, segmentationRequired: true, enhancementRequired: false });
    const noMask = decideImagePreparation({ generativeVideo: true, creativeRequest: BG_REQUEST, sourceWidth: 1600, sourceHeight: 1600, editorAcceptsMask: false });
    expect(noMask.segmentationRequired).toBe(false);
    expect(noMask.imageEditingRequired).toBe(true);
    const bigExplicit = decideImagePreparation({ generativeVideo: true, creativeRequest: "make it sharper", sourceWidth: 3000, sourceHeight: 3000, editorAcceptsMask: true });
    expect(bigExplicit.enhancementRequired).toBe(false);
    const plain = decideImagePreparation({ generativeVideo: true, sourceWidth: 1600, sourceHeight: 1600, editorAcceptsMask: true });
    expect(needsImagePreparation(plain)).toBe(false);
  });

  it("reads the customer creative request from PMV workspace settings", () => {
    expect(readCreativeRequest({ productMarketingVideo: { creativeDirection: { creativeRequest: BG_REQUEST } } })).toBe(BG_REQUEST);
    expect(readCreativeRequest({})).toBe("");
    expect(DEFAULT_PMV_CREATIVE_DIRECTION().creativeRequest).toBe("");
  });
});

describe("Phase 7 — C. Segmentation / mask validation", () => {
  const source = { width: 1200, height: 1200 };
  it("accepts a valid product mask", () => {
    const result = validateMask({ source, mask: source, raster: PRODUCT_MASK, targetPoint: { x: 0.5, y: 0.5 } });
    expect(result.ok).toBe(true);
    expect(result.inverted).toBe(false);
  });
  it("normalizes a background-white mask", () => {
    const inverted = raster((x, y) => (inCenter(x, y) ? 0 : 255));
    const result = validateMask({ source, mask: source, raster: inverted, targetPoint: { x: 0.5, y: 0.5 } });
    expect(result.ok).toBe(true);
    expect(result.inverted).toBe(true);
  });
  it("rejects empty, full-frame, mismatched, non-binary and off-product masks", () => {
    expect(validateMask({ source, mask: source, raster: raster(() => 0), targetPoint: null }).ok).toBe(false);
    expect(validateMask({ source, mask: source, raster: raster(() => 255), targetPoint: null }).ok).toBe(false);
    expect(validateMask({ source, mask: { width: 600, height: 600 }, raster: PRODUCT_MASK, targetPoint: null }).ok).toBe(false);
    expect(validateMask({ source, mask: source, raster: raster(() => 128), targetPoint: null }).ok).toBe(false);
    const corner = raster((x, y) => (x < 8 && y < 8 ? 255 : 0));
    const off = validateMask({ source, mask: source, raster: corner, targetPoint: { x: 0.5, y: 0.5 } });
    expect(off.ok).toBe(false);
    expect(validateMask({ source, mask: null, raster: null }).issues[0]).toMatch(/missing/i);
  });

  it("invalid segmentation blocks the mask-guided edit and keeps the original", async () => {
    const { sourcePath, outDir } = await setupSource();
    const { runtime, calls } = mockRuntime({
      behavior: { IMAGE_SEGMENTATION: () => ({ ok: true, bytes: fakePng(1200, 1200) }) },
    });
    const decision = decideImagePreparation({ generativeVideo: true, creativeRequest: BG_REQUEST, sourceWidth: 1200, sourceHeight: 1200, editorAcceptsMask: true });
    const out = await runImagePreparation(baseInput(sourcePath, outDir, decision), depsFor(runtime, { mask: raster(() => 0) }));
    expect(out.imagePath).toBe(sourcePath);
    expect(out.record.stages.SEGMENTATION?.status).toBe("REJECTED");
    expect(out.record.stages.SEGMENTATION?.attempts).toBe(2);
    expect(out.record.stages.EDITING?.status).toBe("BLOCKED");
    expect(out.record.finalSource).toBe("ORIGINAL");
    expect(out.record.fallbackUsed).toBe(true);
    expect(calls.filter((c) => c.feature === "IMAGE_EDITING")).toHaveLength(0);
  });
});

describe("Phase 7 — D. Editing creates a derived asset; original unchanged", () => {
  it("mask-guided edit produces a new file and never touches the original", async () => {
    const { sourcePath, outDir, sourceHash } = await setupSource();
    const { runtime, calls } = mockRuntime({
      behavior: {
        IMAGE_SEGMENTATION: () => ({ ok: true, bytes: fakePng(1200, 1200) }),
        IMAGE_EDITING: () => ({ ok: true, bytes: fakePng(1200, 1200, 3) }),
      },
    });
    const decision = decideImagePreparation({ generativeVideo: true, creativeRequest: BG_REQUEST, sourceWidth: 1200, sourceHeight: 1200, editorAcceptsMask: true });
    const out = await runImagePreparation(baseInput(sourcePath, outDir, decision), depsFor(runtime));
    expect(out.record.stages.SEGMENTATION?.status).toBe("ACCEPTED");
    expect(out.record.stages.EDITING?.status).toBe("ACCEPTED");
    expect(out.record.stages.EDITING?.identityStatus).toBe("DETERMINISTIC_PASS");
    expect(out.record.finalSource).toBe("PREPARED");
    expect(out.imagePath).not.toBe(sourcePath);
    expect(path.dirname(out.imagePath)).toBe(outDir);
    await expect(fs.stat(out.imagePath)).resolves.toBeTruthy();
    const after = createHash("sha256").update(await fs.readFile(sourcePath)).digest("hex");
    expect(after).toBe(sourceHash);
    const editCall = calls.find((c) => c.feature === "IMAGE_EDITING")!;
    expect(editCall.input.mode).toBe("image-editing");
    expect(editCall.input.maskImage).toBeTruthy();
  });

  it("rejects edits that repaint product pixels and falls back to the original", async () => {
    const { sourcePath, outDir } = await setupSource();
    const { runtime } = mockRuntime({
      behavior: {
        IMAGE_SEGMENTATION: () => ({ ok: true, bytes: fakePng(1200, 1200) }),
        IMAGE_EDITING: () => ({ ok: true, bytes: fakePng(1200, 1200, 3) }),
      },
    });
    const decision = decideImagePreparation({ generativeVideo: true, creativeRequest: BG_REQUEST, sourceWidth: 1200, sourceHeight: 1200, editorAcceptsMask: true });
    const out = await runImagePreparation(baseInput(sourcePath, outDir, decision), depsFor(runtime, { edit: BAD_EDIT_RASTER }));
    expect(out.record.stages.EDITING?.status).toBe("REJECTED");
    expect(out.record.stages.EDITING?.history.every((h) => h.reason === "Product pixels changed during editing")).toBe(true);
    expect(out.imagePath).toBe(sourcePath);
    expect(out.record.fallbackUsed).toBe(true);
  });

  it("rejects cropped / distorted derived images", () => {
    const bad = validateDerivedImage({ bytes: fakePng(1600, 900), source: { width: 1200, height: 1200 } });
    expect(bad.ok).toBe(false);
  });
});

describe("Phase 7 — E. Product Lock in edit prompts", () => {
  it("separates PRODUCT — LOCKED from ENVIRONMENT — EDITABLE and strips product-changing clauses", () => {
    const prompt = buildImageEditPrompt({
      request: `${BG_REQUEST}. Make the shoes red. Change the logo to gold.`,
      identity: { productName: "Trail Runner", protectedAttributes: ["logo", "sole"], colors: ["navy"] },
      maskGuided: true,
    });
    const lockedAt = prompt.indexOf("PRODUCT — LOCKED:");
    const editableAt = prompt.indexOf("ENVIRONMENT — EDITABLE:");
    expect(lockedAt).toBeGreaterThanOrEqual(0);
    expect(editableAt).toBeGreaterThan(lockedAt);
    expect(prompt).toContain("Do not change: logo, sole.");
    expect(prompt).toContain("Exact colors: navy");
    expect(prompt).toContain("luxury studio environment");
    expect(prompt).not.toMatch(/shoes red/i);
    expect(prompt).not.toMatch(/logo to gold/i);
    const sanitized = sanitizeCreativeRequest("Make the background red. Make the shoes red.");
    expect(sanitized.text).toBe("Make the background red.");
    expect(sanitized.rejected).toBe(1);
  });
});

describe("Phase 7 — F. Optional enhancement", () => {
  it("enhances a low-resolution source through IMAGE_UPSCALE", async () => {
    const { sourcePath, outDir } = await setupSource(500, 500);
    const { runtime, calls } = mockRuntime({
      behavior: { IMAGE_UPSCALE: (input) => ({ ok: true, bytes: fakePng(500 * Number(input.upscaleFactor), 500 * Number(input.upscaleFactor)) }) },
    });
    const decision = decideImagePreparation({ generativeVideo: true, sourceWidth: 500, sourceHeight: 500, editorAcceptsMask: true });
    const out = await runImagePreparation(baseInput(sourcePath, outDir, decision), depsFor(runtime));
    expect(out.record.stages.ENHANCEMENT?.status).toBe("ACCEPTED");
    expect(out.record.stages.ENHANCEMENT?.width).toBe(1000);
    expect(calls.map((c) => c.feature)).toEqual(["IMAGE_UPSCALE"]);
    expect(out.imagePath).not.toBe(sourcePath);
  });

  it("enhancement failure keeps the original (truthful fallback)", async () => {
    const { sourcePath, outDir } = await setupSource(500, 500);
    const { runtime } = mockRuntime({ behavior: { IMAGE_UPSCALE: () => ({ ok: false, message: "timeout", code: "TIMEOUT" }) } });
    const decision = decideImagePreparation({ generativeVideo: true, sourceWidth: 500, sourceHeight: 500, editorAcceptsMask: true });
    const out = await runImagePreparation(baseInput(sourcePath, outDir, decision), depsFor(runtime));
    expect(out.imagePath).toBe(sourcePath);
    expect(out.record.stages.ENHANCEMENT?.status).toBe("REJECTED");
    expect(out.record.stages.ENHANCEMENT?.onlineExecuted).toBe(true);
    expect(out.record.fallbackUsed).toBe(true);
  });

  it("enhancement offline → SKIPPED_UNAVAILABLE with no execution", async () => {
    const { sourcePath, outDir } = await setupSource(500, 500);
    const { runtime, calls } = mockRuntime({ online: { IMAGE_UPSCALE: false }, behavior: {} });
    const decision = decideImagePreparation({ generativeVideo: true, sourceWidth: 500, sourceHeight: 500, editorAcceptsMask: true });
    const out = await runImagePreparation(baseInput(sourcePath, outDir, decision), depsFor(runtime));
    expect(out.record.stages.ENHANCEMENT?.status).toBe("SKIPPED_UNAVAILABLE");
    expect(out.record.stages.ENHANCEMENT?.onlineExecuted).toBe(false);
    expect(calls).toHaveLength(0);
    expect(out.imagePath).toBe(sourcePath);
  });

  it("enhancement that changes content is rejected", async () => {
    const { sourcePath, outDir } = await setupSource(500, 500);
    const { runtime } = mockRuntime({ behavior: { IMAGE_UPSCALE: () => ({ ok: true, bytes: fakePng(1000, 1000) }) } });
    const decision = decideImagePreparation({ generativeVideo: true, sourceWidth: 500, sourceHeight: 500, editorAcceptsMask: true });
    const out = await runImagePreparation(baseInput(sourcePath, outDir, decision), depsFor(runtime, { enhance: BAD_EDIT_RASTER }));
    expect(out.record.stages.ENHANCEMENT?.status).toBe("REJECTED");
    expect(out.imagePath).toBe(sourcePath);
  });
});

describe("Phase 7 — G. Lineage", () => {
  it("records original → segmentation → edit → enhancement inputs", async () => {
    const { sourcePath, outDir } = await setupSource(600, 600);
    const { runtime } = mockRuntime({
      behavior: {
        IMAGE_SEGMENTATION: () => ({ ok: true, bytes: fakePng(600, 600) }),
        IMAGE_EDITING: () => ({ ok: true, bytes: fakePng(600, 600, 3) }),
        IMAGE_UPSCALE: () => ({ ok: true, bytes: fakePng(1200, 1200) }),
      },
    });
    const decision = decideImagePreparation({ generativeVideo: true, creativeRequest: BG_REQUEST, sourceWidth: 600, sourceHeight: 600, editorAcceptsMask: true });
    const out = await runImagePreparation(
      baseInput(sourcePath, outDir, decision),
      depsFor(runtime, { enhance: GOOD_EDIT_RASTER }),
    );
    const { SEGMENTATION, EDITING, ENHANCEMENT } = out.record.stages;
    expect(SEGMENTATION?.inputRef).toBe("original:asset-1");
    expect(EDITING?.inputRef).toBe(`original:asset-1+mask:${SEGMENTATION?.outputFileName}`);
    expect(ENHANCEMENT?.inputRef).toBe(EDITING?.outputFileName);
    expect(out.record.finalFileName).toBe(ENHANCEMENT?.outputFileName);
    expect(out.record.sourceAssetId).toBe("asset-1");
  });
});

describe("Phase 7 — H. Targeted retry", () => {
  it("retries only the failed operation and reuses accepted stages", async () => {
    const { sourcePath, outDir } = await setupSource();
    const { runtime, calls } = mockRuntime({
      behavior: {
        IMAGE_SEGMENTATION: () => ({ ok: true, bytes: fakePng(1200, 1200) }),
        IMAGE_EDITING: (_input, call) => (call === 1
          ? { ok: false, message: "temporary", code: "TIMEOUT" }
          : { ok: true, bytes: fakePng(1200, 1200, 3) }),
      },
    });
    const decision = decideImagePreparation({ generativeVideo: true, creativeRequest: BG_REQUEST, sourceWidth: 1200, sourceHeight: 1200, editorAcceptsMask: true });
    const first = await runImagePreparation(baseInput(sourcePath, outDir, decision), depsFor(runtime));
    expect(calls.filter((c) => c.feature === "IMAGE_SEGMENTATION")).toHaveLength(1);
    expect(calls.filter((c) => c.feature === "IMAGE_EDITING")).toHaveLength(2);
    expect(first.record.stages.EDITING?.history.map((h) => h.result)).toEqual(["FAILED", "ACCEPTED"]);
    expect(first.record.stages.EDITING?.attempts).toBe(2);

    const before = calls.length;
    const second = await runImagePreparation(baseInput(sourcePath, outDir, decision, first.record), depsFor(runtime));
    expect(calls.length).toBe(before);
    expect(second.imagePath).toBe(first.imagePath);
  });

  it("does not exceed the attempt budget across renders", async () => {
    const { sourcePath, outDir } = await setupSource(500, 500);
    const { runtime, calls } = mockRuntime({ behavior: { IMAGE_UPSCALE: () => ({ ok: false, message: "down" }) } });
    const decision = decideImagePreparation({ generativeVideo: true, sourceWidth: 500, sourceHeight: 500, editorAcceptsMask: true });
    const first = await runImagePreparation(baseInput(sourcePath, outDir, decision), depsFor(runtime));
    expect(calls).toHaveLength(2);
    await runImagePreparation(baseInput(sourcePath, outDir, decision, first.record), depsFor(runtime));
    expect(calls).toHaveLength(2);
  });

  it("attempt budget is configurable and bounded", () => {
    expect(imagePrepMaxAttempts({} as NodeJS.ProcessEnv)).toBe(2);
    expect(imagePrepMaxAttempts({ KWIZERA_IMAGE_PREP_MAX_ATTEMPTS: "3" } as NodeJS.ProcessEnv)).toBe(3);
    expect(imagePrepMaxAttempts({ KWIZERA_IMAGE_PREP_MAX_ATTEMPTS: "99" } as NodeJS.ProcessEnv)).toBe(4);
  });
});

describe("Phase 7 — I. Security", () => {
  it("records never contain provider names, model ids, keys, prompts, or raw provider errors", async () => {
    const { sourcePath, outDir } = await setupSource();
    const { runtime } = mockRuntime({
      behavior: {
        IMAGE_SEGMENTATION: () => ({ ok: true, bytes: fakePng(1200, 1200) }),
        IMAGE_EDITING: () => ({ ok: false, message: "fal-ai/flux-pro 401: invalid API key sk-secret-123", code: "AUTHENTICATION_ERROR" }),
      },
    });
    const decision = decideImagePreparation({ generativeVideo: true, creativeRequest: BG_REQUEST, sourceWidth: 1200, sourceHeight: 1200, editorAcceptsMask: true });
    const out = await runImagePreparation(baseInput(sourcePath, outDir, decision), depsFor(runtime));
    const json = JSON.stringify(out.record);
    expect(json).not.toMatch(/fal-ai|flux|sam2|esrgan|provider-|api key|sk-secret|PRODUCT — LOCKED|luxury studio/i);
    expect(out.record.stages.EDITING?.history[0]?.reason).toBe("Operation failed (AUTHENTICATION_ERROR)");
    expect(out.record.decision).not.toHaveProperty("editRequest");
  });
});

describe("Phase 7 — J. Regression", () => {
  it("Exact Product mode never triggers image preparation or generative video", () => {
    setAdminOnlineImageToVideoAvailable(true);
    expect(mapPmvModeToProduction("EXACT_PRODUCT")).toBe("AI_PRODUCT_MOTION");
    expect(mapPmvModeToProduction("CINEMATIC")).toBe("CINEMATIC_3D");
    expect(mapPmvModeToProduction("ADVANCED_CREATIVE")).toBe("CLASSIC_SHOWCASE");
    expect(resolveProductionRenderProfile("AI_PRODUCT_MOTION").usesGenerativeVideo).toBe(false);
    expect(resolveProductionRenderProfile("CINEMATIC_3D").usesGenerativeVideo).toBe(true);
    const exact = decideImagePreparation({ generativeVideo: false, creativeRequest: BG_REQUEST, sourceWidth: 300, sourceHeight: 300, editorAcceptsMask: true });
    expect(needsImagePreparation(exact)).toBe(false);
    expect(exact.reasonCodes).toEqual(["NOT_GENERATIVE_MODE"]);
  });

  it("editing offline → SKIPPED_UNAVAILABLE, no segmentation spend, original used", async () => {
    const { sourcePath, outDir } = await setupSource();
    const { runtime, calls } = mockRuntime({ online: { IMAGE_EDITING: false }, behavior: {} });
    const decision = decideImagePreparation({ generativeVideo: true, creativeRequest: BG_REQUEST, sourceWidth: 1200, sourceHeight: 1200, editorAcceptsMask: true });
    const out = await runImagePreparation(baseInput(sourcePath, outDir, decision), depsFor(runtime));
    expect(out.record.stages.EDITING?.status).toBe("SKIPPED_UNAVAILABLE");
    expect(calls).toHaveLength(0);
    expect(out.imagePath).toBe(sourcePath);
  });
});
