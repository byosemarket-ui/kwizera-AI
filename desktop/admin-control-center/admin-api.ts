import type {
  AdminDashboardSnapshot,
  AdminModelRecord,
  AdminProviderPublicView,
  FeatureMappingView,
  TypedSetting,
} from "./types";
import type { toAdminView } from "../../ai/pmv-orchestrator/views";
import type { KnowledgePipeline, KnowledgeRetrievalLogEntry, publicSourceView } from "../../ai/knowledge-acquisition-engine/knowledge-pipeline";
import type { TaskKnowledgeContext } from "../../ai/knowledge-retrieval-engine/knowledge-context-builder";
import type { TrainingCenter } from "../../ai/training-center/training-center";
import type {
  ActivationRecord, DatasetVersion, TeachingEvaluation, TeachingRecord, TrainingJob,
} from "../../ai/training-center/training-types";

export type AdminTrainingOverview = ReturnType<TrainingCenter["overview"]>;
export type AdminTrainingCatalog = ReturnType<TrainingCenter["catalog"]>;
export type AdminTrainingDataset = ReturnType<TrainingCenter["listDatasets"]>[number];
export type AdminTrainingDatasetDetail = ReturnType<TrainingCenter["getDataset"]>;
export type AdminTrainingVersionItem = NonNullable<ReturnType<TrainingCenter["listVersions"]>[number]>;
export type AdminTrainingProfile = ReturnType<TrainingCenter["listProfiles"]>[number];
export type AdminTrainingValidation = ReturnType<TrainingCenter["validateDraft"]>;
export type AdminTrainingRuntimeTest = Awaited<ReturnType<TrainingCenter["runtimeTest"]>>;
export type AdminTrainingDocumentPreview = Awaited<ReturnType<TrainingCenter["previewDocument"]>>;
export type AdminTeachingSource = ReturnType<TrainingCenter["listSources"]>[number];
export type AdminTeachingSessionSummary = ReturnType<TrainingCenter["listSessions"]>[number];
export type AdminTeachingSessionDetail = ReturnType<TrainingCenter["getSession"]>;
export type AdminLearnedKnowledgeItem = ReturnType<TrainingCenter["listKnowledge"]>[number];
export type AdminTeachingCommitResult = Awaited<ReturnType<TrainingCenter["commitSession"]>>;
export type AdminTeachingCapability = ReturnType<TrainingCenter["capabilityMatrix"]>[number];
export type {
  ActivationRecord as AdminTrainingActivation, DatasetVersion as AdminTrainingVersion, TeachingEvaluation as AdminTrainingEvaluation,
  TeachingRecord as AdminTrainingRecord, TrainingJob as AdminTrainingJob,
};

export type AdminWorkflowView = ReturnType<typeof toAdminView>;
export type AdminKnowledgeSource = ReturnType<typeof publicSourceView>;
export type AdminKnowledgeOverview = ReturnType<KnowledgePipeline["overview"]>;
export type AdminKnowledgeItem = ReturnType<KnowledgePipeline["listSourceItems"]>[number];
export type AdminKnowledgeRetrieval = KnowledgeRetrievalLogEntry;
export type AdminKnowledgeContext = TaskKnowledgeContext;
export interface AdminKnowledgeJob {
  jobId: string;
  sourceId: string;
  kind: "INGEST" | "REFRESH";
  status: string;
  stage: string;
  history: Array<{ stage: string; at: string; note?: string }>;
  attempts: number;
  error: { code: string; message: string } | null;
  result: { version: number; stored: number; linked: number; rejected: number; needsReview: number } | null;
  createdAt: string;
  updatedAt: string;
}

const ADMIN_TOKEN_STORAGE_KEY = "kwizera.admin.apiToken";

export class AdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getStoredAdminToken(): string {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function setStoredAdminToken(token: string): void {
  try {
    const trimmed = token.trim();
    if (trimmed) sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, trimmed);
    else sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function clearStoredAdminToken(): void {
  setStoredAdminToken("");
}

function adminAuthHeaders(): Record<string, string> {
  const token = getStoredAdminToken();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    "x-kwizera-admin-token": token,
  };
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...adminAuthHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const payload = data as { error?: string | { message?: string }; message?: string };
    const message = typeof payload.error === "string"
      ? payload.error
      : payload.error?.message || payload.message || `Admin API failed (${response.status})`;
    throw new AdminApiError(message, response.status);
  }
  return data as T;
}

export const adminApi = {
  dashboard: () => adminFetch<AdminDashboardSnapshot>("/api/admin/dashboard"),
  health: () => adminFetch<{
    ok: boolean;
    initialized: boolean;
    providers?: number;
    models?: number;
    features?: number;
    settings?: number;
  }>("/api/admin/health"),
  workflows: (limit = 50) =>
    adminFetch<{ items: AdminWorkflowView[] }>(`/api/admin/workflows?limit=${encodeURIComponent(String(limit))}`),
  providers: () => adminFetch<{
    items: AdminProviderPublicView[];
    credentialVault?: { attached: boolean; unlocked: boolean };
  }>("/api/admin/providers"),
  saveProvider: (body: Record<string, unknown>) =>
    adminFetch<AdminProviderPublicView>("/api/admin/providers", { method: "POST", body: JSON.stringify(body) }),
  setProviderCredential: (id: string, secret: string, options?: { enable?: boolean }) =>
    adminFetch<AdminProviderPublicView>(`/api/admin/providers/${encodeURIComponent(id)}/credential`, {
      method: "POST",
      body: JSON.stringify({ secret, enable: options?.enable }),
    }),
  testProviderHealth: (id: string) =>
    adminFetch<{
      providerId: string;
      code: string;
      healthStatus: string;
      detail?: string;
      durationMs: number;
      requestId: string;
      httpStatus?: number;
      endpointHost?: string;
    }>(`/api/admin/providers/${encodeURIComponent(id)}/health`, { method: "POST", body: "{}" }),
  models: (params?: Record<string, string | number | boolean | undefined>) => {
    const qs = new URLSearchParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === "") continue;
        qs.set(key, String(value));
      }
    }
    const suffix = qs.toString() ? `?${qs}` : "";
    return adminFetch<{ items: AdminModelRecord[]; total: number; page: number; pageSize: number }>(`/api/admin/models${suffix}`);
  },
  saveModel: (body: Record<string, unknown>) =>
    adminFetch<AdminModelRecord>("/api/admin/models", { method: "POST", body: JSON.stringify(body) }),
  setModelEnabled: (id: string, enabled: boolean) =>
    adminFetch<AdminModelRecord>(`/api/admin/models/${encodeURIComponent(id)}/enabled`, {
      method: "POST",
      body: JSON.stringify({ enabled }),
    }),
  features: () => adminFetch<{ items: FeatureMappingView[] }>("/api/admin/features"),
  saveFeature: (body: Record<string, unknown>) =>
    adminFetch("/api/admin/features", { method: "POST", body: JSON.stringify(body) }),
  resolveFeature: (feature: string) =>
    adminFetch<{
      ok: boolean;
      feature: string;
      status: string;
      selectedModelId: string | null;
      providerId: string | null;
      source: string;
      reason?: string;
    }>(`/api/admin/features/resolve/${encodeURIComponent(feature)}`),
  describeRuntime: (feature = "ONLINE_API_PROBE") =>
    adminFetch<Record<string, unknown>>(`/api/admin/runtime/describe?feature=${encodeURIComponent(feature)}`),
  executeRuntimeProbe: (body?: { prompt?: string }) =>
    adminFetch<Record<string, unknown>>("/api/admin/runtime/execute", {
      method: "POST",
      body: JSON.stringify({ feature: "ONLINE_API_PROBE", ...(body ?? {}) }),
    }),
  settings: (category?: string) => {
    const suffix = category ? `?category=${encodeURIComponent(category)}` : "";
    return adminFetch<{ items: TypedSetting[] }>(`/api/admin/settings${suffix}`);
  },
  saveSetting: (key: string, value: unknown) =>
    adminFetch<TypedSetting>("/api/admin/settings", { method: "POST", body: JSON.stringify({ key, value }) }),
  usage: () => adminFetch<{ items: unknown[]; note?: string }>("/api/admin/usage"),
  knowledgeOverview: () => adminFetch<{ overview: AdminKnowledgeOverview }>("/api/admin/knowledge/overview"),
  knowledgeDomains: () =>
    adminFetch<{ domains: Array<{ id: string; label: string; builtIn: boolean }>; sourceTypes: string[]; tasks: string[] }>("/api/admin/knowledge/domains"),
  knowledgeSources: () => adminFetch<{ items: AdminKnowledgeSource[] }>("/api/admin/knowledge/sources"),
  knowledgeSource: (id: string) =>
    adminFetch<{ source: AdminKnowledgeSource; items: AdminKnowledgeItem[]; jobs: AdminKnowledgeJob[] }>(`/api/admin/knowledge/sources/${encodeURIComponent(id)}`),
  registerKnowledgeSource: (body: Record<string, unknown>) =>
    adminFetch<{ source: AdminKnowledgeSource; job: AdminKnowledgeJob }>("/api/admin/knowledge/sources", { method: "POST", body: JSON.stringify(body) }),
  knowledgeSourceAction: (id: string, action: "approve" | "reject" | "disable" | "enable" | "refresh" | "trust", body: Record<string, unknown> = {}) =>
    adminFetch<{ source: AdminKnowledgeSource; job: AdminKnowledgeJob | null }>(`/api/admin/knowledge/sources/${encodeURIComponent(id)}/${action}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  knowledgeJobs: () => adminFetch<{ items: AdminKnowledgeJob[] }>("/api/admin/knowledge/jobs"),
  retryKnowledgeJob: (id: string) =>
    adminFetch<{ job: AdminKnowledgeJob }>(`/api/admin/knowledge/jobs/${encodeURIComponent(id)}/retry`, { method: "POST", body: "{}" }),
  reindexKnowledge: () =>
    adminFetch<{ result: { indexed: number; legacy: number; durationMs: number } }>("/api/admin/knowledge/reindex", { method: "POST", body: "{}" }),
  refreshStaleKnowledge: () => adminFetch<{ jobs: AdminKnowledgeJob[] }>("/api/admin/knowledge/refresh-stale", { method: "POST", body: "{}" }),
  knowledgeRetrievals: () => adminFetch<{ items: AdminKnowledgeRetrieval[] }>("/api/admin/knowledge/retrievals"),
  searchKnowledge: (body: { query: string; task?: string; projectId?: string }) =>
    adminFetch<{ context: AdminKnowledgeContext }>("/api/admin/knowledge/search", { method: "POST", body: JSON.stringify(body) }),

  trainingOverview: () => adminFetch<{ overview: AdminTrainingOverview }>("/api/admin/training/overview"),
  trainingCatalog: () => adminFetch<{ catalog: AdminTrainingCatalog }>("/api/admin/training/catalog"),
  teachingCapabilities: () => adminFetch<{ items: AdminTeachingCapability[] }>("/api/admin/training/capabilities"),
  trainingDatasets: (includeArchived = false) => adminFetch<{ items: AdminTrainingDataset[] }>(`/api/admin/training/datasets${includeArchived ? "?includeArchived=1" : ""}`),
  archiveTrainingDataset: (datasetId: string, archived: boolean) =>
    adminFetch<{ dataset: AdminTrainingDataset }>(`/api/admin/training/datasets/${encodeURIComponent(datasetId)}/archive`, { method: "POST", body: JSON.stringify({ archived }) }),
  teachingSources: (includeArchived = false) => adminFetch<{ items: AdminTeachingSource[] }>(`/api/admin/training/sources${includeArchived ? "?includeArchived=1" : ""}`),
  addTeachingSource: (body: Record<string, unknown>) =>
    adminFetch<{ source: AdminTeachingSource; reused: boolean }>("/api/admin/training/sources", { method: "POST", body: JSON.stringify(body) }),
  deleteTeachingSource: (sourceId: string) =>
    adminFetch<{ source: AdminTeachingSource; knowledgeKept: boolean }>(`/api/admin/training/sources/${encodeURIComponent(sourceId)}`, { method: "DELETE" }),
  teachingSessions: () => adminFetch<{ items: AdminTeachingSessionSummary[] }>("/api/admin/training/sessions"),
  teachingSession: (id: string) => adminFetch<{ session: AdminTeachingSessionDetail }>(`/api/admin/training/sessions/${encodeURIComponent(id)}`),
  createTeachingSession: (body: Record<string, unknown>) =>
    adminFetch<{ session: AdminTeachingSessionSummary }>("/api/admin/training/sessions", { method: "POST", body: JSON.stringify(body) }),
  decideTeachingKnowledge: (id: string, decisions: Array<{ id: string; decision: "ACCEPTED" | "REJECTED" | "PENDING" }>) =>
    adminFetch<{ session: AdminTeachingSessionDetail }>(`/api/admin/training/sessions/${encodeURIComponent(id)}/decisions`, { method: "POST", body: JSON.stringify({ decisions }) }),
  commitTeachingSession: (id: string, body: Record<string, unknown>) =>
    adminFetch<{ result: AdminTeachingCommitResult }>(`/api/admin/training/sessions/${encodeURIComponent(id)}/commit`, { method: "POST", body: JSON.stringify(body) }),
  rerunTeachingSession: (id: string) =>
    adminFetch<{ session: AdminTeachingSessionSummary }>(`/api/admin/training/sessions/${encodeURIComponent(id)}/rerun`, { method: "POST", body: "{}" }),
  knowledgeLibrary: (filters: Record<string, string>) => {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== "")).toString();
    return adminFetch<{ items: AdminLearnedKnowledgeItem[] }>(`/api/admin/training/knowledge${qs ? `?${qs}` : ""}`);
  },
  trainingDataset: (id: string) => adminFetch<AdminTrainingDatasetDetail>(`/api/admin/training/datasets/${encodeURIComponent(id)}`),
  createTrainingDataset: (body: Record<string, unknown>) =>
    adminFetch<{ dataset: AdminTrainingDataset }>("/api/admin/training/datasets", { method: "POST", body: JSON.stringify(body) }),
  addTrainingRecord: (datasetId: string, body: Record<string, unknown>) =>
    adminFetch<{ record: TeachingRecord; job: TrainingJob | null }>(`/api/admin/training/datasets/${encodeURIComponent(datasetId)}/records`, { method: "POST", body: JSON.stringify(body) }),
  importTrainingRecords: (datasetId: string, jsonl: string) =>
    adminFetch<{ result: { imported: number; errors: Array<{ line: number; message: string }> } }>(`/api/admin/training/datasets/${encodeURIComponent(datasetId)}/records/import`, { method: "POST", body: JSON.stringify({ jsonl }) }),
  reviewTrainingRecord: (datasetId: string, recordId: string, decision: "APPROVED" | "REJECTED", note = "") =>
    adminFetch<{ record: TeachingRecord }>(`/api/admin/training/datasets/${encodeURIComponent(datasetId)}/records/${encodeURIComponent(recordId)}/review`, { method: "POST", body: JSON.stringify({ decision, note }) }),
  reprocessTrainingRecord: (datasetId: string, recordId: string) =>
    adminFetch<{ job: TrainingJob }>(`/api/admin/training/datasets/${encodeURIComponent(datasetId)}/records/${encodeURIComponent(recordId)}/reprocess`, { method: "POST", body: "{}" }),
  removeTrainingRecord: (datasetId: string, recordId: string) =>
    adminFetch<{ removed: boolean }>(`/api/admin/training/datasets/${encodeURIComponent(datasetId)}/records/${encodeURIComponent(recordId)}`, { method: "DELETE" }),
  trainingValidation: (datasetId: string) =>
    adminFetch<{ validation: AdminTrainingValidation }>(`/api/admin/training/datasets/${encodeURIComponent(datasetId)}/validation`),
  publishTrainingDataset: (datasetId: string, note: string) =>
    adminFetch<{ job: TrainingJob }>(`/api/admin/training/datasets/${encodeURIComponent(datasetId)}/publish`, { method: "POST", body: JSON.stringify({ note }) }),
  evaluateTrainingVersion: (datasetId: string, version: number) =>
    adminFetch<{ job: TrainingJob }>(`/api/admin/training/datasets/${encodeURIComponent(datasetId)}/versions/${version}/evaluate`, { method: "POST", body: "{}" }),
  activateTrainingVersion: (datasetId: string, version: number) =>
    adminFetch<{ job: TrainingJob }>(`/api/admin/training/datasets/${encodeURIComponent(datasetId)}/versions/${version}/activate`, { method: "POST", body: "{}" }),
  deactivateTrainingDataset: (datasetId: string) =>
    adminFetch<{ job: TrainingJob }>(`/api/admin/training/datasets/${encodeURIComponent(datasetId)}/deactivate`, { method: "POST", body: "{}" }),
  rollbackTrainingDataset: (datasetId: string, toVersion?: number) =>
    adminFetch<{ job: TrainingJob }>(`/api/admin/training/datasets/${encodeURIComponent(datasetId)}/rollback`, { method: "POST", body: JSON.stringify(toVersion ? { toVersion } : {}) }),
  trainingRuntimeTest: (datasetId: string, body: { query?: string; projectId?: string }) =>
    adminFetch<{ test: AdminTrainingRuntimeTest }>(`/api/admin/training/datasets/${encodeURIComponent(datasetId)}/runtime-test`, { method: "POST", body: JSON.stringify(body) }),
  requestModelTraining: (datasetId: string, version: number | null) =>
    adminFetch<{ job: TrainingJob }>(`/api/admin/training/datasets/${encodeURIComponent(datasetId)}/model-training`, { method: "POST", body: JSON.stringify(version ? { version } : {}) }),
  trainingVersion: (datasetId: string, version: number) =>
    adminFetch<{ version: DatasetVersion; evaluations: TeachingEvaluation[] }>(`/api/admin/training/datasets/${encodeURIComponent(datasetId)}/versions/${version}`),
  trainingVersions: () => adminFetch<{ items: AdminTrainingVersionItem[] }>("/api/admin/training/versions"),
  trainingEvaluations: () => adminFetch<{ items: TeachingEvaluation[] }>("/api/admin/training/evaluations"),
  trainingActivations: () => adminFetch<{ items: ActivationRecord[] }>("/api/admin/training/activations"),
  trainingJobs: () => adminFetch<{ items: TrainingJob[] }>("/api/admin/training/jobs"),
  trainingJob: (id: string) => adminFetch<{ job: TrainingJob }>(`/api/admin/training/jobs/${encodeURIComponent(id)}`),
  cancelTrainingJob: (id: string) => adminFetch<{ job: TrainingJob }>(`/api/admin/training/jobs/${encodeURIComponent(id)}/cancel`, { method: "POST", body: "{}" }),
  trainingProfiles: () => adminFetch<{ items: AdminTrainingProfile[] }>("/api/admin/training/profiles"),
  createTrainingProfile: (body: Record<string, unknown>) =>
    adminFetch<{ profile: AdminTrainingProfile }>("/api/admin/training/profiles", { method: "POST", body: JSON.stringify(body) }),
  activateTrainingProfile: (id: string) =>
    adminFetch<{ jobs: TrainingJob[] }>(`/api/admin/training/profiles/${encodeURIComponent(id)}/activate`, { method: "POST", body: "{}" }),
  previewTrainingDocument: (body: Record<string, unknown>) =>
    adminFetch<{ preview: AdminTrainingDocumentPreview }>("/api/admin/training/preview/document", { method: "POST", body: JSON.stringify(body) }),
};
