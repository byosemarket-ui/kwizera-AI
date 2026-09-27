/**
 * Phase 18 — AI Training & Teaching Center boot + admin HTTP handlers (/api/admin/training/*).
 * Called by handleAdminApi only after assertAdminAccess has passed. Responses never contain server paths,
 * provider credentials or model identifiers.
 */
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { getKnowledgePipeline } from "../../ai/knowledge-acquisition-engine/knowledge-pipeline-registry.js";
import { getIntelligenceLayer } from "../../ai/intelligence-layer/index.js";
import { TrainingCenter, TrainingInputError, type CuratedPatternSink } from "../../ai/training-center/training-center.js";
import { getWorkspaceManager } from "../persistent/runtime.js";
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

export async function bootTrainingCenter(): Promise<TrainingCenter> {
  if (center?.isReady()) return center;
  if (!persistentMemoryCenter.isReady()) throw new Error("Persistent Memory Center is not ready");
  const next = new TrainingCenter({
    dataDir: path.join(persistentMemoryCenter.getKnowledgeRoot(), "training"),
    pipeline: () => getKnowledgePipeline(),
    patterns: patternSink,
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
      if (sub === "/datasets") return reply({ items: tc.listDatasets() });
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
    if (err instanceof TrainingInputError) {
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
