/**
 * Phase 18 — AI Training & Teaching Center boot + admin HTTP handlers (/api/admin/training/*).
 * Called by handleAdminApi only after assertAdminAccess has passed. Responses never contain server paths,
 * provider credentials or model identifiers.
 */
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { getKnowledgePipeline } from "../../ai/knowledge-acquisition-engine/knowledge-pipeline-registry.js";
import { getIntelligenceLayer } from "../../ai/intelligence-layer/index.js";
import { SessionInputError, TrainingCenter, TrainingInputError, type CuratedPatternSink } from "../../ai/training-center/training-center.js";
import type { TeachingAi } from "../../ai/training-center/teaching-deep-media.js";
import type { CapabilityAvailability } from "../../ai/training-center/training-types.js";
import { registerCreativePatternProvider } from "../../ai/creative-planning/learned-creative-patterns.js";
import { getAdminControlPlaneManager, getWorkspaceManager } from "../persistent/runtime.js";
import { createKnowledgeFetcher, isOfficialKnowledgeHost, validateKnowledgeUrl } from "./knowledge-fetcher.js";
import { persistentMemoryCenter } from "./persistent-memory-center.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;
type ReadBody = (req: IncomingMessage) => Promise<string>;

let center: TrainingCenter | null = null;

export function getTrainingCenter(): TrainingCenter | null {
  return center?.isReady() ? center : null;
}

const patternSink: CuratedPatternSink = {
  available: () => getIntelligenceLayer().isReady(),
  set: async (ref, meta, patterns) => (await getIntelligenceLayer().setCuratedPatterns(ref, meta, patterns)).length,
  retire: (refPrefix) => getIntelligenceLayer().retireCuratedPatterns(refPrefix),
};

/** Admin-routed AI for teaching analysis: CapabilityRuntime → feature mapping → adapter → vault. Only error codes leave this layer. */
function teachingAi(): TeachingAi | null {
  const runtime = getAdminControlPlaneManager()?.getCapabilityRuntime() ?? null;
  if (!runtime) return null;
  const safe = (r: { ok: boolean; outputText?: string | null; errorCode?: string }) => ({ ok: r.ok && Boolean(r.outputText), text: r.outputText ?? null, error: r.ok ? null : r.errorCode ?? "FAILED" });
  return {
    visionState: () => runtime.executionReadiness("VISION_ANALYSIS").state,
    reasoningState: () => runtime.executionReadiness("LLM_REASONING").state,
    vision: async (images, prompt) => safe(await runtime.execute("VISION_ANALYSIS", { mode: "vision", prompt, images, timeoutMs: 60_000 })),
    reason: async (system, user) => safe(await runtime.execute("LLM_REASONING", { mode: "chat", messages: [{ role: "system", content: system }, { role: "user", content: user }], timeoutMs: 60_000 })),
  };
}

const ROUTE_REASONS: Record<string, string> = {
  NOT_CONFIGURED: "No Admin feature mapping resolves to an enabled provider model.",
  DISABLED: "The mapped provider is disabled in Admin.",
  NOT_IMPLEMENTED: "The mapped provider has no executable adapter on this server.",
  CREDENTIAL_MISSING: "The mapped provider has no credential in the vault.",
  AUTH_FAILED: "The mapped provider failed its last Admin connection test (unhealthy).",
  PROVIDER_ERROR: "The mapped provider is degraded.",
  UNVERIFIED: "The mapped provider has not passed an Admin connection test yet.",
};

/**
 * Phase 18C — capability availability for teaching (Admin-only diagnostics). Routed capabilities follow
 * CapabilityRuntime → Admin feature mapping → provider adapter → credential vault; measured capabilities run on
 * the server's FFmpeg and Audio Intelligence. Reasons never contain credentials or provider secrets.
 */
function teachingCapabilities(): CapabilityAvailability[] {
  const runtime = getAdminControlPlaneManager()?.getCapabilityRuntime() ?? null;
  const routed = (feature: "VISION_ANALYSIS" | "LLM_REASONING", capability: string, label: string, use: string): CapabilityAvailability => {
    const route = `CapabilityRuntime → ${feature} feature mapping → provider adapter → credential vault`;
    if (!runtime) return { capability, label, implemented: true, configured: false, executable: false, state: "UNAVAILABLE", reason: "The Admin Control Plane is not ready.", route };
    const base = runtime.readiness(feature);
    const exec = runtime.executionReadiness(feature);
    const configured = base.state !== "NOT_CONFIGURED" && base.state !== "DISABLED";
    return {
      capability, label, implemented: true, configured, executable: exec.executable,
      state: exec.executable ? "EXECUTABLE" : exec.state === "NOT_IMPLEMENTED" ? "NOT_IMPLEMENTED" : configured ? "CONFIGURED" : "UNAVAILABLE",
      reason: exec.executable ? `Executable: ${use}.` : `${ROUTE_REASONS[exec.state] ?? exec.state} Needed for ${use}.`, route,
    };
  };
  const measured = (capability: string, label: string, reason: string): CapabilityAvailability =>
    ({ capability, label, implemented: true, configured: true, executable: true, state: "EXECUTABLE", reason, route: "Server-side measurement (FFmpeg / Audio Intelligence); no provider" });
  const missing = (capability: string, label: string, reason: string): CapabilityAvailability =>
    ({ capability, label, implemented: false, configured: false, executable: false, state: "NOT_IMPLEMENTED", reason, route: "—" });
  return [
    measured("SCENE_DETECTION", "Scene and gradual-transition detection", "FFmpeg scene score plus a coarse-frame pass for dissolves the cut detector misses."),
    measured("CAMERA_MOTION", "Camera motion (pan, tilt, push-in, pull-out, handheld, tracking)", "Global block matching and scale search on decoded frames."),
    measured("TRANSITION_ANALYSIS", "Transition type and duration", "Dense 16 fps sampling around each boundary (cut, fade, dissolve, wipe)."),
    measured("COMPOSITION", "Subject region, crop risk, negative space, text-safe regions", "Border-background separation on keyframes."),
    measured("TEXT_PRESENCE", "On-screen text presence and location", "Edge-density bands on keyframes; text is located, not read."),
    measured("AUDIO_ANALYSIS", "BPM, beats, downbeats, sections, energy, silence, fades", "Audio Intelligence on decoded PCM."),
    measured("AV_SYNC", "Cut/beat synchronisation", "Scene boundaries against the measured beat grid."),
    routed("VISION_ANALYSIS", "VISION", "On-screen text roles, layout and call-to-action (vision)", "reading text roles, layout and CTA in keyframes and images"),
    routed("LLM_REASONING", "REASONING", "AI-assisted extraction and English normalisation", "grounded AI extraction and translating non-English knowledge"),
    missing("SPEECH_TO_TEXT", "Speech transcription", "No speech-to-text execution path exists in the teaching pipeline; the SPEECH_TO_TEXT feature has no provider adapter."),
    missing("OCR", "Reading on-screen text (OCR)", "No OCR engine is installed; text is located but not read unless vision is executable."),
    missing("FONT_IDENTIFICATION", "Exact font identification", "Not implemented by design: fonts are never guessed from pixels."),
  ];
}

/** URL learning is limited to the official knowledge library hosts plus hosts the operator allowlists. */
function teachingUrlPolicy(raw: string): { ok: true; url: string } | { ok: false; code: string; message: string } {
  let url: URL;
  try {
    url = validateKnowledgeUrl(raw);
  } catch (err) {
    return { ok: false, code: "URL_NOT_ALLOWED", message: err instanceof Error ? err.message : "URL not allowed." };
  }
  const extra = (process.env.KWIZERA_TEACHING_URL_ALLOWLIST ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  const host = url.hostname.toLowerCase();
  if (!isOfficialKnowledgeHost(host) && !extra.some((h) => host === h || host.endsWith(`.${h}`))) {
    return { ok: false, code: "URL_NOT_ALLOWLISTED", message: `${host} is not on the teaching allowlist. Upload the material as a file instead, or ask the operator to allowlist the host.` };
  }
  return { ok: true, url: url.toString() };
}

export async function bootTrainingCenter(): Promise<TrainingCenter> {
  if (center?.isReady()) return center;
  if (!persistentMemoryCenter.isReady()) throw new Error("Persistent Memory Center is not ready");
  const onlineRetrieval = process.env.KWIZERA_KNOWLEDGE_ONLINE_RETRIEVAL !== "0";
  const next = new TrainingCenter({
    dataDir: path.join(persistentMemoryCenter.getKnowledgeRoot(), "training"),
    pipeline: () => getKnowledgePipeline(),
    patterns: patternSink,
    ai: teachingAi,
    capabilities: teachingCapabilities,
    ...(onlineRetrieval ? { urlPolicy: teachingUrlPolicy, fetchUrl: createKnowledgeFetcher() } : {}),
    projectExists: async (projectId) => {
      const workspace = getWorkspaceManager();
      return Boolean(workspace && await workspace.getProject(projectId).catch(() => null));
    },
    resolveProjectImage: async (projectId, assetId) => {
      const workspace = getWorkspaceManager();
      const project = workspace ? await workspace.getProject(projectId).catch(() => null) : null;
      const image = project?.productImages.find((item) => item.id === assetId);
      const filePath = image ? await workspace!.getAssetImagePath(projectId, assetId) : null;
      return image && filePath ? { filePath, mimeType: image.mimeType, fileName: image.fileName } : null;
    },
    loadFonts: async () => {
      const { getVerifiedFonts } = await import("../../ai/typography/font-registry.js");
      return getVerifiedFonts();
    },
  });
  next.boot();
  center = next;
  registerCreativePatternProvider({
    active: (query) => next.activeCreativePatterns(query),
    recordUsage: (ids, projectId) => next.recordPatternUsage(ids, projectId),
  });
  console.log(`[KWIZERA] Training Center ready (${next.listDatasets().length} datasets).`);
  return next;
}

function fail(sendJson: SendJson, res: ServerResponse, status: number, code: string, message: string): void {
  sendJson(res, status, { ok: false, error: { code, message }, code, message });
}

function ok(sendJson: SendJson, res: ServerResponse, data: Record<string, unknown>, status = 200): void {
  sendJson(res, status, { ok: true, ...data });
}

async function jsonBody(req: IncomingMessage, readBody: ReadBody): Promise<Record<string, unknown>> {
  const raw = await readBody(req);
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
}

/** Display name of the acting admin for audit records (the admin token itself is never stored). */
function actor(req: IncomingMessage): string {
  const raw = req.headers["x-kwizera-admin-user"];
  const name = (Array.isArray(raw) ? raw[0] : raw ?? "").replace(/[^\p{L}\p{N} ._@-]/gu, "").trim().slice(0, 60);
  return name || "admin";
}

const str = (v: unknown, max = 500): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Returns true when handled. Must be called only after the admin guard has passed. */
export async function handleAdminTrainingApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  deps: { sendJson: SendJson; readBody: ReadBody },
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/admin/training")) return false;
  const { sendJson, readBody } = deps;
  let tc = getTrainingCenter();
  if (!tc) {
    try {
      tc = await bootTrainingCenter();
    } catch {
      fail(sendJson, res, 503, "TRAINING_NOT_READY", "The Training Center is starting. Try again shortly.");
      return true;
    }
  }
  const sub = url.pathname.slice("/api/admin/training".length) || "/";
  const method = req.method ?? "GET";
  const by = actor(req);
  const reply = (data: Record<string, unknown>, status = 200): true => {
    ok(sendJson, res, data, status);
    return true;
  };
  try {
    if (method === "GET") {
      if (sub === "/overview") return reply({ overview: tc.overview() });
      if (sub === "/catalog") return reply({ catalog: tc.catalog() });
      if (sub === "/capabilities") return reply({ items: tc.capabilityMatrix() });
      if (sub === "/creative-patterns") {
        const task = url.searchParams.get("task") === "CINEMATIC_VIDEO" ? "CINEMATIC_VIDEO" : "PRODUCT_SLIDESHOW";
        return reply({ items: tc.activeCreativePatterns({ task, projectId: str(url.searchParams.get("projectId"), 80) || null, context: [] }) });
      }
      if (sub === "/datasets") return reply({ items: tc.listDatasets({ includeArchived: url.searchParams.get("includeArchived") === "1" }) });
      if (sub === "/sources") return reply({ items: tc.listSources({ includeArchived: url.searchParams.get("includeArchived") === "1" }) });
      if (sub === "/sessions") return reply({ items: tc.listSessions() });
      if (sub === "/knowledge") {
        const filters: Record<string, string | undefined> = {};
        for (const key of ["target", "capability", "type", "sourceKind", "sourceId", "minConfidence", "status", "novelty", "active", "version", "from", "to", "q", "projectId", "includeArchived", "language", "patternFamily"]) {
          const value = str(url.searchParams.get(key), 120);
          if (value) filters[key] = value;
        }
        return reply({ items: tc.listKnowledge(filters) });
      }
      const sessionMatch = sub.match(/^\/sessions\/([0-9a-f-]{36})$/);
      if (sessionMatch) return reply({ session: tc.getSession(sessionMatch[1]!) });
      if (sub === "/versions") return reply({ items: tc.listVersions() });
      if (sub === "/evaluations") return reply({ items: tc.listEvaluations(str(url.searchParams.get("datasetId"), 40) || undefined) });
      if (sub === "/activations") return reply({ items: tc.listActivations() });
      if (sub === "/jobs") return reply({ items: tc.listJobs(150) });
      if (sub === "/profiles") return reply({ items: tc.listProfiles() });
      const datasetMatch = sub.match(/^\/datasets\/([0-9a-f-]{36})$/);
      if (datasetMatch) return reply(tc.getDataset(datasetMatch[1]!));
      const validateMatch = sub.match(/^\/datasets\/([0-9a-f-]{36})\/validation$/);
      if (validateMatch) return reply({ validation: tc.validateDraft(validateMatch[1]!) });
      const versionMatch = sub.match(/^\/datasets\/([0-9a-f-]{36})\/versions\/(\d{1,5})$/);
      if (versionMatch) return reply(tc.getVersion(versionMatch[1]!, Number(versionMatch[2])));
      const evalMatch = sub.match(/^\/evaluations\/([0-9a-f-]{36})$/);
      if (evalMatch) return reply({ evaluation: tc.getEvaluation(evalMatch[1]!) });
      const jobMatch = sub.match(/^\/jobs\/([0-9a-f-]{36})$/);
      if (jobMatch) return reply({ job: tc.getJob(jobMatch[1]!) });
      fail(sendJson, res, 404, "NOT_FOUND", "Unknown training endpoint.");
      return true;
    }

    if (method === "DELETE") {
      const recordMatch = sub.match(/^\/datasets\/([0-9a-f-]{36})\/records\/([0-9a-f-]{36})$/);
      if (recordMatch) {
        tc.removeDraftRecord(recordMatch[1]!, recordMatch[2]!);
        return reply({ removed: true });
      }
      const sourceMatch = sub.match(/^\/sources\/([0-9a-f-]{36})$/);
      if (sourceMatch) return reply({ source: tc.deleteSource(sourceMatch[1]!), knowledgeKept: true });
      fail(sendJson, res, 405, "METHOD_NOT_ALLOWED", "Published versions, knowledge and memory are never deleted from here.");
      return true;
    }

    if (method !== "POST") {
      fail(sendJson, res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
      return true;
    }
    const body = await jsonBody(req, readBody);
    if (sub === "/datasets") return reply({ dataset: await tc.createDataset(body, by) }, 201);
    if (sub === "/preview/document") return reply({ preview: await tc.previewDocument(body) });
    if (sub === "/profiles") return reply({ profile: tc.createProfile(body, by) }, 201);
    if (sub === "/sources") {
      const result = await tc.addSource(body, by);
      return reply(result, result.reused ? 200 : 201);
    }
    if (sub === "/sessions") return reply({ session: await tc.createSession(body, by) }, 202);
    const sessionAction = sub.match(/^\/sessions\/([0-9a-f-]{36})\/(decisions|commit|rerun)$/);
    if (sessionAction) {
      const id = sessionAction[1]!;
      if (sessionAction[2] === "decisions") {
        const decisions = Array.isArray(body.decisions) ? body.decisions.map((d) => ({ id: str((d as Record<string, unknown>)?.id, 40), decision: str((d as Record<string, unknown>)?.decision, 20) })) : [];
        return reply({ session: tc.decideKnowledge(id, decisions, by) });
      }
      if (sessionAction[2] === "commit") return reply({ result: await tc.commitSession(id, body, by) });
      return reply({ session: await tc.rerunSession(id, by) }, 202);
    }
    const profileActivate = sub.match(/^\/profiles\/([0-9a-f-]{36})\/activate$/);
    if (profileActivate) return reply({ jobs: tc.activateProfile(profileActivate[1]!, by) }, 202);
    const cancel = sub.match(/^\/jobs\/([0-9a-f-]{36})\/cancel$/);
    if (cancel) return reply({ job: tc.cancelJob(cancel[1]!) });

    const ds = sub.match(/^\/datasets\/([0-9a-f-]{36})(\/.*)?$/);
    if (ds) {
      const datasetId = ds[1]!;
      const rest = ds[2] ?? "";
      if (rest === "/records") {
        const result = await tc.addRecord(datasetId, body, by);
        return reply(result, result.job ? 202 : 201);
      }
      if (rest === "/records/import") return reply({ result: await tc.importRecords(datasetId, typeof body.jsonl === "string" ? body.jsonl.slice(0, 2_000_000) : "", by) });
      const recordAction = rest.match(/^\/records\/([0-9a-f-]{36})\/(review|reprocess)$/);
      if (recordAction) {
        if (recordAction[2] === "review") return reply({ record: tc.reviewRecord(datasetId, recordAction[1]!, str(body.decision, 20), str(body.note, 300), by) });
        return reply({ job: tc.reprocessRecord(datasetId, recordAction[1]!, by) }, 202);
      }
      if (rest === "/publish") return reply({ job: tc.publish(datasetId, str(body.note, 500), by) }, 202);
      if (rest === "/archive") return reply({ dataset: tc.archiveDataset(datasetId, body.archived !== false) });
      if (rest === "/deactivate") return reply({ job: tc.deactivate(datasetId, by) }, 202);
      if (rest === "/rollback") {
        const to = typeof body.toVersion === "number" ? body.toVersion : null;
        return reply({ job: tc.rollback(datasetId, to, by) }, 202);
      }
      if (rest === "/runtime-test") {
        return reply({ test: await tc.runtimeTest(datasetId, { query: str(body.query, 480) || undefined, projectId: str(body.projectId, 80) || null }) });
      }
      if (rest === "/model-training") {
        const job = tc.requestModelTraining(datasetId, typeof body.version === "number" ? body.version : null, by);
        return reply({ job }, 409);
      }
      const versionAction = rest.match(/^\/versions\/(\d{1,5})\/(evaluate|activate)$/);
      if (versionAction) {
        const version = Number(versionAction[1]);
        const job = versionAction[2] === "evaluate" ? tc.evaluate(datasetId, version, by) : tc.activate(datasetId, version, by);
        return reply({ job }, 202);
      }
    }
    fail(sendJson, res, 404, "NOT_FOUND", "Unknown training endpoint.");
    return true;
  } catch (err) {
    if (err instanceof TrainingInputError || err instanceof SessionInputError) {
      fail(sendJson, res, err.status, err.code, err.message);
      return true;
    }
    if (err instanceof SyntaxError) {
      fail(sendJson, res, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }
    console.error("[KWIZERA] Training API error:", err instanceof Error ? err.message : err);
    fail(sendJson, res, 500, "TRAINING_ERROR", "The training request could not be completed.");
    return true;
  }
}
