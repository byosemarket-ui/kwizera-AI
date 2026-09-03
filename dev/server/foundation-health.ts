/**
 * Consolidated production foundation health — reuses existing managers without exposing secrets.
 */
import type { CreativeWorkspaceManager } from "../../ai/creative-workspace/creative-workspace-manager.js";
import { ffmpegAvailable } from "../../ai/video-production/ffmpeg-renderer.js";
import { assessOllamaReadiness } from "../../ai/media-intelligence/ollama-readiness.js";

export interface FoundationHealthCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface FoundationHealthReport {
  ok: boolean;
  checkedAt: string;
  checks: FoundationHealthCheck[];
}

export async function buildFoundationHealth(
  workspace: CreativeWorkspaceManager | null,
): Promise<FoundationHealthReport> {
  const checks: FoundationHealthCheck[] = [];
  const checkedAt = new Date().toISOString();

  checks.push({ name: "application", ok: true, detail: "HTTP server responding" });

  if (!workspace) {
    checks.push({ name: "workspace", ok: false, detail: "Creative workspace not initialized" });
  } else {
    try {
      const persistence = await workspace.runPersistenceHealth();
      checks.push({
        name: "project-storage",
        ok: persistence.indexOk && persistence.writable,
        detail: `${persistence.projectCount} projects, writable=${persistence.writable}`,
      });
      checks.push({
        name: "image-assets",
        ok: true,
        detail: `${persistence.assetsOk} assets OK, ${persistence.assetsMissingFile} missing files`,
      });
      checks.push({
        name: "upload-write",
        ok: persistence.writable,
        detail: persistence.writable ? "Storage root writable" : "Storage root not writable",
      });
    } catch (error) {
      checks.push({
        name: "workspace-health",
        ok: false,
        detail: error instanceof Error ? error.message : "Workspace health check failed",
      });
    }
  }

  const ffmpeg = await ffmpegAvailable();
  checks.push({
    name: "ffmpeg",
    ok: ffmpeg,
    detail: ffmpeg ? "FFmpeg executable available" : "FFmpeg not found on PATH",
  });

  const ollama = await assessOllamaReadiness();
  checks.push({
    name: "ollama-readiness",
    ok: true,
    detail: ollama.ready
      ? "Ollama reachable with a selected model"
      : "Ollama optional — deterministic Creative Director fallback is active",
  });

  try {
    const { getTypographyDiagnostics } = await import("../../ai/typography/diagnostics.js");
    const typography = await getTypographyDiagnostics();
    checks.push({
      name: "typography-foundation",
      ok: typography.deterministicFallback,
      detail: typography.ready
        ? `${typography.verifiedFontCount} verified fonts, fallback=${typography.fallbackFamily ?? "yes"}`
        : typography.lastError ?? "Typography fallback is available without verified fonts",
    });
  } catch (error) {
    checks.push({
      name: "typography-foundation",
      ok: true,
      detail: error instanceof Error ? error.message : "Typography diagnostics unavailable — deterministic video text remains",
    });
  }

  const ok = checks.filter((check) => check.name !== "ollama-readiness").every((check) => check.ok);
  return { ok, checkedAt, checks };
}
