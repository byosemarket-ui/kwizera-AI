/**
 * Admin-routed cinematic I2V — VIDEO_IMAGE_TO_VIDEO via CapabilityRuntime.
 * Never reads provider secrets; never calls fal/Wan/Replicate SDKs directly.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { CapabilityRuntime } from "../admin-control-plane/capability-runtime.js";
import { extractIdentityLockFromProject } from "../creative-planning/creative-director-prompt.js";
import type { CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import {
  buildI2vMotionPrompt,
  buildI2vNegativePrompt,
  type I2vIdentityConstraints,
} from "./i2v-prompt.js";
import {
  setAdminOnlineImageToVideoAvailable,
} from "./production-mode-types.js";
import type {
  VideoGenerationJobHandle,
  VideoGenerationJobRequest,
  VideoGenerationProvider,
  VideoGenerationProviderStatus,
} from "./video-generation-provider.js";

export type CapabilityRuntimeFactory = () => CapabilityRuntime | null;

function mimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

function toIdentityConstraints(raw: ReturnType<typeof extractIdentityLockFromProject>): I2vIdentityConstraints | null {
  if (!raw) return null;
  return {
    protectedAttributes: raw.protectedAttributes,
    allowedCreativeChanges: raw.allowedCreativeChanges,
    productName: raw.productName,
    category: raw.category,
    colors: raw.colors,
    materials: raw.materials,
    distinctiveDetails: raw.distinctiveDetails,
  };
}

export class AdminRuntimeImageToVideoProvider implements VideoGenerationProvider {
  readonly id = "admin-runtime-i2v";
  private lastModel: string | null = null;
  private workspace: CreativeWorkspaceManager | null = null;

  constructor(private readonly getRuntime: CapabilityRuntimeFactory) {}

  attachWorkspace(workspace: CreativeWorkspaceManager | null): void {
    this.workspace = workspace;
  }

  get status(): VideoGenerationProviderStatus {
    const runtime = this.getRuntime();
    if (!runtime) return "UNAVAILABLE";
    const view = runtime.describe("VIDEO_IMAGE_TO_VIDEO");
    if (view.source === "ONLINE" && (view.status === "READY" || view.status === "FALLBACK")) {
      return "READY";
    }
    if (view.status === "UNAVAILABLE") return "UNAVAILABLE";
    return "CONFIGURED";
  }

  getLastModel(): string | null {
    return this.lastModel;
  }

  async isAvailable(): Promise<boolean> {
    const runtime = this.getRuntime();
    if (!runtime) {
      setAdminOnlineImageToVideoAvailable(false);
      return false;
    }
    const view = runtime.describe("VIDEO_IMAGE_TO_VIDEO");
    const online = view.source === "ONLINE" && (view.status === "READY" || view.status === "FALLBACK");
    setAdminOnlineImageToVideoAvailable(online);
    return online;
  }

  async generateMotion(request: VideoGenerationJobRequest): Promise<VideoGenerationJobHandle> {
    return this.generateVideoClip(request);
  }

  async generateVideoClip(request: VideoGenerationJobRequest): Promise<VideoGenerationJobHandle> {
    const runtime = this.getRuntime();
    if (!runtime) {
      return {
        jobId: `i2v-unavailable-${request.sceneId}`,
        status: "failed",
        error: "Admin capability runtime is not available",
      };
    }

    const view = runtime.describe("VIDEO_IMAGE_TO_VIDEO");
    if (view.source !== "ONLINE" || (view.status !== "READY" && view.status !== "FALLBACK")) {
      return {
        jobId: `i2v-unconfigured-${request.sceneId}`,
        status: "failed",
        error: view.reason ?? "VIDEO_IMAGE_TO_VIDEO is not mapped to an online executable provider",
      };
    }

    const imagePath = request.sourceImagePath?.trim();
    if (!imagePath) {
      return {
        jobId: `i2v-missing-image-${request.sceneId}`,
        status: "failed",
        error: "Source image path is required",
      };
    }

    let bytes: Buffer;
    try {
      bytes = await fs.readFile(imagePath);
    } catch {
      return {
        jobId: `i2v-read-fail-${request.sceneId}`,
        status: "failed",
        error: "Source image could not be read",
      };
    }
    if (bytes.length < 32) {
      return {
        jobId: `i2v-empty-image-${request.sceneId}`,
        status: "failed",
        error: "Source image is empty",
      };
    }

    let identity: I2vIdentityConstraints | null = request.identityConstraints ?? null;
    if (!identity && this.workspace) {
      try {
        const project = await this.workspace.getProject(request.projectId);
        identity = toIdentityConstraints(extractIdentityLockFromProject(project?.workspaceSettings));
      } catch {
        identity = null;
      }
    }

    const prompt = request.prompt?.trim() || buildI2vMotionPrompt({
      purpose: request.purpose,
      durationSeconds: request.durationSeconds,
      motionHint: request.motionHint,
      cameraHint: request.cameraHint,
      atmosphere: request.atmosphere,
      lighting: request.lighting,
      background: request.background,
      visualDescription: request.visualDescription,
      identity,
    });
    const negativePrompt = request.negativePrompt?.trim() || buildI2vNegativePrompt(identity);
    const outputPath = request.outputPath?.trim()
      || path.join(path.dirname(imagePath), `i2v-${request.sceneId}.mp4`);

    const result = await runtime.execute("VIDEO_IMAGE_TO_VIDEO", {
      mode: "image-to-video",
      prompt,
      negativePrompt,
      images: [{
        mimeType: mimeFromPath(imagePath),
        base64: bytes.toString("base64"),
      }],
      durationSeconds: request.durationSeconds,
      aspectRatio: request.aspectRatio,
      resolution: request.resolution,
      motionHint: request.motionHint,
      cameraHint: request.cameraHint,
      outputPath,
      sceneId: request.sceneId,
      sourceAssetId: request.sourceAssetId,
      projectId: request.projectId,
      timeoutMs: Math.min(540_000, Math.max(60_000, view.timeoutMs ?? 300_000)),
    });

    this.lastModel = result.modelId ?? null;

    if (!result.ok) {
      return {
        jobId: result.requestId,
        status: "failed",
        error: result.errorMessage ?? `Online I2V failed (${result.errorCode ?? "UNKNOWN"})`,
      };
    }

    const output = (result.output && typeof result.output === "object")
      ? result.output as { videoPath?: unknown }
      : null;
    const written = typeof output?.videoPath === "string" && output.videoPath.trim()
      ? output.videoPath.trim()
      : outputPath;

    try {
      const stat = await fs.stat(written);
      if (!stat.isFile() || stat.size < 1_024) {
        return {
          jobId: result.requestId,
          status: "failed",
          error: "Generated video file is missing or too small",
        };
      }
    } catch {
      return {
        jobId: result.requestId,
        status: "failed",
        error: "Generated video file was not written",
      };
    }

    return {
      jobId: result.requestId,
      status: "completed",
      outputPath: written,
    };
  }
}
